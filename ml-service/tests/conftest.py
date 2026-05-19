import os

import pytest
import torch
from torch.utils.data import DataLoader, TensorDataset

from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer


@pytest.fixture(scope="session")
def tokenizer():
    t = CharTokenizer()
    t.build_vocab()
    return t


@pytest.fixture(scope="session")
def small_model(tokenizer):
    return CharTransformer(
        vocab_size=tokenizer.vocab_size,
        d_model=32,
        nhead=2,
        num_layers=1,
        d_ff=64,
        max_len=256,
    )


@pytest.fixture(scope="session")
def trained_model(tokenizer):
    m = CharTransformer(
        vocab_size=tokenizer.vocab_size,
        d_model=64,
        nhead=4,
        num_layers=2,
        d_ff=128,
        max_len=256,
    )
    if os.path.exists("weights/best_model.pt"):
        m.load_state_dict(torch.load("weights/best_model.pt", map_location="cpu"))
    m.eval()
    return m


@pytest.fixture
def tiny_dataloader():
    x = torch.randint(0, 99, (64, 256))
    y = torch.randint(0, 2, (64,))
    return DataLoader(TensorDataset(x, y), batch_size=32)
