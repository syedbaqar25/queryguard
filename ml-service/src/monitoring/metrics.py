"""Prometheus metrics for the ML service."""
from prometheus_client import Counter, Gauge, Histogram, generate_latest

PREDICTIONS_TOTAL = Counter(
    "queryguard_predictions_total",
    "Total predictions made",
    ["label", "attack_type"],
)

PREDICTION_LATENCY = Histogram(
    "queryguard_prediction_latency_ms",
    "Prediction latency in milliseconds",
    buckets=[10, 25, 50, 100, 200, 500, 1000],
)

CONFIDENCE_DISTRIBUTION = Histogram(
    "queryguard_confidence_score",
    "Distribution of prediction confidence scores",
    ["label"],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

UNCERTAIN_QUEUE_SIZE = Gauge(
    "queryguard_uncertain_queue_size",
    "Current size of the uncertain sample queue",
)

MODEL_VERSION = Gauge(
    "queryguard_model_version",
    "Current active model version",
)

FALSE_POSITIVE_ESTIMATE = Gauge(
    "queryguard_false_positive_rate_estimate",
    "Estimated false positive rate based on recent predictions",
)

__all__ = [
    "PREDICTIONS_TOTAL",
    "PREDICTION_LATENCY",
    "CONFIDENCE_DISTRIBUTION",
    "UNCERTAIN_QUEUE_SIZE",
    "MODEL_VERSION",
    "FALSE_POSITIVE_ESTIMATE",
    "generate_latest",
]
