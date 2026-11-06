"""MindBridge ML microservice.

Endpoints (all under /v1, protected by X-API-Key when ML_SERVICE_API_KEY is set):
  POST /v1/sentiment  -> ensemble sentiment for one text
  POST /v1/embed      -> embeddings for 1..64 texts (for pgvector)
  POST /v1/analyze    -> sentiment + embedding in one round-trip (used on journal creation)
  GET  /health        -> liveness + which models are loaded
"""
import hmac
import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .ensemble import combine
from .models.embedder import Embedder
from .models.tfidf import TfidfSentiment
from .models.transformer import TransformerSentiment

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ml.api")


class Registry:
    """Holds the loaded models. Tests can swap members for fakes."""

    transformer: TransformerSentiment
    tfidf: TfidfSentiment
    embedder: Embedder


registry = Registry()


def ensure_tfidf_artifact() -> None:
    """Fresh clone? Train the small TF-IDF baseline from the bundled seed data (takes a few seconds)."""
    import os

    seed = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "seed_journal_sentiment.csv")
    if os.path.exists(settings.tfidf_model_path) or not os.path.exists(seed):
        return
    try:
        log.info("No TF-IDF artifact at %s - training from seed data", settings.tfidf_model_path)
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from train import train

        train(seed, settings.tfidf_model_path)
    except Exception as exc:  # noqa: BLE001
        log.warning("Auto-training failed: %s", exc)


def load_models() -> None:
    ensure_tfidf_artifact()
    registry.transformer = TransformerSentiment(settings.transformer_model)
    registry.tfidf = TfidfSentiment(settings.tfidf_model_path)
    registry.embedder = Embedder(settings.embedding_model, settings.embedding_dim, settings.enable_embedder)
    if settings.enable_transformer:
        registry.transformer.load()
    registry.tfidf.load()
    registry.embedder.load()


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_models()
    yield


app = FastAPI(title="MindBridge ML Service", version="1.0.0", lifespan=lifespan)


def require_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if settings.api_key and not hmac.compare_digest(x_api_key or "", settings.api_key):
        raise HTTPException(status_code=401, detail="invalid or missing API key")


class TextIn(BaseModel):
    text: str = Field(min_length=1)


class EmbedIn(BaseModel):
    texts: List[str] = Field(min_length=1, max_length=64)


def _clean(text: str) -> str:
    text = (text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="text must not be blank")
    return text[: settings.max_chars]


def run_sentiment(text: str) -> Dict:
    t0 = time.perf_counter()
    parts, breakdown, emotions = [], {}, None
    w_tr = min(max(settings.weight_transformer, 0.0), 1.0)

    if registry.transformer.ready:
        out = registry.transformer.predict(text)
        parts.append((registry.transformer.name, w_tr, out["probs"]))
        breakdown[registry.transformer.name] = {k: round(v, 4) for k, v in out["probs"].items()}
        emotions = {k: round(v, 4) for k, v in out["emotions"].items()}
    if registry.tfidf.ready:
        out = registry.tfidf.predict(text)
        parts.append((registry.tfidf.name, 1.0 - w_tr if registry.transformer.ready else 1.0, out["probs"]))
        breakdown[registry.tfidf.name] = {k: round(v, 4) for k, v in out["probs"].items()}

    if not parts:
        raise HTTPException(status_code=503, detail="no sentiment model is loaded")

    result = combine(parts)
    result.update(
        models_used=[n for n, _, _ in parts],
        breakdown=breakdown,
        emotions=emotions,
        degraded=len(parts) < 2,
        latency_ms=round((time.perf_counter() - t0) * 1000, 1),
    )
    return result


def run_embed(texts: List[str]) -> Dict:
    vectors = registry.embedder.encode(texts)
    return {
        "model": registry.embedder.active_name,
        "dim": settings.embedding_dim,
        "degraded": registry.embedder.degraded,
        "embeddings": vectors,
    }


@app.get("/health")
def health():
    t, f, e = registry.transformer, registry.tfidf, registry.embedder
    any_sentiment = t.ready or f.ready
    return {
        "status": "ok" if (t.ready and f.ready and e.ready) else ("degraded" if any_sentiment else "unavailable"),
        "models": {
            "distilroberta": {"loaded": t.ready, "name": t.model_name, "error": t.error},
            "tfidf_lr": {"loaded": f.ready, "error": f.error},
            "embedder": {"loaded": e.ready, "active": e.active_name, "error": e.error},
        },
    }


@app.post("/v1/sentiment", dependencies=[Depends(require_key)])
def sentiment(body: TextIn):
    return run_sentiment(_clean(body.text))


@app.post("/v1/embed", dependencies=[Depends(require_key)])
def embed(body: EmbedIn):
    return run_embed([_clean(t) for t in body.texts])


@app.post("/v1/analyze", dependencies=[Depends(require_key)])
def analyze(body: TextIn):
    text = _clean(body.text)
    return {"sentiment": run_sentiment(text), "embedding": run_embed([text])}
