import React, { useEffect, useState } from 'react';
import { getAPI } from '../services/api';
import type { UncertainEntry, LabelSuggestion } from '../types';

export function ActiveLearningPanel() {
  const [queue, setQueue] = useState<UncertainEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, LabelSuggestion>>({});
  const [retrainStatus, setRetrainStatus] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { items } = await getAPI().getUncertainQueue();
      setQueue(items);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, []);

  const label = async (id: string, l: 'SAFE' | 'MALICIOUS') => {
    await getAPI().labelEntry(id, l);
    setQueue((q) => q.filter((e) => e.id !== id));
  };

  const suggest = async (entry: UncertainEntry) => {
    const sugg = await getAPI().suggestLabel(entry.query, entry.confidence);
    setSuggestions((s) => ({ ...s, [entry.id]: sugg }));
  };

  const retrain = async () => {
    const result = await getAPI().triggerRetrain();
    setRetrainStatus(result.message);
  };

  return (
    <div className="al-panel" data-testid="al-panel">
      <div className="al-header">
        <h3>Active Learning Queue ({queue.length})</h3>
        <button onClick={loadQueue} disabled={loading} className="refresh-btn">Refresh</button>
        <button onClick={retrain} className="retrain-btn">Trigger Retrain</button>
      </div>

      {retrainStatus && <div className="retrain-status">{retrainStatus}</div>}

      {loading ? (
        <div className="al-loading">Loading queue...</div>
      ) : queue.length === 0 ? (
        <div className="empty-state">No uncertain samples in queue</div>
      ) : (
        <div className="al-entries">
          {queue.map((entry) => (
            <div key={entry.id} className="al-entry">
              <code className="al-query">{entry.query}</code>
              <div className="al-confidence">
                Model confidence: {(entry.confidence * 100).toFixed(1)}%
              </div>
              {suggestions[entry.id] && (
                <div className="al-suggestion">
                  Claude suggests: <strong>{suggestions[entry.id].suggested_label}</strong>
                  {' — '}{suggestions[entry.id].reasoning}
                </div>
              )}
              <div className="al-actions">
                <button onClick={() => suggest(entry)} className="suggest-btn">Ask Claude</button>
                <button onClick={() => label(entry.id, 'SAFE')} className="safe-btn">Mark Safe</button>
                <button onClick={() => label(entry.id, 'MALICIOUS')} className="malicious-btn">Mark Malicious</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
