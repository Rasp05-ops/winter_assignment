"""Sentence embeddings for pgvector semantic search.

Primary: sentence-transformers (default all-MiniLM-L6-v2, 384-d).
Fallback: deterministic hashing embeddings of the same dimension so the pipeline keeps
working offline. These are lexical, not semantic, and are reported under a different model
name so the backend never mixes the two vector spaces.
"""
import logging
from typing import List, Optional

import numpy as np

from ..text_utils import chunk_text

log = logging.getLogger("ml.embedder")


class Embedder:
    def __init__(self, model_name: str, dim: int, enabled: bool = True):
        self.model_name = model_name
        self.dim = dim
        self.enabled = enabled
        self._model = None
        self._hasher = None
        self.error: Optional[str] = None

    @property
    def ready(self) -> bool:
        return self._model is not None

    @property
    def degraded(self) -> bool:
        return not self.ready

    @property
    def active_name(self) -> str:
        return self.model_name if self.ready else f"hashing-fallback-{self.dim}"

    def load(self) -> bool:
        if self.enabled:
            try:
                from sentence_transformers import SentenceTransformer

                model = SentenceTransformer(self.model_name)
                got = model.get_sentence_embedding_dimension()
                if got != self.dim:
                    raise ValueError(f"model dim {got} != EMBEDDING_DIM {self.dim}")
                self._model = model
                log.info("Loaded embedder %s (%d-d)", self.model_name, got)
            except Exception as exc:  # noqa: BLE001
                self.error = f"{type(exc).__name__}: {exc}"
                log.warning("Embedder unavailable, using hashing fallback: %s", self.error)
                self._model = None
        from sklearn.feature_extraction.text import HashingVectorizer

        self._hasher = HashingVectorizer(
            n_features=self.dim, alternate_sign=False, norm="l2",
            ngram_range=(1, 2), lowercase=True, stop_words="english",
        )
        return self.ready

    def _encode_one(self, text: str) -> np.ndarray:
        chunks = chunk_text(text, max_chars=900)
        if self.ready:
            vecs = self._model.encode(chunks, normalize_embeddings=True, show_progress_bar=False)
        else:
            vecs = self._hasher.transform(chunks).toarray()
        pooled = np.asarray(vecs, dtype=np.float32).mean(axis=0)
        norm = np.linalg.norm(pooled)
        return pooled / norm if norm > 0 else pooled

    def encode(self, texts: List[str]) -> List[List[float]]:
        return [self._encode_one(t).astype(float).tolist() for t in texts]
