"""Training loop — AdamW, CrossEntropy, early stopping by val F1."""
import json
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.model.transformer import CharTransformer


class Trainer:
    def __init__(
        self,
        model: CharTransformer,
        lr: float = 1e-3,
        epochs: int = 30,
        patience: int = 5,
        weight_decay: float = 1e-4,
        device: str = "cpu",
    ) -> None:
        self.model = model.to(device)
        self.lr = lr
        self.epochs = epochs
        self.patience = patience
        self.weight_decay = weight_decay
        self.device = device
        self.history: list[dict] = []
        self.best_val_f1: float = 0.0
        self.best_val_accuracy: float = 0.0

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int | None = None,
    ) -> dict:
        n_epochs = epochs if epochs is not None else self.epochs
        optimizer = torch.optim.AdamW(
            self.model.parameters(), lr=self.lr, weight_decay=self.weight_decay
        )
        criterion = nn.CrossEntropyLoss()
        no_improve = 0

        for epoch in range(n_epochs):
            self.model.train()
            train_loss = 0.0
            for x, y in train_loader:
                x, y = x.to(self.device), y.to(self.device)
                optimizer.zero_grad()
                logits = self.model(x)
                loss = criterion(logits, y)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()

            train_loss /= max(len(train_loader), 1)
            val_metrics = self._evaluate(val_loader)

            record = {
                "epoch": epoch + 1,
                "train_loss": train_loss,
                **{f"val_{k}": v for k, v in val_metrics.items()},
            }
            self.history.append(record)

            if val_metrics["f1"] > self.best_val_f1:
                self.best_val_f1 = val_metrics["f1"]
                self.best_val_accuracy = val_metrics["accuracy"]
                no_improve = 0
                self._save_checkpoint(epoch=epoch + 1, val_f1=self.best_val_f1)
            else:
                no_improve += 1
                if no_improve >= self.patience:
                    break

        return {
            "history": self.history,
            "best_val_f1": self.best_val_f1,
            "best_val_accuracy": self.best_val_accuracy,
        }

    def _evaluate(self, loader: DataLoader) -> dict:
        self.model.eval()
        all_preds: list[int] = []
        all_labels: list[int] = []
        with torch.no_grad():
            for x, y in loader:
                x = x.to(self.device)
                preds = self.model(x).argmax(dim=-1).cpu().tolist()
                all_preds.extend(preds)
                all_labels.extend(y.tolist())

        tp = sum(p == 1 and l == 1 for p, l in zip(all_preds, all_labels))
        fp = sum(p == 1 and l == 0 for p, l in zip(all_preds, all_labels))
        fn = sum(p == 0 and l == 1 for p, l in zip(all_preds, all_labels))
        tn = sum(p == 0 and l == 0 for p, l in zip(all_preds, all_labels))

        n = max(len(all_labels), 1)
        accuracy = (tp + tn) / n
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)

        return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}

    def _save_checkpoint(self, **kwargs: object) -> None:
        Path("weights").mkdir(exist_ok=True)
        torch.save(self.model.state_dict(), "weights/best_model.pt")
        with open("weights/trainer_checkpoint.json", "w") as f:
            json.dump(kwargs, f)
