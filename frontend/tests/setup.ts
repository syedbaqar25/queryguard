import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

vi.mock('../src/services/api', () => ({
  getAPI: vi.fn(() => mockAPI),
  initAPI: vi.fn(() => mockAPI),
}));

export const mockAPI = {
  analyze: vi.fn(),
  getHistory: vi.fn(),
  getStats: vi.fn(),
  getModelInfo: vi.fn(),
  explain: vi.fn(),
  testAdversarial: vi.fn(),
  getUncertainQueue: vi.fn(),
  labelEntry: vi.fn(),
  suggestLabel: vi.fn(),
  triggerRetrain: vi.fn(),
  createEventSource: vi.fn(),
};
