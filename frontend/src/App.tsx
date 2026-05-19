import React, { useState } from 'react';
import { NavBar } from './components/NavBar';
import { ApiKeyInput } from './components/ApiKeyInput';
import { QueryInput } from './components/QueryInput';
import { ResultCard } from './components/ResultCard';
import { AttentionHeatmap } from './components/AttentionHeatmap';
import { AdversarialPanel } from './components/AdversarialPanel';
import { StatsPanel } from './components/StatsPanel';
import { HistoryTable } from './components/HistoryTable';
import { LiveFeed } from './components/LiveFeed';
import { ActiveLearningPanel } from './components/ActiveLearningPanel';
import { ModelCard } from './components/ModelCard';
import { OnnxInference } from './components/OnnxInference';
import { ErrorBanner } from './components/ErrorBanner';
import { useQueryStore } from './stores/queryStore';

export default function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const { lastResult, apiKey } = useQueryStore();

  return (
    <div className="app">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      <ErrorBanner />

      <div className="app-content">
        <div className="api-key-section">
          <ApiKeyInput />
        </div>

        {activeTab === 'analyze' && (
          <div className="analyze-tab">
            <QueryInput />
            <ResultCard />
            {lastResult && (
              <>
                <AttentionHeatmap query={lastResult.query} />
                <OnnxInference query={lastResult.query} />
              </>
            )}
            <LiveFeed />
          </div>
        )}

        {activeTab === 'history' && <HistoryTable />}

        {activeTab === 'stats' && (
          <div className="stats-tab">
            <StatsPanel />
          </div>
        )}

        {activeTab === 'adversarial' && (
          <div className="adversarial-tab">
            <QueryInput />
            {lastResult && <AdversarialPanel query={lastResult.query} />}
          </div>
        )}

        {activeTab === 'active-learning' && (
          apiKey ? <ActiveLearningPanel /> : <div className="empty-state">Set your API key first</div>
        )}

        {activeTab === 'model' && <ModelCard />}
      </div>
    </div>
  );
}
