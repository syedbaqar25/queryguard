import json
from pathlib import Path

import numpy as np
import onnxruntime
import pytest

from src.model.onnx_exporter import ONNXExporter


def exp(sm, tok, tp):
    return ONNXExporter(sm, tok, str(tp))


def test_onnx_created(small_model, tokenizer, tmp_path):
    assert Path(exp(small_model, tokenizer, tmp_path).export()["onnx_path"]).exists()


def test_quantized_created(small_model, tokenizer, tmp_path):
    assert Path(exp(small_model, tokenizer, tmp_path).export()["quantized_path"]).exists()


def test_quantized_smaller(small_model, tokenizer, tmp_path):
    info = exp(small_model, tokenizer, tmp_path).export()
    assert info["quantized_size_mb"] < info["original_size_mb"]


def test_onnx_inference_shape(small_model, tokenizer, tmp_path):
    info = exp(small_model, tokenizer, tmp_path).export()
    sess = onnxruntime.InferenceSession(info["quantized_path"])
    inp = tokenizer.encode("SELECT 1", max_len=256).numpy().reshape(1, -1).astype(np.int64)
    assert sess.run(None, {"input_ids": inp})[0].shape == (1, 2)


def test_parity(small_model, tokenizer, tmp_path):
    assert exp(small_model, tokenizer, tmp_path).export()["parity_verified"] is True


def test_export_info_json(small_model, tokenizer, tmp_path):
    exp(small_model, tokenizer, tmp_path).export()
    with open(tmp_path / "onnx_export_info.json") as f:
        d = json.load(f)
    assert d["opset_version"] == 17 and "compression_ratio" in d


def test_vocab_keys(small_model, tokenizer, tmp_path):
    v = exp(small_model, tokenizer, tmp_path).get_vocab_for_browser()
    for k in ("char_to_idx", "vocab_size", "pad_token", "max_len"):
        assert k in v
    assert v["pad_token"] == 0 and v["max_len"] == 256
