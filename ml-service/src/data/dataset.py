"""PyTorch dataset for SQL injection detection."""
import torch
from torch.utils.data import Dataset

from src.model.tokenizer import CharTokenizer


class SQLDataset(Dataset):
    def __init__(self, samples: list[dict], tokenizer: CharTokenizer, max_len: int = 256) -> None:
        self.samples = samples
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        sample = self.samples[idx]
        tokens = self.tokenizer.encode(sample["query"], max_len=self.max_len)
        label = torch.tensor(0 if sample["label"] == "SAFE" else 1, dtype=torch.long)
        return tokens, label
