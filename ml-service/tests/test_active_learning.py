import threading

import pytest

from src.model.active_learning import (
    MAX_QUEUE_SIZE,
    ActiveLearningManager,
)
from src.model.trainer import Trainer


@pytest.fixture
def mgr(trained_model, tokenizer, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "weights").mkdir()
    return ActiveLearningManager(trained_model, tokenizer, Trainer, str(tmp_path / "weights"))


def _p(conf: float) -> dict:
    return {
        "label": "MALICIOUS" if conf > 0.5 else "SAFE",
        "confidence": conf,
        "safe_prob": 1 - conf,
        "malicious_prob": conf,
    }


def test_uncertain_added(mgr):
    assert mgr.add_to_queue("SELECT 1", _p(0.52)) is True
    assert len(mgr.get_queue(labeled=False)) == 1


def test_confident_not_added(mgr):
    assert mgr.add_to_queue("' OR 1=1", _p(0.97)) is False


def test_label_entry(mgr):
    mgr.add_to_queue("q", _p(0.5))
    e = mgr.get_queue(labeled=False)[0]
    labeled = mgr.label_entry(e["id"], "MALICIOUS")
    assert labeled["label"] == "MALICIOUS"
    assert mgr.labeled_count() == 1


def test_invalid_id_raises(mgr):
    with pytest.raises(ValueError):
        mgr.label_entry("bad-id", "SAFE")


def test_retrain_needs_20(mgr):
    for i in range(19):
        mgr.add_to_queue(f"q{i}", _p(0.5))
        mgr.label_entry(mgr.get_queue(labeled=False)[-1]["id"], "SAFE")
    with pytest.raises(ValueError, match="20"):
        mgr.trigger_retrain()


def test_version_history_after_retrain(mgr):
    for i in range(20):
        mgr.add_to_queue(f"q{i}", _p(0.5))
        mgr.label_entry(mgr.get_queue(labeled=False)[-1]["id"], "MALICIOUS")
    result = mgr.trigger_retrain()
    assert "success" in result
    assert len(mgr.get_version_history()) >= 1


def test_thread_safe_add(mgr):
    threads = [
        threading.Thread(target=mgr.add_to_queue, args=(f"q{i}", _p(0.5)))
        for i in range(50)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(mgr.get_queue()) <= 50


def test_max_queue_size(mgr):
    for i in range(MAX_QUEUE_SIZE + 10):
        mgr.add_to_queue(f"q{i}", _p(0.5))
    assert len(mgr.get_queue()) <= MAX_QUEUE_SIZE
