import React, { useState } from 'react';
import { getAPI } from '../services/api';
import type { ExplainResult } from '../types';

function interpolateColor(value: number): string {
  const r = Math.round(255 * value);
  const g = Math.round(255 * (1 - value));
  return `rgb(${r},${g},50)`;
}

export function AttentionHeatmap({ query }: { query: string }) {
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explain = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAPI().explain(query);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Explanation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attention-heatmap" data-testid="attention-heatmap">
      <button onClick={explain} disabled={loading || !query} className="explain-btn">
        {loading ? 'Explaining...' : 'Explain with Attention Rollout'}
      </button>

      {error && <div className="error-msg">{error}</div>}

      {result && (
        <div className="heatmap-result">
          <div className="heatmap-summary">{result.summary}</div>
          <div className="top-span">
            Top suspicious span: <code>{result.top_suspicious_span}</code>
          </div>
          <div className="char-heatmap">
            {result.query.split('').map((ch, i) => (
              <span
                key={i}
                className="char-token"
                style={{
                  backgroundColor: interpolateColor(result.char_scores[i] ?? 0),
                  color: (result.char_scores[i] ?? 0) > 0.5 ? 'white' : 'black',
                }}
                title={`Score: ${((result.char_scores[i] ?? 0) * 100).toFixed(1)}%`}
              >
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
