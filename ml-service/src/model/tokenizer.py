"""Character-level tokenizer for SQL injection detection."""
import json
import string
from pathlib import Path

import torch


class CharTokenizer:
    """
    99-token vocab: PAD=0, UNK=1, BOS=2, EOS=3, printable ASCII 32-126 (95 chars).
    """

    PAD = 0
    UNK = 1
    BOS = 2
    EOS = 3

    def __init__(self) -> None:
        self.char_to_idx: dict[str, int] = {}
        self.idx_to_char: dict[int, str] = {}
        self.vocab_size: int = 99

    def build_vocab(self) -> None:
        self.char_to_idx = {"PAD": 0, "UNK": 1, "BOS": 2, "EOS": 3}
        # printable ASCII 32-126 = 95 chars mapped to indices 4-98
        for i, ch in enumerate(string.printable[:95]):
            self.char_to_idx[ch] = i + 4
        self.idx_to_char = {v: k for k, v in self.char_to_idx.items()}
        assert len(self.char_to_idx) == 99, f"Expected 99, got {len(self.char_to_idx)}"

    def encode(self, text: str, max_len: int = 256) -> torch.Tensor:
        tokens = [self.char_to_idx.get(ch, self.UNK) for ch in text[:max_len]]
        tokens += [self.PAD] * (max_len - len(tokens))
        return torch.tensor(tokens, dtype=torch.long)

    def decode(self, tensor: torch.Tensor) -> str:
        chars: list[str] = []
        for idx in tensor.tolist():
            if idx == self.PAD:
                break
            ch = self.idx_to_char.get(idx, "")
            if ch not in ("PAD", "UNK", "BOS", "EOS") and ch:
                chars.append(ch)
        return "".join(chars)

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.char_to_idx, f)

    def load(self, path: str) -> None:
        with open(path) as f:
            self.char_to_idx = json.load(f)
        self.idx_to_char = {v: k for k, v in self.char_to_idx.items()}
        self.vocab_size = len(self.char_to_idx)
