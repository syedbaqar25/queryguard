"""Precision, recall, F1 — per-class and macro average."""


def compute_metrics(predictions: list[int], labels: list[int]) -> dict:
    tp = sum(p == 1 and l == 1 for p, l in zip(predictions, labels))
    fp = sum(p == 1 and l == 0 for p, l in zip(predictions, labels))
    fn = sum(p == 0 and l == 1 for p, l in zip(predictions, labels))
    tn = sum(p == 0 and l == 0 for p, l in zip(predictions, labels))

    n = max(len(labels), 1)
    accuracy = (tp + tn) / n
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-9)

    return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1,
            "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def compute_per_attack_type_recall(
    predictions: list[int],
    labels: list[int],
    attack_types: list[str | None],
) -> dict[str, float]:
    tp_by: dict[str, int] = {}
    fn_by: dict[str, int] = {}

    for pred, label, atype in zip(predictions, labels, attack_types):
        if label == 1 and atype:
            if atype not in tp_by:
                tp_by[atype] = 0
                fn_by[atype] = 0
            if pred == 1:
                tp_by[atype] += 1
            else:
                fn_by[atype] += 1

    return {
        atype: tp_by[atype] / max(tp_by[atype] + fn_by[atype], 1)
        for atype in tp_by
    }
