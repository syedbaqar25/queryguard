import pytest
import torch

from src.model.transformer import CharTransformer


def test_forward_output_shape(small_model, tokenizer):
    x = torch.randint(0, tokenizer.vocab_size, (2, 256))
    assert small_model(x).shape == (2, 2)


def test_forward_attentions_returned(small_model, tokenizer):
    x = torch.randint(0, tokenizer.vocab_size, (1, 256))
    logits, attn = small_model(x, return_attentions=True)
    assert logits.shape == (1, 2)
    assert len(attn) == small_model.num_layers
    assert attn[0].shape == (1, small_model.nhead, 256, 256)


def test_predict_required_keys(small_model, tokenizer):
    r = small_model.predict("SELECT 1", tokenizer)
    for k in ("label", "confidence", "safe_prob", "malicious_prob", "attack_type", "latency_ms"):
        assert k in r


def test_predict_label_valid(small_model, tokenizer):
    assert small_model.predict("SELECT 1", tokenizer)["label"] in ("SAFE", "MALICIOUS")


def test_proba_sums_to_one(small_model, tokenizer):
    s, m = small_model.predict_proba("SELECT 1", tokenizer)
    assert abs(s + m - 1.0) < 1e-5


def test_confidence_in_range(small_model, tokenizer):
    r = small_model.predict("' OR 1=1--", tokenizer)
    assert 0.0 <= r["confidence"] <= 1.0


def test_latency_positive(small_model, tokenizer):
    assert small_model.predict("SELECT 1", tokenizer)["latency_ms"] > 0


def test_param_count(small_model):
    assert sum(p.numel() for p in small_model.parameters()) < 500_000


def test_trained_detects_injection(trained_model, tokenizer):
    r = trained_model.predict("' UNION SELECT username,password FROM users--", tokenizer)
    assert r["label"] == "MALICIOUS"
    assert r["confidence"] > 0.7


def test_trained_passes_safe(trained_model, tokenizer):
    r = trained_model.predict("SELECT id FROM users WHERE id=1", tokenizer)
    assert r["label"] == "SAFE"
    assert r["confidence"] > 0.6


def test_attack_type_union(trained_model, tokenizer):
    r = trained_model.predict("' UNION SELECT null--", tokenizer)
    if r["label"] == "MALICIOUS":
        assert r["attack_type"] == "UNION_BASED"


def test_attack_type_none_for_safe(trained_model, tokenizer):
    r = trained_model.predict("SELECT 1 FROM users WHERE id=1", tokenizer)
    if r["label"] == "SAFE":
        assert r["attack_type"] is None


def test_inference_deterministic(trained_model, tokenizer):
    q = "' OR 1=1--"
    r1 = trained_model.predict(q, tokenizer)
    r2 = trained_model.predict(q, tokenizer)
    assert r1["label"] == r2["label"]
    assert abs(r1["confidence"] - r2["confidence"]) < 0.01
