"""Active learning — uncertain queue, incremental retrain, zero-downtime hot-swap."""
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import torch
from torch.utils.data import DataLoader, TensorDataset

from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer

UNCERTAIN_THRESHOLD_LOW = 0.35
UNCERTAIN_THRESHOLD_HIGH = 0.65
RETRAIN_TRIGGER_COUNT = 20
MAX_QUEUE_SIZE = 500


class ActiveLearningManager:
    def __init__(
        self,
        model: CharTransformer,
        tokenizer: CharTokenizer,
        trainer_class: type,
        weights_dir: str = "./weights",
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.trainer_class = trainer_class
        self.weights_dir = Path(weights_dir)
        self.weights_dir.mkdir(parents=True, exist_ok=True)
        self.queue: list[dict] = []
        self._lock = threading.Lock()
        self.model_version: int = 1

    def should_queue(self, confidence: float) -> bool:
        return UNCERTAIN_THRESHOLD_LOW < confidence < UNCERTAIN_THRESHOLD_HIGH

    def add_to_queue(self, query: str, prediction: dict) -> bool:
        confidence = prediction.get("confidence", 1.0)
        if not self.should_queue(confidence):
            return False
        with self._lock:
            if len(self.queue) >= MAX_QUEUE_SIZE:
                return False
            entry = {
                "id": str(uuid.uuid4()),
                "query": query,
                "safe_prob": prediction.get("safe_prob", 0.5),
                "malicious_prob": prediction.get("malicious_prob", 0.5),
                "confidence": confidence,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "label": None,
            }
            self.queue.append(entry)
            with open(self.weights_dir / "uncertain_queue.jsonl", "a") as f:
                f.write(json.dumps(entry) + "\n")
        return True

    def label_entry(self, entry_id: str, label: str) -> dict:
        with self._lock:
            for entry in self.queue:
                if entry["id"] == entry_id:
                    entry["label"] = label
                    self._persist_queue()
                    return entry
        raise ValueError(f"Entry ID not found: {entry_id}")

    def _persist_queue(self) -> None:
        with open(self.weights_dir / "uncertain_queue.jsonl", "w") as f:
            for entry in self.queue:
                f.write(json.dumps(entry) + "\n")

    def get_queue(self, labeled: bool = False) -> list[dict]:
        with self._lock:
            if labeled:
                return [e for e in self.queue if e["label"] is not None]
            return list(self.queue)

    def labeled_count(self) -> int:
        with self._lock:
            return sum(1 for e in self.queue if e["label"] is not None)

    def trigger_retrain(self) -> dict:
        count = self.labeled_count()
        if count < RETRAIN_TRIGGER_COUNT:
            raise ValueError(
                f"Need at least {RETRAIN_TRIGGER_COUNT} labeled samples, have {count}"
            )

        with self._lock:
            labeled = [e for e in self.queue if e["label"] is not None]

        xs = [self.tokenizer.encode(e["query"], max_len=256) for e in labeled]
        ys = [0 if e["label"] == "SAFE" else 1 for e in labeled]

        x_t = torch.stack(xs)
        y_t = torch.tensor(ys, dtype=torch.long)

        split = max(1, int(len(xs) * 0.8))
        train_ds = TensorDataset(x_t[:split], y_t[:split])
        val_ds = TensorDataset(x_t[split:], y_t[split:])
        tl = DataLoader(train_ds, batch_size=min(16, len(train_ds)))
        vl = DataLoader(val_ds, batch_size=min(16, len(val_ds)))

        old_f1 = self._get_current_f1()

        new_model = CharTransformer(
            vocab_size=self.tokenizer.vocab_size,
            d_model=getattr(self.model, "d_model", 64),
            nhead=getattr(self.model, "nhead", 4),
            num_layers=getattr(self.model, "num_layers", 2),
            d_ff=128,
        )
        new_model.load_state_dict(self.model.state_dict())
        trainer = self.trainer_class(new_model, lr=1e-4, epochs=10, patience=3)
        result = trainer.train(tl, vl)
        new_f1 = result["best_val_f1"]
        improved = new_f1 > old_f1

        best_path = self.weights_dir / "best_model.pt"
        if improved and best_path.exists():
            self.hot_swap_model(str(best_path))
            self.model_version += 1

        entry = {
            "version": self.model_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "training_samples": len(labeled),
            "val_f1": new_f1,
            "val_accuracy": result["best_val_accuracy"],
            "trigger": "active_learning",
        }
        hist_path = self.weights_dir / "version_history.json"
        history: list = []
        if hist_path.exists():
            with open(hist_path) as f:
                history = json.load(f)
        history.append(entry)
        with open(hist_path, "w") as f:
            json.dump(history, f, indent=2)

        return {
            "success": True,
            "new_version": self.model_version,
            "old_f1": old_f1,
            "new_f1": new_f1,
            "improved": improved,
            "reason": "Improved" if improved else "No improvement — kept old weights",
        }

    def _get_current_f1(self) -> float:
        ckpt = self.weights_dir / "trainer_checkpoint.json"
        if ckpt.exists():
            with open(ckpt) as f:
                return json.load(f).get("val_f1", 0.0)
        return 0.0

    def hot_swap_model(self, path: str) -> bool:
        try:
            state_dict = torch.load(path, map_location="cpu")
            with self._lock:
                self.model.load_state_dict(state_dict)
            return True
        except Exception:
            return False

    def get_version_history(self) -> list:
        hist_path = self.weights_dir / "version_history.json"
        if hist_path.exists():
            with open(hist_path) as f:
                return json.load(f)
        return []
