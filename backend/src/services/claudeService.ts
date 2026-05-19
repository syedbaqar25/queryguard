import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface LabelSuggestion {
  suggested_label: 'SAFE' | 'MALICIOUS';
  confidence: number;
  reasoning: string;
  attack_type: string | null;
}

class ClaudeService {
  async suggestLabel(query: string, modelConfidence: number): Promise<LabelSuggestion> {
    const prompt = `You are a SQL injection security expert. Analyze the following SQL query and determine if it is SAFE or MALICIOUS (SQL injection attempt).

SQL Query: ${query}

The ML model classified this with confidence: ${(modelConfidence * 100).toFixed(1)}%

Respond with a JSON object containing:
- suggested_label: "SAFE" or "MALICIOUS"
- confidence: number between 0 and 1
- reasoning: brief explanation
- attack_type: null if SAFE, or one of: UNION_BASED, BOOLEAN_BLIND, TIME_BASED, ERROR_BASED, STACKED_QUERY, COMMAND_EXEC, COMMENT_INJECTION, OBFUSCATED

Return only valid JSON, no markdown.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(text) as LabelSuggestion;
      return {
        suggested_label: parsed.suggested_label === 'MALICIOUS' ? 'MALICIOUS' : 'SAFE',
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || ''),
        attack_type: parsed.attack_type || null,
      };
    } catch {
      return {
        suggested_label: 'SAFE',
        confidence: 0.5,
        reasoning: 'Failed to parse Claude response',
        attack_type: null,
      };
    }
  }

  async batchSuggestLabels(
    entries: { id: string; query: string; confidence: number }[]
  ): Promise<{ id: string; suggestion: LabelSuggestion }[]> {
    const results = await Promise.allSettled(
      entries.map(async (entry) => ({
        id: entry.id,
        suggestion: await this.suggestLabel(entry.query, entry.confidence),
      }))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<{ id: string; suggestion: LabelSuggestion }> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}

export const claudeService = new ClaudeService();
