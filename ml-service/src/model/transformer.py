"""Character-level transformer — manual nn.ModuleList (NOT nn.TransformerEncoder)."""
import math
import re
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

from src.model.tokenizer import CharTokenizer

ATTACK_PATTERNS: dict[str, re.Pattern] = {
    "UNION_BASED": re.compile(r"\bUNION\b", re.IGNORECASE),
    "BOOLEAN_BLIND": re.compile(r"'\s*OR\s*'?1'?\s*=\s*'?1|OR\s+1\s*=\s*1", re.IGNORECASE),
    "TIME_BASED": re.compile(r"\b(SLEEP|WAITFOR|BENCHMARK)\s*\(", re.IGNORECASE),
    "ERROR_BASED": re.compile(r"\b(EXTRACTVALUE|UPDATEXML)\s*\(", re.IGNORECASE),
    "STACKED_QUERY": re.compile(r";\s*(DROP|INSERT|UPDATE|EXEC|EXECUTE)\b", re.IGNORECASE),
    "COMMAND_EXEC": re.compile(r"\bXP_CMDSHELL\b", re.IGNORECASE),
    "COMMENT_INJECTION": re.compile(r"--\s*$|#\s*$|\/\*", re.MULTILINE),
    "OBFUSCATED": re.compile(r"\/\*\*\/"),
}


class CharTransformer(nn.Module):
    def __init__(
        self,
        vocab_size: int = 99,
        d_model: int = 64,
        nhead: int = 4,
        num_layers: int = 2,
        d_ff: int = 128,
        dropout: float = 0.1,
        max_len: int = 256,
    ) -> None:
        super().__init__()
        self.d_model = d_model
        self.nhead = nhead
        self.num_layers = num_layers
        self.max_len = max_len

        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=0)

        # Sinusoidal positional encoding (not learned)
        pe = torch.zeros(1, max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float) * (-math.log(10000.0) / d_model)
        )
        pe[0, :, 0::2] = torch.sin(pos * div)
        pe[0, :, 1::2] = torch.cos(pos * div)
        self.register_buffer("positional_encoding", pe)

        # Manual nn.ModuleList — MUST NOT use nn.TransformerEncoder
        self.layers = nn.ModuleList()
        for _ in range(num_layers):
            layer = nn.ModuleDict(
                {
                    "self_attn": nn.MultiheadAttention(
                        d_model, nhead, dropout=dropout, batch_first=True
                    ),
                    "ff": nn.Sequential(
                        nn.Linear(d_model, d_ff),
                        nn.ReLU(),
                        nn.Dropout(dropout),
                        nn.Linear(d_ff, d_model),
                    ),
                    "norm1": nn.LayerNorm(d_model),
                    "norm2": nn.LayerNorm(d_model),
                    "drop": nn.Dropout(dropout),
                }
            )
            self.layers.append(layer)

        self.classifier = nn.Linear(d_model, 2)

    def forward(
        self, x: torch.Tensor, return_attentions: bool = False
    ) -> tuple | torch.Tensor:
        seq_len = x.size(1)
        out = self.embedding(x) + self.positional_encoding[:, :seq_len, :]

        attn_weights_list: list[torch.Tensor] = []

        for layer in self.layers:
            normed = layer["norm1"](out)
            attn_out, attn_w = layer["self_attn"](
                normed, normed, normed, need_weights=True, average_attn_weights=False
            )
            out = out + layer["drop"](attn_out)
            normed2 = layer["norm2"](out)
            out = out + layer["drop"](layer["ff"](normed2))
            attn_weights_list.append(attn_w)

        pooled = out.mean(dim=1)
        logits = self.classifier(pooled)

        if return_attentions:
            return logits, attn_weights_list
        return logits

    def predict(self, query: str, tokenizer: "CharTokenizer") -> dict:
        start = time.perf_counter()
        tokens = tokenizer.encode(query, max_len=self.max_len)
        with torch.no_grad():
            logits = self.forward(tokens.unsqueeze(0))
        probs = F.softmax(logits, dim=-1).squeeze(0)
        safe_prob = float(probs[0])
        malicious_prob = float(probs[1])
        label = "MALICIOUS" if malicious_prob > 0.5 else "SAFE"
        confidence = max(safe_prob, malicious_prob)
        latency_ms = (time.perf_counter() - start) * 1000.0

        attack_type: str | None = None
        if label == "MALICIOUS":
            for atype, pattern in ATTACK_PATTERNS.items():
                if pattern.search(query):
                    attack_type = atype
                    break

        return {
            "label": label,
            "confidence": confidence,
            "safe_prob": safe_prob,
            "malicious_prob": malicious_prob,
            "attack_type": attack_type,
            "latency_ms": latency_ms,
        }

    def predict_proba(self, query: str, tokenizer: "CharTokenizer") -> tuple[float, float]:
        tokens = tokenizer.encode(query, max_len=self.max_len)
        with torch.no_grad():
            logits = self.forward(tokens.unsqueeze(0))
        probs = F.softmax(logits, dim=-1).squeeze(0)
        return float(probs[0]), float(probs[1])
