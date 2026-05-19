"""DP-SGD training via Opacus — epsilon tracking, noise multiplier, privacy report."""
import json
from pathlib import Path

import torch
from opacus import PrivacyEngine
from opacus.utils.batch_memory_manager import BatchMemoryManager
from opacus.validators import ModuleValidator
from torch.utils.data import DataLoader

from src.model.trainer import Trainer
from src.model.transformer import CharTransformer


class PrivateTrainer(Trainer):
    def __init__(
        self,
        model: CharTransformer,
        target_epsilon: float = 1.0,
        target_delta: float = 1e-5,
        max_grad_norm: float = 1.0,
        lr: float = 1e-3,
        epochs: int = 30,
        patience: int = 5,
        weight_decay: float = 1e-4,
        device: str = "cpu",
    ) -> None:
        self.target_epsilon = target_epsilon
        self.target_delta = target_delta
        self.max_grad_norm = max_grad_norm
        self.privacy_engine: PrivacyEngine | None = None
        self.epsilon_per_epoch: list[float] = []
        self.noise_multiplier: float | None = None
        super().__init__(model, lr, epochs, patience, weight_decay, device)

    def _make_model_dp_compatible(self) -> None:
        errors = ModuleValidator.validate(self.model, strict=False)
        if errors:
            self.model = ModuleValidator.fix(self.model)
        self.model = self.model.to(self.device)

    def _attach_privacy_engine(
        self, train_loader: DataLoader, epochs: int
    ) -> tuple:
        self._make_model_dp_compatible()
        optimizer = torch.optim.AdamW(
            self.model.parameters(), lr=self.lr, weight_decay=self.weight_decay
        )
        self.privacy_engine = PrivacyEngine()
        private_model, private_optimizer, private_loader = (
            self.privacy_engine.make_private_with_epsilon(
                module=self.model,
                optimizer=optimizer,
                data_loader=train_loader,
                target_epsilon=self.target_epsilon,
                target_delta=self.target_delta,
                max_grad_norm=self.max_grad_norm,
                epochs=epochs,
            )
        )
        self.noise_multiplier = float(private_optimizer.noise_multiplier)
        return private_model, private_optimizer, private_loader

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int | None = None,
    ) -> dict:
        import torch.nn as nn

        n_epochs = epochs if epochs is not None else self.epochs
        private_model, private_optimizer, private_loader = self._attach_privacy_engine(
            train_loader, n_epochs
        )
        criterion = nn.CrossEntropyLoss()
        no_improve = 0

        max_phys = max(1, len(train_loader.dataset) // max(len(train_loader), 1))

        for epoch in range(n_epochs):
            private_model.train()
            train_loss = 0.0

            with BatchMemoryManager(
                data_loader=private_loader,
                max_physical_batch_size=max_phys,
                optimizer=private_optimizer,
            ) as mem_loader:
                for x, y in mem_loader:
                    x, y = x.to(self.device), y.to(self.device)
                    private_optimizer.zero_grad()
                    logits = private_model(x)
                    loss = criterion(logits, y)
                    loss.backward()
                    private_optimizer.step()
                    train_loss += loss.item()

            train_loss /= max(len(train_loader), 1)
            eps = self.privacy_engine.get_epsilon(self.target_delta)
            self.epsilon_per_epoch.append(float(eps))

            val_metrics = self._evaluate(val_loader)
            record = {
                "epoch": epoch + 1,
                "train_loss": train_loss,
                "epsilon": float(eps),
                **{f"val_{k}": v for k, v in val_metrics.items()},
            }
            self.history.append(record)

            if val_metrics["f1"] > self.best_val_f1:
                self.best_val_f1 = val_metrics["f1"]
                self.best_val_accuracy = val_metrics["accuracy"]
                no_improve = 0
                Path("weights").mkdir(exist_ok=True)
                torch.save(private_model._module.state_dict(), "weights/best_model.pt")
            else:
                no_improve += 1
                if no_improve >= self.patience:
                    break

        Path("weights").mkdir(exist_ok=True)
        final_eps = self.privacy_engine.get_epsilon(self.target_delta)
        report = {
            "epsilon": float(final_eps),
            "delta": self.target_delta,
            "noise_multiplier": self.noise_multiplier,
            "max_grad_norm": self.max_grad_norm,
            "epsilon_per_epoch": self.epsilon_per_epoch,
        }
        with open("weights/privacy_report.json", "w") as f:
            json.dump(report, f, indent=2)

        return {
            "history": self.history,
            "best_val_f1": self.best_val_f1,
            "best_val_accuracy": self.best_val_accuracy,
            "epsilon": float(final_eps),
        }
