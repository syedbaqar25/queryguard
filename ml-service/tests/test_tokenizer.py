import torch

from src.model.tokenizer import CharTokenizer


def test_vocab_size_99(tokenizer):
    assert tokenizer.vocab_size == 99


def test_pad_is_0(tokenizer):
    assert tokenizer.char_to_idx["PAD"] == 0


def test_unk_is_1(tokenizer):
    assert tokenizer.char_to_idx["UNK"] == 1


def test_encode_length(tokenizer):
    assert tokenizer.encode("SELECT 1", max_len=256).shape == (256,)


def test_encode_pads(tokenizer):
    r = tokenizer.encode("A", max_len=10)
    assert r.dtype == torch.long
    assert r[1:].sum().item() == 0


def test_encode_truncates(tokenizer):
    assert tokenizer.encode("A" * 300, max_len=256).shape == (256,)


def test_decode_roundtrip(tokenizer):
    text = "SELECT * FROM users"
    assert tokenizer.decode(tokenizer.encode(text, max_len=256)) == text


def test_unknown_chars_unk(tokenizer):
    r = tokenizer.encode("你好", max_len=10)
    assert r[0].item() == tokenizer.char_to_idx["UNK"]
