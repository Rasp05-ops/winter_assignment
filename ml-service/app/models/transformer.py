"""DistilRoBERTa emotion classifier mapped onto a 3-way sentiment space.

`j-hartmann/emotion-english-distilroberta-base` is a DistilRoBERTa model with 7
emotion outputs. Journal text is about feelings, so emotions are a richer signal
than a plain pos/neg head; we collapse them to sentiment for the ensemble and also
return the emotion distribution for the UI.
"""
import logging
from typing import Dict, Optional

from ..text_utils import chunk_text

log = logging.getLogger("ml.transformer")

LABELS = ("negative", "neutral", "positive")

EMOTION_TO_SENTIMENT = {
    "joy": "positive",
    "surprise": "neutral",
    "neutral": "neutral",
    "anger": "negative",
    "disgust": "negative",
    "fear": "negative",
    "sadness": "negative",
}


class TransformerSentiment:
    name = "distilroberta"

    def __init__(self, model_name: str):
        self.model_name = model_name
        self._pipe = None
        self.error: Optional[str] = None

    @property
    def ready(self) -> bool:
        return self._pipe is not None

    def load(self) -> bool:
        try:
            from transformers import pipeline  # lazy: heavy import

            self._pipe = pipeline(
                "text-classification",
                model=self.model_name,
                top_k=None,
                truncation=True,
                max_length=512,
            )
            log.info("Loaded transformer %s", self.model_name)
            return True
        except Exception as exc:  # noqa: BLE001 - degrade on any failure
            self.error = f"{type(exc).__name__}: {exc}"
            log.warning("Transformer unavailable, running without it: %s", self.error)
            self._pipe = None
            return False

    def predict(self, text: str) -> Dict:
        """Returns {'probs': {neg,neu,pos}, 'emotions': {...}}, averaged over chunks."""
        if not self.ready:
            raise RuntimeError("transformer not loaded")
        chunks = chunk_text(text)
        raw = self._pipe(chunks)  # per chunk: list of {label, score}
        if raw and isinstance(raw[0], dict):
            raw = [raw]

        emotions: Dict[str, float] = {}
        for per_chunk in raw:
            for item in per_chunk:
                k = item["label"].lower()
                emotions[k] = emotions.get(k, 0.0) + item["score"]
        n = max(len(raw), 1)
        emotions = {k: v / n for k, v in emotions.items()}

        probs = {l: 0.0 for l in LABELS}
        for emo, p in emotions.items():
            probs[EMOTION_TO_SENTIMENT.get(emo, "neutral")] += p
        total = sum(probs.values()) or 1.0
        return {"probs": {k: v / total for k, v in probs.items()}, "emotions": emotions}
