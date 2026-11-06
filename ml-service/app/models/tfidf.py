"""TF-IDF + Logistic Regression baseline (fast, tiny, interpretable)."""
import logging
import os
from typing import Dict, Optional

log = logging.getLogger("ml.tfidf")
LABELS = ("negative", "neutral", "positive")


class TfidfSentiment:
    name = "tfidf_lr"

    def __init__(self, path: str):
        self.path = path
        self._pipe = None
        self.error: Optional[str] = None

    @property
    def ready(self) -> bool:
        return self._pipe is not None

    def load(self) -> bool:
        try:
            import joblib

            if not os.path.exists(self.path):
                raise FileNotFoundError(f"{self.path} not found - run `python train.py`")
            self._pipe = joblib.load(self.path)
            log.info("Loaded TF-IDF/LR model from %s", self.path)
            return True
        except Exception as exc:  # noqa: BLE001
            self.error = f"{type(exc).__name__}: {exc}"
            log.warning("TF-IDF model unavailable: %s", self.error)
            self._pipe = None
            return False

    def predict(self, text: str) -> Dict:
        if not self.ready:
            raise RuntimeError("tfidf model not loaded")
        proba = self._pipe.predict_proba([text])[0]
        probs = {l: 0.0 for l in LABELS}
        for c, p in zip(self._pipe.classes_, proba):
            probs[str(c)] = float(p)
        return {"probs": probs}
