import React from 'react';
import { useQueryStore } from '../stores/queryStore';

export function ErrorBanner() {
  const { error, setError } = useQueryStore();

  if (!error) return null;

  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      <span className="error-msg">{error}</span>
      <button onClick={() => setError(null)} className="error-close" aria-label="Dismiss error">
        ×
      </button>
    </div>
  );
}
