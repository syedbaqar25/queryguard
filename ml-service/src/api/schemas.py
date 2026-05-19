"""Pydantic v2 request/response schemas."""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


class PredictResponse(BaseModel):
    label: str
    confidence: float
    safe_prob: float
    malicious_prob: float
    attack_type: Optional[str] = None
    latency_ms: float
    transformer_score: Optional[dict] = None
    ast_score: Optional[dict] = None
    ensemble_malicious_prob: Optional[float] = None
    source: str = "server"


class ExplainRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


class CharScore(BaseModel):
    char: str
    score: float
    position: int


class ExplainResponse(BaseModel):
    prediction: dict
    char_scores: list[CharScore]
    top_suspicious_span: str
    summary: str


class LabelRequest(BaseModel):
    label: Literal["SAFE", "MALICIOUS"]


class RetrainResponse(BaseModel):
    triggered: bool
    success: Optional[bool] = None
    reason: str
    new_version: Optional[int] = None
    old_f1: Optional[float] = None
    new_f1: Optional[float] = None
    improved: Optional[bool] = None
