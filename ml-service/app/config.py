"""Runtime configuration, read once from environment variables."""
import os
from dataclasses import dataclass


def _flag(name: str, default: str = "1") -> bool:
    return os.getenv(name, default).strip().lower() not in {"0", "false", "no", "off", ""}


@dataclass(frozen=True)
class Settings:
    transformer_model: str = os.getenv(
        "TRANSFORMER_MODEL", "j-hartmann/emotion-english-distilroberta-base"
    )
    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    embedding_dim: int = int(os.getenv("EMBEDDING_DIM", "384"))
    enable_transformer: bool = _flag("ENABLE_TRANSFORMER")
    enable_embedder: bool = _flag("ENABLE_EMBEDDER")
    weight_transformer: float = float(os.getenv("ENSEMBLE_WEIGHT_TRANSFORMER", "0.7"))
    tfidf_model_path: str = os.getenv("TFIDF_MODEL_PATH", "artifacts/tfidf_lr.joblib")
    api_key: str = os.getenv("ML_SERVICE_API_KEY", "")
    max_chars: int = int(os.getenv("MAX_TEXT_CHARS", "10000"))


settings = Settings()
