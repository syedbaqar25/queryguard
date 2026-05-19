import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryInput } from '../src/components/QueryInput';
import { mockAPI } from './setup';

vi.mock('../src/hooks/useAnalyze', () => ({
  useAnalyze: () => ({ analyze: mockAPI.analyze }),
}));

vi.mock('../src/stores/queryStore', () => ({
  useQueryStore: () => ({ isAnalyzing: false }),
}));

describe('QueryInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and submit button', () => {
    render(<QueryInput />);
    expect(screen.getByTestId('query-input')).toBeInTheDocument();
    expect(screen.getByTestId('analyze-btn')).toBeInTheDocument();
  });

  it('disables button when input is empty', () => {
    render(<QueryInput />);
    expect(screen.getByTestId('analyze-btn')).toBeDisabled();
  });

  it('enables button when input is non-empty', () => {
    render(<QueryInput />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'SELECT 1' } });
    expect(screen.getByTestId('analyze-btn')).not.toBeDisabled();
  });

  it('calls analyze on form submit', async () => {
    mockAPI.analyze.mockResolvedValue({ id: '1', label: 'SAFE', confidence: 0.9 });
    render(<QueryInput />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'SELECT 1' } });
    fireEvent.submit(screen.getByTestId('analyze-btn').closest('form')!);
    await waitFor(() => expect(mockAPI.analyze).toHaveBeenCalledWith('SELECT 1'));
  });

  it('trims whitespace before calling analyze', async () => {
    mockAPI.analyze.mockResolvedValue({ id: '1', label: 'SAFE', confidence: 0.9 });
    render(<QueryInput />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: '  SELECT 1  ' } });
    fireEvent.submit(screen.getByTestId('analyze-btn').closest('form')!);
    await waitFor(() => expect(mockAPI.analyze).toHaveBeenCalledWith('SELECT 1'));
  });
});
