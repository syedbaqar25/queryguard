import { Router, Request, Response } from 'express';
import { mlService } from '../services/mlService';
import axios from 'axios';

export const onnxRouter = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

onnxRouter.post('/export', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await mlService.exportOnnx();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'ONNX export failed', details: String(err) });
  }
});

onnxRouter.get('/download', async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/onnx/download`, {
      responseType: 'stream',
      timeout: 60000,
    });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="model.onnx"');
    response.data.pipe(res);
  } catch (err) {
    res.status(502).json({ error: 'ONNX download failed', details: String(err) });
  }
});

onnxRouter.get('/vocab', async (_req: Request, res: Response): Promise<void> => {
  try {
    const vocab = await mlService.getOnnxVocab();
    res.json(vocab);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch vocab', details: String(err) });
  }
});
