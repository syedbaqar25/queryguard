"""Auto model card generator — 7 sections, diff on update, flags low recall."""
import difflib
import json
from pathlib import Path

TEMPLATE = """\
# QueryGuard Model Card

## Model Details

- **Architecture**: Character-level Transformer (manual nn.ModuleList)
- **Parameters**: {total_params:,}
- **d_model**: {d_model}, **nhead**: {nhead}, **num_layers**: {num_layers}, **d_ff**: {d_ff}
- **Vocab size**: 99 (printable ASCII + special tokens)
- **Max sequence length**: 256
- **Version**: {model_version}
- **Trained at**: {trained_at}
- **Training time**: {training_time_seconds:.0f}s

## Intended Use

QueryGuard is designed to detect SQL injection attacks in web application query strings.
It is intended for use as a real-time security layer in backend API servers and proxies.

**In scope**: Single-line SQL query strings from HTTP request parameters, form fields, JSON bodies.
**Out of scope**: Binary data, stored procedure analysis, schema-level security audits.

## Training Data

- **Total samples**: {total_samples}
- **Train**: {train_samples}, **Val**: {val_samples}, **Test**: {test_samples}, **Benchmark holdout**: {benchmark_samples}
- **Sources**: SQLiV3 + OWASP Testing Guide payloads + synthetic safe queries
- **Attack types covered**: UNION_BASED, BOOLEAN_BLIND, TIME_BASED, ERROR_BASED, STACKED_QUERY, COMMAND_EXEC, COMMENT_INJECTION, OBFUSCATED (8 total)

## Evaluation Results

### Validation Set
| Metric    | Score  |
|-----------|--------|
| Accuracy  | {val_accuracy:.4f} |
| Precision | {val_precision:.4f} |
| Recall    | {val_recall:.4f} |
| F1        | {val_f1:.4f} |

### Test Set
| Metric    | Score  |
|-----------|--------|
| Accuracy  | {test_accuracy:.4f} |
| Precision | {test_precision:.4f} |
| Recall    | {test_recall:.4f} |
| F1        | {test_f1:.4f} |

### Benchmark Holdout
| Metric    | Score  |
|-----------|--------|
| Accuracy  | {bench_accuracy:.4f} |
| Precision | {bench_precision:.4f} |
| Recall    | {bench_recall:.4f} |
| F1        | {bench_f1:.4f} |

### Per Attack Type Recall
{per_attack_table}

## Privacy & Security

{privacy_section}

## Known Limitations

- Model may struggle with highly novel obfuscation techniques not seen during training.
- Character-level tokenization limits deep semantic SQL understanding.
- False positives possible for complex legitimate queries with unusual formatting.
{low_recall_section}

## Ethical Considerations

- This model is intended for **defensive** use only.
- Organizations must supplement ML-based detection with traditional WAF rules.
- Model decisions should be auditable — use the `/explain` endpoint for transparency.
- Users should review and label uncertain predictions to improve accuracy over time.
- The model does not store or log query content beyond what is configured in the audit log.
"""


class ModelCardGenerator:
    def __init__(self, weights_dir: str = "./weights") -> None:
        self.weights_dir = Path(weights_dir)

    def generate(self) -> str:
        bench_path = self.weights_dir / "benchmark_report.json"
        if not bench_path.exists():
            return "# QueryGuard Model Card\n\nNo training data available yet.\n"

        with open(bench_path) as f:
            bench = json.load(f)

        val_m = bench.get("val_metrics", {})
        test_m = bench.get("test_metrics", {})
        bench_m = bench.get("benchmark_metrics", {})
        arch = bench.get("architecture", {})
        ds = bench.get("dataset", {})
        per_attack = bench.get("per_attack_type_recall", {})

        rows = ["| Attack Type | Recall |", "|-------------|--------|"]
        for atype, recall in per_attack.items():
            rows.append(f"| {atype} | {recall:.4f} |")
        per_attack_table = "\n".join(rows) if len(rows) > 2 else "No per-attack data available."

        priv_path = self.weights_dir / "privacy_report.json"
        if priv_path.exists():
            with open(priv_path) as f:
                priv = json.load(f)
            nm = priv.get("noise_multiplier", 0)
            privacy_section = (
                f"- **Differential Privacy**: Yes (DP-SGD via Opacus)\n"
                f"- **ε (epsilon)**: {priv.get('epsilon', 'N/A')}\n"
                f"- **δ (delta)**: {priv.get('delta', 'N/A')}\n"
                f"- **Noise multiplier**: {nm:.4f}\n"
                f"- **Max grad norm**: {priv.get('max_grad_norm', 'N/A')}"
            )
        else:
            privacy_section = "No differential privacy applied."

        low_warnings = []
        for atype, recall in per_attack.items():
            if recall < 0.85:
                low_warnings.append(
                    f"- **{atype}**: Below 85% recall ({recall:.4f}) — may miss some variants."
                )
        low_recall_section = "\n".join(low_warnings)

        total = sum(ds.get(k, 0) for k in ["train", "val", "test", "benchmark"])

        return TEMPLATE.format(
            total_params=arch.get("total_params", 0),
            d_model=arch.get("d_model", 64),
            nhead=arch.get("nhead", 4),
            num_layers=arch.get("num_layers", 2),
            d_ff=arch.get("d_ff", 128),
            model_version=bench.get("model_version", 1),
            trained_at=bench.get("trained_at", "Unknown"),
            training_time_seconds=bench.get("training_time_seconds", 0),
            total_samples=total,
            train_samples=ds.get("train", 0),
            val_samples=ds.get("val", 0),
            test_samples=ds.get("test", 0),
            benchmark_samples=ds.get("benchmark", 0),
            val_accuracy=val_m.get("accuracy", 0),
            val_precision=val_m.get("precision", 0),
            val_recall=val_m.get("recall", 0),
            val_f1=val_m.get("f1", 0),
            test_accuracy=test_m.get("accuracy", 0),
            test_precision=test_m.get("precision", 0),
            test_recall=test_m.get("recall", 0),
            test_f1=test_m.get("f1", 0),
            bench_accuracy=bench_m.get("accuracy", 0),
            bench_precision=bench_m.get("precision", 0),
            bench_recall=bench_m.get("recall", 0),
            bench_f1=bench_m.get("f1", 0),
            per_attack_table=per_attack_table,
            privacy_section=privacy_section,
            low_recall_section=low_recall_section,
        )

    def save(self) -> dict:
        content = self.generate()

        bench_path = self.weights_dir / "benchmark_report.json"
        version = 1
        if bench_path.exists():
            with open(bench_path) as f:
                version = json.load(f).get("model_version", 1)

        main_path = self.weights_dir / "MODEL_CARD.md"
        versioned_path = self.weights_dir / f"model_card_v{version}.md"

        old_content = ""
        if main_path.exists():
            with open(main_path) as f:
                old_content = f.read()

        diff_lines = list(
            difflib.unified_diff(
                old_content.splitlines(keepends=True),
                content.splitlines(keepends=True),
                fromfile="MODEL_CARD.md (old)",
                tofile="MODEL_CARD.md (new)",
            )
        )[:50]

        with open(main_path, "w") as f:
            f.write(content)
        with open(versioned_path, "w") as f:
            f.write(content)

        return {
            "saved_to": str(main_path),
            "version": version,
            "diff_lines": diff_lines,
            "has_changes": bool(diff_lines),
        }
