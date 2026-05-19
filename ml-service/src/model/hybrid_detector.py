"""Hybrid detector — transformer + AST ensemble with alpha calibration."""
import json

from src.model.sql_ast import ASTFeatureExtractor, ASTScorer
from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer


class HybridDetector:
    def __init__(
        self,
        transformer: CharTransformer,
        tokenizer: CharTokenizer,
        alpha: float = 0.7,
    ) -> None:
        self.transformer = transformer
        self.tokenizer = tokenizer
        self.alpha = alpha
        self.extractor = ASTFeatureExtractor()
        self.scorer = ASTScorer()

    def predict(self, query: str) -> dict:
        t_result = self.transformer.predict(query, self.tokenizer)
        t_mal = t_result["malicious_prob"]
        t_safe = t_result["safe_prob"]

        features = self.extractor.extract(query)
        ast_score = self.scorer.score(features)

        ens_mal = min(max(self.alpha * t_mal + (1 - self.alpha) * ast_score, 0.0), 1.0)
        ens_safe = 1.0 - ens_mal

        label = "MALICIOUS" if ens_mal > 0.5 else "SAFE"
        confidence = max(ens_mal, ens_safe)
        attack_type = t_result.get("attack_type") if label == "MALICIOUS" else None

        return {
            "label": label,
            "confidence": confidence,
            "ensemble_malicious_prob": ens_mal,
            "transformer_score": {"safe_prob": t_safe, "malicious_prob": t_mal},
            "ast_score": {
                "malicious_prob": ast_score,
                "features": {
                    "union_count": features.union_count,
                    "comment_count": features.comment_count,
                    "tautology_present": features.tautology_present,
                    "dangerous_keyword_count": features.dangerous_keyword_count,
                    "stacked_query_count": features.stacked_query_count,
                    "subquery_depth": features.subquery_depth,
                    "string_comparison_count": features.string_comparison_count,
                    "hex_literal_present": features.hex_literal_present,
                    "char_function_present": features.char_function_present,
                    "time_function_present": features.time_function_present,
                    "always_true_condition": features.always_true_condition,
                    "quote_count": features.quote_count,
                },
            },
            "alpha": self.alpha,
            "attack_type": attack_type,
        }

    def calibrate_alpha(self, val_queries: list[str], val_labels: list[int]) -> float:
        best_alpha, best_f1 = self.alpha, -1.0
        for a_int in range(1, 10):
            alpha = a_int / 10.0
            preds = []
            for q in val_queries:
                t = self.transformer.predict(q, self.tokenizer)
                feat = self.extractor.extract(q)
                ast = self.scorer.score(feat)
                ens = alpha * t["malicious_prob"] + (1 - alpha) * ast
                preds.append(1 if ens > 0.5 else 0)

            tp = sum(p == 1 and l == 1 for p, l in zip(preds, val_labels))
            fp = sum(p == 1 and l == 0 for p, l in zip(preds, val_labels))
            fn = sum(p == 0 and l == 1 for p, l in zip(preds, val_labels))
            prec = tp / max(tp + fp, 1)
            rec = tp / max(tp + fn, 1)
            f1 = 2 * prec * rec / max(prec + rec, 1e-9)
            if f1 > best_f1:
                best_f1, best_alpha = f1, alpha

        self.alpha = best_alpha
        return best_alpha

    def save_config(self, path: str) -> None:
        with open(path, "w") as f:
            json.dump({"alpha": self.alpha, "type": "hybrid_detector_v1"}, f, indent=2)
