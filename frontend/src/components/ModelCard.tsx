import React, { useEffect, useState } from 'react';
import { getAPI } from '../services/api';

export function ModelCard() {
  const [card, setCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAPI()
      .getModelInfo()
      .then((info) => {
        setCard(JSON.stringify(info, null, 2));
      })
      .catch(() => setCard('Failed to load model info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="model-card-loading">Loading model info...</div>;

  return (
    <div className="model-card" data-testid="model-card">
      <h3>Model Information</h3>
      <pre className="model-card-content">{card}</pre>
    </div>
  );
}
