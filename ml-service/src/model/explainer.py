"""Attention rollout explainer (Abnar & Zuidema 2020)."""
import numpy as np
import torch


class AttentionExplainer:
    def explain(self, query: str, attention_weights: list) -> dict:
        # attention_weights: list of (batch, nhead, seq, seq)
        weights = torch.stack(attention_weights, dim=0)  # (L, B, H, S, S)
        weights = weights[:, 0, :, :, :]  # (L, H, S, S)

        avg = weights.mean(dim=1).detach().cpu().numpy()  # (L, S, S)
        num_layers, seq_len, _ = avg.shape

        rollout = np.eye(seq_len)
        for i in range(num_layers):
            A = avg[i]
            A_hat = 0.5 * A + 0.5 * np.eye(seq_len)
            row_sums = A_hat.sum(axis=-1, keepdims=True)
            A_hat = A_hat / np.maximum(row_sums, 1e-9)
            rollout = A_hat @ rollout

        scores_raw = rollout[0, :]
        query_len = min(len(query), seq_len)
        raw = scores_raw[:query_len]
        mn, mx = raw.min(), raw.max()
        if mx - mn > 1e-9:
            normed = (raw - mn) / (mx - mn)
        else:
            normed = np.zeros_like(raw)

        char_scores = [
            {"char": query[i], "score": float(normed[i]), "position": i}
            for i in range(query_len)
        ]

        best_start, best_avg = 0, -1.0
        for i in range(max(1, query_len - 2)):
            w = float(np.mean(normed[i : i + 3]))
            if w > best_avg:
                best_avg, best_start = w, i
        top_span = query[best_start : best_start + 3]

        cap = min(seq_len, 64)
        matrix = rollout[:cap, :cap].tolist()

        top_idx = int(np.argmax(normed))
        top_end = min(top_idx + 3, query_len)
        summary = (
            f"Model focused on positions {top_idx}-{top_end - 1} "
            f"containing '{query[top_idx:top_end]}'"
        )

        return {
            "char_scores": char_scores,
            "top_suspicious_span": top_span,
            "attention_rollout_matrix": matrix,
            "summary": summary,
        }
