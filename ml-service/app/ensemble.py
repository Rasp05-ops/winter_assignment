"""Weighted soft-voting ensemble over whichever sentiment models are available."""
from typing import Dict, List, Tuple

LABELS = ("negative", "neutral", "positive")


def combine(results: List[Tuple[str, float, Dict[str, float]]]) -> Dict:
    """results: [(model_name, weight, probs)]. Weights are re-normalised, so if the
    transformer is down the TF-IDF model simply carries 100% of the vote."""
    if not results:
        raise ValueError("no models available")
    total_w = sum(w for _, w, _ in results) or 1.0
    probs = {l: 0.0 for l in LABELS}
    for _, w, p in results:
        for l in LABELS:
            probs[l] += (w / total_w) * p.get(l, 0.0)
    label = max(probs, key=probs.get)
    return {
        "label": label,
        "score": round(probs["positive"] - probs["negative"], 4),  # -1 .. +1
        "confidence": round(probs[label], 4),
        "probabilities": {k: round(v, 4) for k, v in probs.items()},
        "weights": {name: round(w / total_w, 4) for name, w, _ in results},
    }
