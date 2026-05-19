import React from 'react';

interface NavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'history', label: 'History' },
  { id: 'stats', label: 'Statistics' },
  { id: 'adversarial', label: 'Adversarial' },
  { id: 'active-learning', label: 'Active Learning' },
  { id: 'model', label: 'Model' },
];

export function NavBar({ activeTab, onTabChange }: NavBarProps) {
  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🛡️</span>
        <span className="brand-name">QueryGuard</span>
      </div>
      <div className="navbar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            data-testid={`nav-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
