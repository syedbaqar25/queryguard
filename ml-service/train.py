#!/usr/bin/env python3
"""End-to-end training script for QueryGuard."""
import json
import os
import sys
import time
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))

from src.data.loader import SQLiV3Loader
from src.model.hybrid_detector import HybridDetector
from src.model.model_card import ModelCardGenerator
from src.model.onnx_exporter import ONNXExporter
from src.model.tokenizer import CharTokenizer
from src.model.trainer import Trainer
from src.model.transformer import CharTransformer
from src.utils.metrics_calc import compute_metrics, compute_per_attack_type_recall

WEIGHTS_DIR = os.getenv("WEIGHTS_DIR", "./weights")
Path(WEIGHTS_DIR).mkdir(exist_ok=True)


def evaluate(model: CharTransformer, tokenizer: CharTokenizer, loader) -> tuple[dict, list, list]:
    model.eval()
    preds_all: list[int] = []
    labels_all: list[int] = []
    with torch.no_grad():
        for x, y in loader:
            p = model(x).argmax(dim=-1).tolist()
            preds_all.extend(p)
            labels_all.extend(y.tolist())
    return compute_metrics(preds_all, labels_all), preds_all, labels_all


def main() -> None:
    t0 = time.time()
    print("=== QueryGuard Training ===\n")

    tokenizer = CharTokenizer()
    tokenizer.build_vocab()
    tokenizer.save(f"{WEIGHTS_DIR}/tokenizer_vocab.json")

    data_obj = SQLiV3Loader(tokenizer=tokenizer, batch_size=32)
    data = data_obj.load()
    stats = data["stats"]

    model = CharTransformer(
        vocab_size=tokenizer.vocab_size, d_model=64, nhead=4, num_layers=2, d_ff=128, max_len=256
    )
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    trainer = Trainer(model, lr=1e-3, epochs=30, patience=7, device="cpu")
    os.chdir(Path(__file__).parent)
    trainer.train(data["train_loader"], data["val_loader"])

    best = Path(f"{WEIGHTS_DIR}/best_model.pt")
    if best.exists():
        model.load_state_dict(torch.load(str(best), map_location="cpu"))
    model.eval()

    val_m, _, _ = evaluate(model, tokenizer, data["val_loader"])
    test_m, test_preds, test_labels = evaluate(model, tokenizer, data["test_loader"])
    bench_m, _, _ = evaluate(model, tokenizer, data["benchmark_loader"])

    test_atypes = [s.get("attack_type") for s in data["test_samples"]]
    per_attack = compute_per_attack_type_recall(test_preds, test_labels, test_atypes)

    val_queries = [s["query"] for s in data["val_samples"]]
    val_y = [0 if s["label"] == "SAFE" else 1 for s in data["val_samples"]]
    hybrid = HybridDetector(model, tokenizer)
    alpha = hybrid.calibrate_alpha(val_queries, val_y)
    hybrid.save_config(f"{WEIGHTS_DIR}/hybrid_config.json")
    print(f"Calibrated alpha: {alpha:.2f}")

    from src.model.sql_ast import ASTFeatureExtractor, ASTScorer
    ext = ASTFeatureExtractor()
    sc = ASTScorer()
    test_qs = [s["query"] for s in data["test_samples"]]
    test_ys = [0 if s["label"] == "SAFE" else 1 for s in data["test_samples"]]

    t_preds = [1 if model.predict(q, tokenizer)["malicious_prob"] > 0.5 else 0 for q in test_qs]
    a_preds = [1 if sc.score(ext.extract(q)) > 0.5 else 0 for q in test_qs]
    e_preds = [1 if hybrid.predict(q)["label"] == "MALICIOUS" else 0 for q in test_qs]

    ablation = {
        "transformer_only": compute_metrics(t_preds, test_ys),
        "ast_only": compute_metrics(a_preds, test_ys),
        "ensemble": compute_metrics(e_preds, test_ys),
    }
    with open(f"{WEIGHTS_DIR}/ablation_results.json", "w") as f:
        json.dump(ablation, f, indent=2)

    exporter = ONNXExporter(model, tokenizer, WEIGHTS_DIR)
    onnx_info = exporter.export()
    import json as _json
    with open(f"{WEIGHTS_DIR}/vocab.json", "w") as f:
        _json.dump(exporter.get_vocab_for_browser(), f)

    elapsed = time.time() - t0

    report = {
        "model_version": 1,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "dataset": {k: stats[k] for k in ["train", "val", "test", "benchmark"]},
        "val_metrics": val_m,
        "test_metrics": test_m,
        "benchmark_metrics": bench_m,
        "per_attack_type_recall": per_attack,
        "architecture": {
            "d_model": 64, "nhead": 4, "num_layers": 2, "d_ff": 128,
            "total_params": total_params,
        },
        "training_time_seconds": elapsed,
        "calibrated_alpha": alpha,
        "onnx_info": onnx_info,
    }
    with open(f"{WEIGHTS_DIR}/benchmark_report.json", "w") as f:
        json.dump(report, f, indent=2)

    ModelCardGenerator(WEIGHTS_DIR).save()

    print("\n┌──────────────┬──────────┬──────────┬────────────┐")
    print("│ Metric       │ Val      │ Test     │ Benchmark  │")
    print("├──────────────┼──────────┼──────────┼────────────┤")
    for metric, label in [("accuracy", "Accuracy"), ("precision", "Precision"),
                           ("recall", "Recall"), ("f1", "F1 Score")]:
        v, t, b = val_m.get(metric, 0), test_m.get(metric, 0), bench_m.get(metric, 0)
        print(f"│ {label:<12} │ {v:.4f}   │ {t:.4f}   │ {b:.4f}     │")
    print("└──────────────┴──────────┴──────────┴────────────┘")
    print(
        f"ONNX: {onnx_info['original_size_mb']:.1f}MB → "
        f"{onnx_info['quantized_size_mb']:.1f}MB (INT8) | "
        f"Params: {total_params:,} | Time: {elapsed:.0f}s"
    )


if __name__ == "__main__":
    main()
