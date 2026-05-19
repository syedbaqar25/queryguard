"""FastAPI application — loads/trains model on startup."""
import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI

from src.api.routes import init_router, router
from src.model.active_learning import ActiveLearningManager
from src.model.hybrid_detector import HybridDetector
from src.model.tokenizer import CharTokenizer
from src.model.trainer import Trainer
from src.model.transformer import CharTransformer
from src.monitoring.metrics import MODEL_VERSION

logger = logging.getLogger("queryguard.ml")
logging.basicConfig(level=logging.INFO)

WEIGHTS_DIR = os.getenv("WEIGHTS_DIR", "./weights")
Path(WEIGHTS_DIR).mkdir(exist_ok=True)


def _load_or_train() -> tuple[CharTransformer, CharTokenizer]:
    tokenizer = CharTokenizer()
    tokenizer.build_vocab()

    vocab_path = Path(WEIGHTS_DIR) / "tokenizer_vocab.json"
    if vocab_path.exists():
        tokenizer.load(str(vocab_path))
    else:
        tokenizer.save(str(vocab_path))

    model = CharTransformer(
        vocab_size=tokenizer.vocab_size,
        d_model=64,
        nhead=4,
        num_layers=2,
        d_ff=128,
        max_len=256,
    )

    weights_path = Path(WEIGHTS_DIR) / "best_model.pt"
    if weights_path.exists():
        logger.info("Loading pre-trained weights from %s", weights_path)
        model.load_state_dict(torch.load(str(weights_path), map_location="cpu"))
    else:
        logger.warning("No weights found — running train.py from scratch...")
        try:
            subprocess.run([sys.executable, "train.py"], check=True)
        except subprocess.CalledProcessError as exc:
            logger.error("Training failed: %s", exc)

        if weights_path.exists():
            model.load_state_dict(torch.load(str(weights_path), map_location="cpu"))
        else:
            logger.warning("Proceeding with untrained model")

    model.eval()
    return model, tokenizer


@asynccontextmanager
async def lifespan(app: FastAPI):
    model, tokenizer = _load_or_train()
    hybrid = HybridDetector(model, tokenizer, alpha=0.7)
    al = ActiveLearningManager(model, tokenizer, Trainer, WEIGHTS_DIR)
    MODEL_VERSION.set(al.model_version)
    init_router(hybrid, al, tokenizer, model, WEIGHTS_DIR)
    logger.info("QueryGuard ML service ready — model version %d", al.model_version)
    yield


app = FastAPI(title="QueryGuard ML Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)
