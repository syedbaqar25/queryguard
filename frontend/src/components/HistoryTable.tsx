import React, { useEffect, useState } from 'react';
import { useQueryStore } from '../stores/queryStore';
import { getAPI } from '../services/api';
import type { HistoryResponse } from '../types';

export function HistoryTable() {
  const { history, setHistory } = useQueryStore();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'safe' | 'malicious'>('all');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    getAPI()
      .getHistory(page, LIMIT, filter)
      .then((res: HistoryResponse) => {
        setHistory(res.items);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filter, setHistory]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="history-table-wrapper" data-testid="history-table">
      <div className="history-controls">
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value as typeof filter); setPage(1); }}
          className="filter-select"
          data-testid="filter-select"
        >
          <option value="all">All</option>
          <option value="safe">Safe</option>
          <option value="malicious">Malicious</option>
        </select>
        <span className="history-count">{total} entries</span>
      </div>

      {loading ? (
        <div className="history-loading">Loading...</div>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Query</th>
              <th>Label</th>
              <th>Attack Type</th>
              <th>Confidence</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id} className={entry.label === 'MALICIOUS' ? 'row-malicious' : 'row-safe'}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="query-cell">
                  <code>{entry.query.length > 60 ? entry.query.slice(0, 57) + '...' : entry.query}</code>
                </td>
                <td>
                  <span className={`label-badge ${entry.label === 'MALICIOUS' ? 'badge-malicious' : 'badge-safe'}`}>
                    {entry.label}
                  </span>
                </td>
                <td>{entry.attackType || '—'}</td>
                <td>{(entry.confidence * 100).toFixed(1)}%</td>
                <td>{entry.latencyMs}ms</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">No entries found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
