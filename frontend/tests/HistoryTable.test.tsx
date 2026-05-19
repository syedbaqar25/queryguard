import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryTable } from '../src/components/HistoryTable';
import { mockAPI } from './setup';

const mockHistory = {
  items: [
    { id: '1', tenantId: 't1', query: 'SELECT 1', label: 'SAFE', confidence: 0.9, attackType: null, latencyMs: 10, timestamp: new Date().toISOString(), source: 'test' },
    { id: '2', tenantId: 't1', query: "' OR 1=1--", label: 'MALICIOUS', confidence: 0.98, attackType: 'BOOLEAN_BLIND', latencyMs: 15, timestamp: new Date().toISOString(), source: 'test' },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

vi.mock('../src/stores/queryStore', () => ({
  useQueryStore: () => ({
    history: mockHistory.items,
    setHistory: vi.fn(),
  }),
}));

describe('HistoryTable', () => {
  beforeEach(() => {
    mockAPI.getHistory.mockResolvedValue(mockHistory);
    vi.clearAllMocks();
    mockAPI.getHistory.mockResolvedValue(mockHistory);
  });

  it('renders history table', async () => {
    render(<HistoryTable />);
    expect(screen.getByTestId('history-table')).toBeInTheDocument();
  });

  it('shows filter select', () => {
    render(<HistoryTable />);
    expect(screen.getByTestId('filter-select')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<HistoryTable />);
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('calls getHistory when filter changes', async () => {
    render(<HistoryTable />);
    fireEvent.change(screen.getByTestId('filter-select'), { target: { value: 'malicious' } });
    expect(mockAPI.getHistory).toHaveBeenCalled();
  });
});
