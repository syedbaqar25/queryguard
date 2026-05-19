import pytest
import torch

from src.model.explainer import AttentionExplainer


@pytest.fixture
def explainer():
    return AttentionExplainer()


def _explain(explainer, model, tokenizer, query):
    tokens = tokenizer.encode(query, max_len=256)
    with torch.no_grad():
        _, attn = model(tokens.unsqueeze(0), return_attentions=True)
    return explainer.explain(query, attn)


def test_required_keys(explainer, trained_model, tokenizer):
    r = _explain(explainer, trained_model, tokenizer, "' OR 1=1--")
    for k in ("char_scores", "top_suspicious_span", "summary"):
        assert k in r


def test_char_scores_length(explainer, trained_model, tokenizer):
    q = "SELECT 1"
    assert len(_explain(explainer, trained_model, tokenizer, q)["char_scores"]) == len(q)


def test_scores_normalized(explainer, trained_model, tokenizer):
    r = _explain(explainer, trained_model, tokenizer, "' UNION SELECT--")
    assert all(0.0 <= cs["score"] <= 1.0 for cs in r["char_scores"])


def test_char_score_fields(explainer, trained_model, tokenizer):
    r = _explain(explainer, trained_model, tokenizer, "SELECT 1")
    for cs in r["char_scores"]:
        for f in ("char", "score", "position"):
            assert f in cs


def test_positions_sequential(explainer, trained_model, tokenizer):
    q = "HELLO"
    r = _explain(explainer, trained_model, tokenizer, q)
    assert [cs["position"] for cs in r["char_scores"]] == list(range(len(q)))


def test_summary_nonempty(explainer, trained_model, tokenizer):
    r = _explain(explainer, trained_model, tokenizer, "' OR 1=1--")
    assert isinstance(r["summary"], str) and len(r["summary"]) > 0
