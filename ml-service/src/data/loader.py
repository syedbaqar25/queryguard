"""Dataset loader — stratified 70/15/15 split + benchmark holdout."""
import random
from collections import Counter

from torch.utils.data import DataLoader

from src.data.dataset import SQLDataset
from src.data.sql_samples import SAMPLES
from src.model.tokenizer import CharTokenizer


class SQLiV3Loader:
    def __init__(
        self,
        tokenizer: CharTokenizer | None = None,
        batch_size: int = 32,
        seed: int = 42,
    ) -> None:
        self.tokenizer = tokenizer or CharTokenizer()
        if not self.tokenizer.char_to_idx:
            self.tokenizer.build_vocab()
        self.batch_size = batch_size
        self.seed = seed

    def load(self) -> dict:
        random.seed(self.seed)
        samples = list(SAMPLES)
        random.shuffle(samples)

        malicious = [s for s in samples if s["label"] == "MALICIOUS"]
        safe = [s for s in samples if s["label"] == "SAFE"]

        def split_class(items: list) -> tuple[list, list, list, list]:
            n = len(items)
            n_bench = max(1, int(n * 0.05))
            n_test = max(1, int(n * 0.15))
            n_val = max(1, int(n * 0.15))
            bench = items[:n_bench]
            test = items[n_bench : n_bench + n_test]
            val = items[n_bench + n_test : n_bench + n_test + n_val]
            train = items[n_bench + n_test + n_val :]
            return train, val, test, bench

        m_tr, m_v, m_te, m_b = split_class(malicious)
        s_tr, s_v, s_te, s_b = split_class(safe)

        train_s = m_tr + s_tr
        val_s = m_v + s_v
        test_s = m_te + s_te
        bench_s = m_b + s_b

        random.shuffle(train_s)
        random.shuffle(val_s)
        random.shuffle(test_s)

        stats = {
            "total": len(samples),
            "train": len(train_s),
            "val": len(val_s),
            "test": len(test_s),
            "benchmark": len(bench_s),
            "label_distribution": dict(Counter(s["label"] for s in samples)),
        }

        print(f"Dataset: {stats['total']} total — "
              f"train={stats['train']}, val={stats['val']}, "
              f"test={stats['test']}, benchmark={stats['benchmark']}")

        return {
            "train_loader": DataLoader(
                SQLDataset(train_s, self.tokenizer), batch_size=self.batch_size, shuffle=True
            ),
            "val_loader": DataLoader(
                SQLDataset(val_s, self.tokenizer), batch_size=self.batch_size
            ),
            "test_loader": DataLoader(
                SQLDataset(test_s, self.tokenizer), batch_size=self.batch_size
            ),
            "benchmark_loader": DataLoader(
                SQLDataset(bench_s, self.tokenizer), batch_size=self.batch_size
            ),
            "train_samples": train_s,
            "val_samples": val_s,
            "test_samples": test_s,
            "benchmark_samples": bench_s,
            "stats": stats,
        }
