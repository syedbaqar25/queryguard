import React, { useState } from 'react';

interface OnnxResult {
  label: string;
  safe_prob: number;
  malicious_prob: number;
  latency_ms: number;
}

export function OnnxInference({ query }: { query: string }) {
  const [result, setResult] = useState<OnnxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = React.useRef<Worker | null>(null);

  const runInference = () => {
    setLoading(true);
    setError(null);

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/onnxWorker.ts', import.meta.url),
        { type: 'module' }
      );
    }

    const worker = workerRef.current;

    const handleMessage = (e: MessageEvent<{ result?: OnnxResult; error?: string }>) => {
      if (e.data.error) {
        setError(e.data.error);
      } else if (e.data.result) {
        setResult(e.data.result);
      }
      setLoading(false);
      worker.removeEventListener('message', handleMessage);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ query });
  };

  return (
    <div className="onnx-inference" data-testid="onnx-inference">
      <button onClick={runInference} disabled={loading || !query} className="onnx-btn">
        {loading ? 'Running ONNX...' : 'Run Browser-side ONNX Inference'}
      </button>

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <div className="onnx-result">
          <span className={`onnx-label ${result.label === 'MALICIOUS' ? 'badge-malicious' : 'badge-safe'}`}>
            {result.label}
          </span>
          <span>Safe: {(result.safe_prob * 100).toFixed(1)}%</span>
          <span>Malicious: {(result.malicious_prob * 100).toFixed(1)}%</span>
          <span>Latency: {result.latency_ms}ms</span>
        </div>
      )}
    </div>
  );
}
