import React, { useState } from 'react';
import { getAPI } from '../services/api';
import type { AdversarialReport } from '../types';

export function AdversarialPanel({ query }: { query: string }) {
  const [report, setReport] = useState<AdversarialReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async (testRobustness: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAPI().testAdversarial(query, testRobustness);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adversarial-panel" data-testid="adversarial-panel">
      <div className="adversarial-actions">
        <button onClick={() => runTest(false)} disabled={loading || !query} className="adv-btn">
          Generate Obfuscations
        </button>
        <button onClick={() => runTest(true)} disabled={loading || !query} className="adv-btn adv-btn-primary">
          {loading ? 'Testing...' : 'Test Robustness'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {report && (
        <div className="adversarial-report">
          {report.robustness_score !== undefined && (
            <div className="robustness-score">
              <strong>Robustness Score:</strong>{' '}
              <span className={report.robustness_score > 0.75 ? 'score-good' : 'score-bad'}>
                {(report.robustness_score * 100).toFixed(0)}%
              </span>
              {report.vulnerable_to && report.vulnerable_to.length > 0 && (
                <div className="vulnerable-list">
                  Bypassed by: {report.vulnerable_to.join(', ')}
                </div>
              )}
            </div>
          )}
          <table className="obfuscation-table">
            <thead>
              <tr>
                <th>Technique</th>
                <th>Obfuscated Query</th>
              </tr>
            </thead>
            <tbody>
              {report.obfuscations.map((o) => (
                <tr key={o.technique}>
                  <td className="technique-cell">{o.technique}</td>
                  <td><code className="obf-query">{o.obfuscated}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
