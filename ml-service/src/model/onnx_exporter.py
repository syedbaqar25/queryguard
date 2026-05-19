"""ONNX export with INT8 quantization and parity verification."""
import json
import os
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

from src.model.tokenizer import CharTokenizer
from src.model.transformer import CharTransformer


class ONNXExporter:
    def __init__(
        self,
        model: CharTransformer,
        tokenizer: CharTokenizer,
        weights_dir: str = "./weights",
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.weights_dir = Path(weights_dir)
        self.weights_dir.mkdir(parents=True, exist_ok=True)

    def export(self) -> dict:
        self.model.eval()
        onnx_path = str(self.weights_dir / "model.onnx")
        quantized_path = str(self.weights_dir / "model_quantized.onnx")

        dummy_input = torch.zeros(1, 256, dtype=torch.long)

        torch.onnx.export(
            self.model,
            dummy_input,
            onnx_path,
            opset_version=17,
            input_names=["input_ids"],
            output_names=["logits"],
            dynamic_axes={"input_ids": {0: "batch_size"}, "logits": {0: "batch_size"}},
        )

        onnx_model = onnx.load(onnx_path)
        onnx.checker.check_model(onnx_model)

        quantize_dynamic(onnx_path, quantized_path, weight_type=QuantType.QInt8)

        parity_verified = self._verify_parity(onnx_path)

        orig_mb = os.path.getsize(onnx_path) / (1024 * 1024)
        quant_mb = os.path.getsize(quantized_path) / (1024 * 1024)

        info: dict = {
            "onnx_path": onnx_path,
            "quantized_path": quantized_path,
            "original_size_mb": round(orig_mb, 3),
            "quantized_size_mb": round(quant_mb, 3),
            "compression_ratio": round(orig_mb / max(quant_mb, 1e-9), 2),
            "opset_version": 17,
            "parity_verified": parity_verified,
        }
        with open(self.weights_dir / "onnx_export_info.json", "w") as f:
            json.dump(info, f, indent=2)

        return info

    def _verify_parity(self, onnx_path: str) -> bool:
        queries = [
            "SELECT * FROM users WHERE id=1",
            "' UNION SELECT username,password FROM users--",
            "'; DROP TABLE users;--",
        ]
        sess = onnxruntime.InferenceSession(onnx_path)
        max_diff = 0.0

        for q in queries:
            tokens = self.tokenizer.encode(q, max_len=256)
            with torch.no_grad():
                pt_out = self.model(tokens.unsqueeze(0)).squeeze(0).numpy()

            ort_inp = tokens.numpy().reshape(1, -1).astype(np.int64)
            ort_out = sess.run(None, {"input_ids": ort_inp})[0].squeeze(0)
            diff = float(np.max(np.abs(pt_out - ort_out)))
            max_diff = max(max_diff, diff)

        return max_diff < 0.05

    def get_vocab_for_browser(self) -> dict:
        return {
            "char_to_idx": self.tokenizer.char_to_idx,
            "idx_to_char": {str(k): v for k, v in self.tokenizer.idx_to_char.items()},
            "vocab_size": self.tokenizer.vocab_size,
            "pad_token": 0,
            "unk_token": 1,
            "bos_token": 2,
            "eos_token": 3,
            "max_len": 256,
        }
