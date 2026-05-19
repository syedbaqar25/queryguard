import pytest
import torch
from torch.utils.data import DataLoader, TensorDataset

from src.model.trainer import Trainer
from src.model.transformer import CharTransformer


def make_loader(n: int = 64) -> DataLoader:
    x = torch.randint(0, 99, (n, 256))
    y = torch.randint(0, 2, (n,))
    return DataLoader(TensorDataset(x, y), batch_size=16)


def test_train_returns_history():
    model = CharTransformer(99, 32, 2, 1, 64, 256)
    result = Trainer(model, epochs=2, patience=5).train(make_loader(), make_loader())
    assert "history" in result
    assert len(result["history"]) >= 1


def test_best_val_f1_tracked():
    model = CharTransformer(99, 32, 2, 1, 64, 256)
    result = Trainer(model, epochs=2, patience=5).train(make_loader(), make_loader())
    assert 0.0 <= result["best_val_f1"] <= 1.0


def test_evaluate_returns_metrics():
    model = CharTransformer(99, 32, 2, 1, 64, 256)
    m = Trainer(model)._evaluate(make_loader())
    for k in ("accuracy", "precision", "recall", "f1"):
        assert k in m
        assert 0.0 <= m[k] <= 1.0


def test_early_stopping():
    model = CharTransformer(99, 32, 2, 1, 64, 256)
    result = Trainer(model, epochs=20, patience=2).train(make_loader(), make_loader())
    assert len(result["history"]) <= 20


def test_checkpoint_saved(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "weights").mkdir()
    model = CharTransformer(99, 32, 2, 1, 64, 256)
    Trainer(model, epochs=1).train(make_loader(), make_loader())
    assert (tmp_path / "weights" / "best_model.pt").exists()
