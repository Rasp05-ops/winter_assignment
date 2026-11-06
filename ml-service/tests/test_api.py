import os
os.environ.setdefault("ENABLE_TRANSFORMER", "0")   # tests must not download models
os.environ.setdefault("ENABLE_EMBEDDER", "0")

import math
import pytest
from fastapi.testclient import TestClient

from app import main
from app.ensemble import combine
from app.text_utils import chunk_text


class FakeTransformer:
    name = "distilroberta"
    model_name = "fake"
    error = None
    ready = True

    def predict(self, text):
        probs = {"negative": 0.1, "neutral": 0.1, "positive": 0.8}
        return {"probs": probs, "emotions": {"joy": 0.8, "sadness": 0.1, "neutral": 0.1}}


@pytest.fixture()
def client():
    with TestClient(main.app) as c:   # runs lifespan -> loads tfidf (+ hashing fallback)
        yield c


def test_health_reports_degraded_without_transformer(client):
    r = client.get("/health").json()
    assert r["status"] == "degraded"
    assert r["models"]["tfidf_lr"]["loaded"] is True
    assert r["models"]["distilroberta"]["loaded"] is False


def test_sentiment_tfidf_only(client):
    r = client.post("/v1/sentiment", json={"text": "I felt genuinely happy and grateful today, my friends made me laugh."})
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "positive"
    assert body["degraded"] is True
    assert body["models_used"] == ["tfidf_lr"]
    assert math.isclose(sum(body["probabilities"].values()), 1.0, abs_tol=1e-3)
    assert -1 <= body["score"] <= 1


def test_ensemble_with_fake_transformer(client):
    original = main.registry.transformer
    main.registry.transformer = FakeTransformer()
    try:
        body = client.post("/v1/sentiment", json={"text": "I felt so sad, anxious and overwhelmed all day."}).json()
    finally:
        main.registry.transformer = original
    assert body["models_used"] == ["distilroberta", "tfidf_lr"]
    assert body["degraded"] is False
    assert body["weights"] == {"distilroberta": 0.7, "tfidf_lr": 0.3}
    assert body["emotions"]["joy"] == 0.8
    # transformer (weight .7) says positive, tfidf (weight .3) says negative -> transformer wins
    assert body["label"] == "positive"


def test_combine_renormalises_weights():
    out = combine([("a", 0.7, {"negative": 0, "neutral": 0, "positive": 1.0})])
    assert out["weights"] == {"a": 1.0}
    assert out["label"] == "positive" and out["score"] == 1.0


def test_embed_shape_and_unit_norm(client):
    r = client.post("/v1/embed", json={"texts": ["feeling stressed about exams", "went hiking with friends"]}).json()
    assert r["dim"] == 384 and r["degraded"] is True and r["model"].startswith("hashing-fallback")
    assert len(r["embeddings"]) == 2 and len(r["embeddings"][0]) == 384
    assert math.isclose(sum(x * x for x in r["embeddings"][0]), 1.0, abs_tol=1e-3)


def test_embed_similarity_orders_related_text_higher(client):
    vecs = client.post("/v1/embed", json={"texts": [
        "exam stress and anxiety about studying", "worried about my exam, so stressed studying", "baked bread and went hiking"]}).json()["embeddings"]
    dot = lambda a, b: sum(x * y for x, y in zip(a, b))
    assert dot(vecs[0], vecs[1]) > dot(vecs[0], vecs[2])


def test_analyze_returns_both(client):
    r = client.post("/v1/analyze", json={"text": "Today was an ordinary day, I did laundry."}).json()
    assert "label" in r["sentiment"] and len(r["embedding"]["embeddings"]) == 1


def test_blank_text_rejected(client):
    assert client.post("/v1/sentiment", json={"text": "   "}).status_code == 422


def test_api_key_enforced(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "secret", raising=False) if False else None
    object.__setattr__(main.settings, "api_key", "secret")
    try:
        assert client.post("/v1/sentiment", json={"text": "hi there"}).status_code == 401
        assert client.post("/v1/sentiment", json={"text": "hi there"}, headers={"X-API-Key": "secret"}).status_code == 200
        assert client.get("/health").status_code == 200   # health stays open for orchestrators
    finally:
        object.__setattr__(main.settings, "api_key", "")


def test_chunking_respects_limits():
    text = " ".join(f"Sentence number {i} is here." for i in range(400))
    chunks = chunk_text(text, max_chars=500, max_chunks=8)
    assert 1 < len(chunks) <= 8 and all(len(c) <= 500 for c in chunks)
