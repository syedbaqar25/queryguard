import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultCard } from '../src/components/ResultCard';
import type { AnalysisResult } from '../src/types';

const maliciousResult: AnalysisResult = {
  id: 'abc123',
  query: "SELECT * FROM users WHERE id=1 UNION SELECT null--",
  label: 'MALICIOUS',
  confidence: 0.97,
  safe_prob: 0.03,
  malicious_prob: 0.97,
  attack_type: 'UNION_BASED',
  latency_ms: 12,
  timestamp: new Date().toISOString(),
};

const safeResult: AnalysisResult = {
  id: 'def456',
  query: 'SELECT name FROM products',
  label: 'SAFE',
  confidence: 0.95,
  safe_prob: 0.95,
  malicious_prob: 0.05,
  attack_type: null,
  latency_ms: 8,
  timestamp: new Date().toISOString(),
};

vi.mock('../src/stores/queryStore', () => ({
  useQueryStore: vi.fn(),
}));

import { useQueryStore } from '../src/stores/queryStore';

describe('ResultCard', () => {
  it('renders nothing when no result', () => {
    vi.mocked(useQueryStore).mockReturnValue({ lastResult: null } as ReturnType<typeof useQueryStore>);
    const { container } = render(<ResultCard />);
    expect(container.firstChild).toBeNull();
  });

  it('shows MALICIOUS label and attack type', () => {
    vi.mocked(useQueryStore).mockReturnValue({ lastResult: maliciousResult } as ReturnType<typeof useQueryStore>);
    render(<ResultCard />);
    expect(screen.getByTestId('result-card')).toBeInTheDocument();
    expect(screen.getByText('MALICIOUS')).toBeInTheDocument();
    expect(screen.getByText('UNION_BASED')).toBeInTheDocument();
  });

  it('shows SAFE label without attack type', () => {
    vi.mocked(useQueryStore).mockReturnValue({ lastResult: safeResult } as ReturnType<typeof useQueryStore>);
    render(<ResultCard />);
    expect(screen.getByText('SAFE')).toBeInTheDocument();
    expect(screen.queryByText('UNION_BASED')).toBeNull();
  });

  it('displays confidence percentage', () => {
    vi.mocked(useQueryStore).mockReturnValue({ lastResult: maliciousResult } as ReturnType<typeof useQueryStore>);
    render(<ResultCard />);
    expect(screen.getByText('97%')).toBeInTheDocument();
  });

  it('shows latency', () => {
    vi.mocked(useQueryStore).mockReturnValue({ lastResult: maliciousResult } as ReturnType<typeof useQueryStore>);
    render(<ResultCard />);
    expect(screen.getByText('12ms')).toBeInTheDocument();
  });
});
