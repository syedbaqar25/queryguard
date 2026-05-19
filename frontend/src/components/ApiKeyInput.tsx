import React, { useState } from 'react';
import { useQueryStore } from '../stores/queryStore';
import { initAPI } from '../services/api';

export function ApiKeyInput() {
  const { apiKey, setApiKey } = useQueryStore();
  const [input, setInput] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    setApiKey(trimmed);
    initAPI(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="api-key-form">
      <input
        type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter your API key"
        className="api-key-input"
        data-testid="api-key-input"
      />
      <button type="submit" disabled={!input.trim()} className="save-key-btn">
        {saved ? 'Saved!' : 'Save'}
      </button>
    </form>
  );
}
