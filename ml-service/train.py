"""Train the TF-IDF + Logistic Regression baseline.

    python train.py                         # uses data/seed_journal_sentiment.csv
    python train.py --data my_labels.csv    # CSV with columns: text,label (negative|neutral|positive)
"""
import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

LABELS = ["negative", "neutral", "positive"]


def train(data: str = "data/seed_journal_sentiment.csv", out_path: str = "artifacts/tfidf_lr.joblib",
          test_size: float = 0.2) -> None:
    df = pd.read_csv(data).dropna(subset=["text", "label"])
    df["label"] = df["label"].str.lower().str.strip()
    bad = set(df["label"]) - set(LABELS)
    if bad:
        raise SystemExit(f"unknown labels in data: {bad}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        df["text"], df["label"], test_size=test_size, stratify=df["label"], random_state=42
    )
    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, strip_accents="unicode")),
        ("clf", LogisticRegression(C=4.0, max_iter=1000, class_weight="balanced")),
    ])
    pipe.fit(X_tr, y_tr)

    report = classification_report(y_te, pipe.predict(X_te), labels=LABELS, output_dict=True, zero_division=0)
    print(classification_report(y_te, pipe.predict(X_te), labels=LABELS, zero_division=0))

    # refit on everything for the shipped artifact
    pipe.fit(df["text"], df["label"])
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, out)
    (out.parent / "tfidf_lr.metrics.json").write_text(json.dumps(
        {"rows": len(df), "holdout_accuracy": report["accuracy"], "holdout_macro_f1": report["macro avg"]["f1-score"]}, indent=2))
    print(f"saved -> {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/seed_journal_sentiment.csv")
    ap.add_argument("--out", default="artifacts/tfidf_lr.joblib")
    ap.add_argument("--test-size", type=float, default=0.2)
    args = ap.parse_args()
    train(args.data, args.out, args.test_size)


if __name__ == "__main__":
    main()
