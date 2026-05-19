#!/usr/bin/env python3
"""Ablation: transformer-only vs AST-only vs HybridDetector."""
import json
import sys
import torch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.data.loader import SQLiV3Loader
from src.model.hybrid_detector import HybridDetector
from src.model.sql_ast import ASTFeatureExtractor, ASTScorer
from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer
from src.utils.metrics_calc import compute_metrics

WEIGHTS_DIR = "./weights"


def main() -> None:
    tokenizer = CharTokenizer()
    tokenizer.build_vocab()
    loader = SQLiV3Loader(tokenizer=tokenizer)
    data = loader.load()

    model = CharTransformer(
        vocab_size=tokenizer.vocab_size, d_model=64, nhead=4, num_layers=2, d_ff=128
    )
    wp = Path(f"{WEIGHTS_DIR}/best_model.pt")
    if wp.exists():
        model.load_state_dict(torch.load(str(wp), map_location="cpu"))
    model.eval()

    ext = ASTFeatureExtractor()
    sc = ASTScorer()
    hybrid = HybridDetector(model, tokenizer)

    qs = [s["query"] for s in data["test_samples"]]
    ys = [0 if s["label"] == "SAFE" else 1 for s in data["test_samples"]]

    t_preds = [1 if model.predict(q, tokenizer)["malicious_prob"] > 0.5 else 0 for q in qs]
    a_preds = [1 if sc.score(ext.extract(q)) > 0.5 else 0 for q in qs]
    e_preds = [1 if hybrid.predict(q)["label"] == "MALICIOUS" else 0 for q in qs]

    results = {
        "transformer_only": compute_metrics(t_preds, ys),
        "ast_only": compute_metrics(a_preds, ys),
        "ensemble": compute_metrics(e_preds, ys),
    }

    with open(f"{WEIGHTS_DIR}/ablation_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\nAblation Study Results")
    print("=" * 60)
    print(f"{'Method':<20} | {'Accuracy':>8} | {'F1':>8} | {'Recall':>8}")
    print("-" * 60)
    for method, m in results.items():
        print(f"{method:<20} | {m['accuracy']:>8.4f} | {m['f1']:>8.4f} | {m['recall']:>8.4f}")
    print(f"\nSaved to {WEIGHTS_DIR}/ablation_results.json")


if __name__ == "__main__":
    main()
