import json
from pathlib import Path

import pytest

from src.model.model_card import ModelCardGenerator


@pytest.fixture
def wd(tmp_path):
    json.dump(
        {
            "model_version": 2,
            "trained_at": "2025-01-15T10:00:00",
            "dataset": {"train": 840, "val": 180, "test": 180, "benchmark": 120},
            "val_metrics": {"accuracy": 0.94, "precision": 0.93, "recall": 0.96, "f1": 0.945},
            "test_metrics": {"accuracy": 0.91, "precision": 0.90, "recall": 0.93, "f1": 0.915},
            "benchmark_metrics": {"accuracy": 0.89, "precision": 0.88, "recall": 0.91, "f1": 0.895},
            "per_attack_type_recall": {"UNION_BASED": 0.97, "OBFUSCATED": 0.78},
            "architecture": {
                "d_model": 64, "nhead": 4, "num_layers": 2, "d_ff": 128, "total_params": 198432
            },
            "training_time_seconds": 187,
        },
        open(tmp_path / "benchmark_report.json", "w"),
    )
    json.dump(
        {"epsilon": 1.0, "delta": 1e-5, "noise_multiplier": 1.1, "max_grad_norm": 1.0},
        open(tmp_path / "privacy_report.json", "w"),
    )
    json.dump(
        [{"version": 1, "timestamp": "2025-01-10", "val_f1": 0.91, "training_samples": 840, "trigger": "initial"}],
        open(tmp_path / "version_history.json", "w"),
    )
    return tmp_path


def test_all_sections(wd):
    c = ModelCardGenerator(str(wd)).generate()
    for s in [
        "## Model Details",
        "## Intended Use",
        "## Training Data",
        "## Evaluation Results",
        "## Privacy & Security",
        "## Known Limitations",
        "## Ethical Considerations",
    ]:
        assert s in c, f"Missing section: {s}"


def test_benchmark_f1(wd):
    assert "0.895" in ModelCardGenerator(str(wd)).generate()


def test_low_recall_flagged(wd):
    c = ModelCardGenerator(str(wd)).generate()
    assert "OBFUSCATED" in c and "Below 85%" in c


def test_privacy_section(wd):
    c = ModelCardGenerator(str(wd)).generate()
    assert "1.0" in c  # epsilon value


def test_save_creates_md(wd):
    assert Path(ModelCardGenerator(str(wd)).save()["saved_to"]).exists()


def test_versioned_file(wd):
    ModelCardGenerator(str(wd)).save()
    assert (wd / "model_card_v2.md").exists()


def test_diff_on_update(wd):
    gen = ModelCardGenerator(str(wd))
    gen.save()
    r = json.load(open(wd / "benchmark_report.json"))
    r["val_metrics"]["f1"] = 0.960
    json.dump(r, open(wd / "benchmark_report.json", "w"))
    assert ModelCardGenerator(str(wd)).save()["has_changes"] is True


def test_no_privacy_without_report(tmp_path):
    json.dump(
        {"model_version": 1, "dataset": {}, "val_metrics": {}, "test_metrics": {}, "benchmark_metrics": {}},
        open(tmp_path / "benchmark_report.json", "w"),
    )
    assert "No differential privacy" in ModelCardGenerator(str(tmp_path)).generate()
