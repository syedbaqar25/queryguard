import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsPanel } from '../src/components/StatsPanel';
import type { Stats } from '../src/types';

const mockStats: Stats = {
  totalAnalyzed: 100,
  totalMalicious: 30,
  totalSafe: 70,
  detectionRate: 0.3,
  avgConfidence: 0.88,
  avgLatencyMs: 15.5,
  attackTypeBreakdown: { UNION_BASED: 15, BOOLEAN_BLIND: 10, TIME_BASED: 5 },
  recentTrend: Array(24).fill({ hour: '2024-01-01T00:00', safe: 2, malicious: 1 }),
};

vi.mock('../src/hooks/useStats', () => ({ useStats: vi.fn() }));

vi.mock('../src/stores/queryStore', () => ({
  useQueryStore: vi.fn(),
}));

import { useQueryStore } from '../src/stores/queryStore';

describe('StatsPanel', () => {
  beforeEach(() => {
    vi.mocked(useQueryStore).mockReturnValue({ stats: mockStats } as ReturnType<typeof useQueryStore>);
  });

  it('renders stat cards with correct values', () => {
    render(<StatsPanel />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
  });

  it('shows loading when stats is null', () => {
    vi.mocked(useQueryStore).mockReturnValue({ stats: null } as ReturnType<typeof useQueryStore>);
    render(<StatsPanel />);
    expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
  });

  it('renders the stats panel testid', () => {
    render(<StatsPanel />);
    expect(screen.getByTestId('stats-panel')).toBeInTheDocument();
  });
});
