import React from 'react';
import type { AnalysisResult } from '../types';
import { useQueryStore } from '../stores/queryStore';

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="confidence-bar-wrapper">
      <div
        className="confidence-bar-fill"
        style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#ef4444' : '#f59e0b' }}
      />
      <span className="confidence-label">{pct}%</span>
    </div>
  );
}

export function ResultCard() {
  const { lastResult } = useQueryStore();

  if (!lastResult) return null;

  const isMalicious = lastResult.label === 'MALICIOUS';

  return (
    <div
      className={`result-card ${isMalicious ? 'result-malicious' : 'result-safe'}`}
      data-testid="result-card"
    >
      <div className="result-header">
        <span className={`result-badge ${isMalicious ? 'badge-malicious' : 'badge-safe'}`}>
          {lastResult.label}
        </span>
        {lastResult.attack_type && (
          <span className="attack-type-badge">{lastResult.attack_type}</span>
        )}
        <span className="latency-badge">{lastResult.latency_ms}ms</span>
      </div>

      <div className="result-confidence">
        <span>Confidence</span>
        <ConfidenceBar value={lastResult.confidence} />
      </div>

      <div className="result-probs">
        <div className="prob-item">
          <span>Safe</span>
          <strong>{(lastResult.safe_prob * 100).toFixed(1)}%</strong>
        </div>
        <div className="prob-item">
          <span>Malicious</span>
          <strong>{(lastResult.malicious_prob * 100).toFixed(1)}%</strong>
        </div>
      </div>

      <div className="result-query">
        <span className="result-query-label">Query</span>
        <code>{lastResult.query}</code>
      </div>

      <div className="result-timestamp">
        Analyzed at {new Date(lastResult.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
