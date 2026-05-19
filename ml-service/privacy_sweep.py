#!/usr/bin/env python3
"""Privacy sweep: epsilon=[0.1, 0.5, 1.0, 5.0, 10.0]."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.data.loader import SQLiV3Loader
from src.model.private_trainer import PrivateTrainer
from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer

EPSILONS = [0.1, 0.5, 1.0, 5.0, 10.0]
WEIGHTS_DIR = "./weights"
Path(WEIGHTS_DIR).mkdir(exist_ok=True)


def main() -> None:
    tokenizer = CharTokenizer()
    tokenizer.build_vocab()
    loader = SQLiV3Loader(tokenizer=tokenizer, batch_size=32)
    data = loader.load()

    results = []
    print("\nPrivacy-Accuracy Tradeoff Sweep")
    print("=" * 50)
    print(f"{'Epsilon':>10} | {'Val F1':>10} | {'Noise Multi':>12}")
    print("-" * 40)

    for eps in EPSILONS:
        model = CharTransformer(
            vocab_size=tokenizer.vocab_size, d_model=32, nhead=2, num_layers=1, d_ff=64
        )
        trainer = PrivateTrainer(
            model,
            target_epsilon=eps,
            target_delta=1e-5,
            max_grad_norm=1.0,
            lr=1e-3,
            epochs=5,
            patience=3,
        )
        result = trainer.train(data["train_loader"], data["val_loader"])
        nm = trainer.noise_multiplier or 0.0
        results.append({"epsilon": eps, "val_f1": result["best_val_f1"], "noise_multiplier": nm})
        print(f"{eps:>10.1f} | {result['best_val_f1']:>10.4f} | {nm:>12.4f}")

    with open(f"{WEIGHTS_DIR}/privacy_sweep_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved to {WEIGHTS_DIR}/privacy_sweep_results.json")


if __name__ == "__main__":
    main()
