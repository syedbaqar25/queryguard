import json

import pytest

from src.model.private_trainer import PrivateTrainer
from src.model.transformer import CharTransformer


def mk(eps: float = 10.0) -> PrivateTrainer:
    return PrivateTrainer(
        CharTransformer(99, 32, 2, 1, 64, 256),
        target_epsilon=eps,
        target_delta=1e-5,
        max_grad_norm=1.0,
        lr=1e-3,
    )


def test_engine_attached(tiny_dataloader):
    t = mk()
    t.train(tiny_dataloader, tiny_dataloader, epochs=1)
    assert t.privacy_engine is not None


def test_epsilon_tracked(tiny_dataloader):
    t = mk()
    t.train(tiny_dataloader, tiny_dataloader, epochs=2)
    assert len(t.epsilon_per_epoch) == 2


def test_epsilon_monotone(tiny_dataloader):
    t = mk()
    t.train(tiny_dataloader, tiny_dataloader, epochs=3)
    e = t.epsilon_per_epoch
    assert all(e[i] <= e[i + 1] + 1e-6 for i in range(len(e) - 1))


def test_noise_positive(tiny_dataloader):
    t = mk()
    t.train(tiny_dataloader, tiny_dataloader, epochs=1)
    assert t.noise_multiplier is not None and t.noise_multiplier > 0


def test_stricter_higher_noise(tiny_dataloader):
    ts = mk(0.5)
    ts.train(tiny_dataloader, tiny_dataloader, epochs=1)
    tl = mk(10.0)
    tl.train(tiny_dataloader, tiny_dataloader, epochs=1)
    assert ts.noise_multiplier > tl.noise_multiplier


def test_privacy_report_saved(tiny_dataloader, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "weights").mkdir()
    t = mk()
    t.train(tiny_dataloader, tiny_dataloader, epochs=1)
    with open(tmp_path / "weights" / "privacy_report.json") as f:
        r = json.load(f)
    assert "epsilon" in r and "noise_multiplier" in r
