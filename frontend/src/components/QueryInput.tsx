import React, { useState } from 'react';
import { useAnalyze } from '../hooks/useAnalyze';
import { useQueryStore } from '../stores/queryStore';

const PLACEHOLDER = `SELECT * FROM users WHERE id = 1 UNION SELECT null, username, password FROM admin--`;

export function QueryInput() {
  const [query, setQuery] = useState('');
  const { analyze } = useAnalyze();
  const { isAnalyzing } = useQueryStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await analyze(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="query-input-form">
      <div className="input-wrapper">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={4}
          className="query-textarea"
          disabled={isAnalyzing}
          data-testid="query-input"
        />
      </div>
      <button
        type="submit"
        disabled={isAnalyzing || !query.trim()}
        className="analyze-btn"
        data-testid="analyze-btn"
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Query'}
      </button>
    </form>
  );
}
