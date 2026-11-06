"""Journal entries can be long, but transformer encoders truncate at 256-512 tokens,
so we split into chunks and pool the predictions."""
import re
from typing import List

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def chunk_text(text: str, max_chars: int = 1200, max_chunks: int = 8) -> List[str]:
    """Greedy sentence packing into chunks of at most ~max_chars characters."""
    text = (text or "").strip()
    if not text:
        return [""]
    sentences = [s.strip() for s in _SENT_SPLIT.split(text) if s and s.strip()]
    chunks: List[str] = []
    current = ""
    for sent in sentences:
        while len(sent) > max_chars:  # hard-split a single huge "sentence"
            if current:
                chunks.append(current)
                current = ""
            chunks.append(sent[:max_chars])
            sent = sent[max_chars:]
        if len(current) + len(sent) + 1 > max_chars and current:
            chunks.append(current)
            current = sent
        else:
            current = f"{current} {sent}".strip()
    if current:
        chunks.append(current)
    return chunks[:max_chunks] or [text[:max_chars]]
