import pytest

from src.model.hybrid_detector import HybridDetector


@pytest.fixture
def hybrid(trained_model, tokenizer):
    return HybridDetector(trained_model, tokenizer, alpha=0.7)


def test_predict_keys(hybrid):
    r = hybrid.predict("SELECT 1")
    for k in ("label", "confidence", "ensemble_malicious_prob", "transformer_score", "ast_score", "alpha"):
        assert k in r


def test_ensemble_malicious_in_range(hybrid):
    r = hybrid.predict("' UNION SELECT null--")
    assert 0.0 <= r["ensemble_malicious_prob"] <= 1.0


def test_transformer_score_present(hybrid):
    r = hybrid.predict("SELECT 1")
    assert "safe_prob" in r["transformer_score"]
    assert "malicious_prob" in r["transformer_score"]


def test_ast_score_has_features(hybrid):
    r = hybrid.predict("' OR 1=1--")
    assert "features" in r["ast_score"]
    assert len(r["ast_score"]["features"]) == 12


def test_safe_attack_type_none(hybrid):
    r = hybrid.predict("SELECT id FROM users WHERE id=1")
    if r["label"] == "SAFE":
        assert r["attack_type"] is None


def test_calibrate_alpha_in_range(hybrid, trained_model, tokenizer):
    qs = ["SELECT 1", "' OR 1=1--", "SELECT * FROM users", "'; DROP TABLE x--"]
    ys = [0, 1, 0, 1]
    alpha = hybrid.calibrate_alpha(qs, ys)
    assert 0.0 < alpha <= 1.0
