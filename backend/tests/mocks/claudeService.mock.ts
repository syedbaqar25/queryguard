import { LabelSuggestion } from '../../src/services/claudeService';

export const mockLabelSuggestion: LabelSuggestion = {
  suggested_label: 'MALICIOUS',
  confidence: 0.92,
  reasoning: 'Contains UNION SELECT pattern characteristic of UNION-based SQL injection',
  attack_type: 'UNION_BASED',
};

export const claudeServiceMock = {
  suggestLabel: jest.fn().mockResolvedValue(mockLabelSuggestion),
  batchSuggestLabels: jest.fn().mockResolvedValue([
    { id: 'abc123', suggestion: mockLabelSuggestion },
  ]),
};
