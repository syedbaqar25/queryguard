"""FastAPI route handlers — 13 endpoints."""
import json
import time
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse, Response

from src.api.schemas import (
    ExplainRequest,
    ExplainResponse,
    LabelRequest,
    PredictRequest,
    PredictResponse,
    RetrainResponse,
)
from src.model.explainer import AttentionExplainer
from src.model.model_card import ModelCardGenerator
from src.model.onnx_exporter import ONNXExporter
from src.monitoring.metrics import (
    CONFIDENCE_DISTRIBUTION,
    MODEL_VERSION,
    PREDICTION_LATENCY,
    PREDICTIONS_TOTAL,
    UNCERTAIN_QUEUE_SIZE,
    generate_latest,
)

router = APIRouter()
_explainer = AttentionExplainer()

_hybrid_detector = None
_active_learning_manager = None
_tokenizer = None
_model = None
_weights_dir = "./weights"


def init_router(hybrid_detector, active_learning_manager, tokenizer, model, weights_dir="./weights"):
    global _hybrid_detector, _active_learning_manager, _tokenizer, _model, _weights_dir
    _hybrid_detector = hybrid_detector
    _active_learning_manager = active_learning_manager
    _tokenizer = tokenizer
    _model = model
    _weights_dir = weights_dir


@router.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    if _hybrid_detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    t0 = time.perf_counter()
    result = _hybrid_detector.predict(request.query)
    latency = (time.perf_counter() - t0) * 1000.0

    label = result["label"]
    attack_type = result.get("attack_type") or "none"

    PREDICTIONS_TOTAL.labels(label=label, attack_type=attack_type).inc()
    PREDICTION_LATENCY.observe(latency)
    CONFIDENCE_DISTRIBUTION.labels(label=label).observe(result["confidence"])

    if _active_learning_manager:
        _active_learning_manager.add_to_queue(request.query, result)
        UNCERTAIN_QUEUE_SIZE.set(len(_active_learning_manager.get_queue()))

    return PredictResponse(
        label=label,
        confidence=result["confidence"],
        safe_prob=result["transformer_score"]["safe_prob"],
        malicious_prob=result["transformer_score"]["malicious_prob"],
        attack_type=result.get("attack_type"),
        latency_ms=latency,
        transformer_score=result.get("transformer_score"),
        ast_score=result.get("ast_score"),
        ensemble_malicious_prob=result.get("ensemble_malicious_prob"),
        source="server",
    )


@router.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest):
    if _model is None or _tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    tokens = _tokenizer.encode(request.query, max_len=256)
    with torch.no_grad():
        logits, attn = _model(tokens.unsqueeze(0), return_attentions=True)

    probs = F.softmax(logits, dim=-1).squeeze(0)
    safe_prob = float(probs[0])
    mal_prob = float(probs[1])
    label = "MALICIOUS" if mal_prob > 0.5 else "SAFE"

    expl = _explainer.explain(request.query, attn)

    return ExplainResponse(
        prediction={
            "label": label,
            "confidence": max(safe_prob, mal_prob),
            "safe_prob": safe_prob,
            "malicious_prob": mal_prob,
        },
        char_scores=expl["char_scores"],
        top_suspicious_span=expl["top_suspicious_span"],
        summary=expl["summary"],
    )


@router.get("/health")
async def health():
    queue_size = len(_active_learning_manager.get_queue()) if _active_learning_manager else 0
    version = _active_learning_manager.model_version if _active_learning_manager else 1
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "model_version": version,
        "queue_size": queue_size,
    }


@router.get("/model-info")
async def model_info():
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    total_params = sum(p.numel() for p in _model.parameters())
    epsilon = None
    pp = Path(_weights_dir) / "privacy_report.json"
    if pp.exists():
        with open(pp) as f:
            epsilon = json.load(f).get("epsilon")

    ckpt = Path(_weights_dir) / "trainer_checkpoint.json"
    training_metrics: dict = {}
    if ckpt.exists():
        with open(ckpt) as f:
            training_metrics = json.load(f)

    return {
        "architecture": {
            "d_model": _model.d_model,
            "nhead": _model.nhead,
            "num_layers": _model.num_layers,
            "max_len": _model.max_len,
        },
        "vocab_size": _tokenizer.vocab_size if _tokenizer else 99,
        "total_params": total_params,
        "training_metrics": training_metrics,
        "privacy_epsilon": epsilon,
    }


@router.get("/uncertain-queue")
async def get_uncertain_queue(
    labeled: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    if _active_learning_manager is None:
        return {"items": [], "total": 0, "page": page, "limit": limit}
    items = _active_learning_manager.get_queue(labeled=labeled)
    total = len(items)
    start = (page - 1) * limit
    return {"items": items[start : start + limit], "total": total, "page": page, "limit": limit}


@router.post("/uncertain-queue/{entry_id}/label")
async def label_entry(entry_id: str, request: LabelRequest):
    if _active_learning_manager is None:
        raise HTTPException(status_code=503, detail="Active learning not initialized")
    try:
        entry = _active_learning_manager.label_entry(entry_id, request.label)
        UNCERTAIN_QUEUE_SIZE.set(len(_active_learning_manager.get_queue()))
        return entry
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/retrain", response_model=RetrainResponse)
async def retrain():
    if _active_learning_manager is None:
        raise HTTPException(status_code=503, detail="Active learning not initialized")
    try:
        result = _active_learning_manager.trigger_retrain()
        MODEL_VERSION.set(_active_learning_manager.model_version)
        return RetrainResponse(
            triggered=True,
            success=result.get("success"),
            reason=result.get("reason", ""),
            new_version=result.get("new_version"),
            old_f1=result.get("old_f1"),
            new_f1=result.get("new_f1"),
            improved=result.get("improved"),
        )
    except ValueError as e:
        return RetrainResponse(triggered=False, reason=str(e))


@router.get("/model-versions")
async def model_versions():
    if _active_learning_manager is None:
        return []
    return _active_learning_manager.get_version_history()


@router.post("/onnx/export")
async def onnx_export():
    if _model is None or _tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    exporter = ONNXExporter(_model, _tokenizer, _weights_dir)
    info = exporter.export()
    vocab = exporter.get_vocab_for_browser()
    with open(Path(_weights_dir) / "vocab.json", "w") as f:
        json.dump(vocab, f)
    return info


@router.get("/onnx/download")
async def onnx_download():
    path = Path(_weights_dir) / "model_quantized.onnx"
    if not path.exists():
        raise HTTPException(status_code=404, detail="ONNX model not exported yet")
    return FileResponse(str(path), media_type="application/octet-stream")


@router.get("/onnx/vocab")
async def onnx_vocab():
    path = Path(_weights_dir) / "vocab.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Vocab not exported yet")
    with open(path) as f:
        return json.load(f)


@router.get("/model-card")
async def model_card():
    content = ModelCardGenerator(_weights_dir).generate()
    return PlainTextResponse(content, media_type="text/markdown")


@router.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain; version=0.0.4")
