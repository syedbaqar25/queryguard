interface ObfuscationResult {
  technique: string;
  original: string;
  obfuscated: string;
}

interface AdversarialReport {
  original_query: string;
  obfuscations: ObfuscationResult[];
  robustness_score: number;
  vulnerable_to: string[];
}

const TECHNIQUES = [
  'case_variation',
  'comment_insertion',
  'hex_encoding',
  'url_encoding',
  'whitespace_variation',
  'string_concatenation',
  'null_byte_injection',
  'unicode_homoglyphs',
] as const;

type Technique = typeof TECHNIQUES[number];

function caseVariation(query: string): string {
  return query
    .split('')
    .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
    .join('');
}

function commentInsertion(query: string): string {
  return query.replace(/\s+/g, '/**/');
}

function hexEncoding(query: string): string {
  return query.replace(/\b(\d+)\b/g, (_, n) => '0x' + parseInt(n, 10).toString(16));
}

function urlEncoding(query: string): string {
  return query.replace(/['"]/g, (ch) => encodeURIComponent(ch));
}

function whitespaceVariation(query: string): string {
  return query.replace(/\s+/g, () => {
    const ws = [' ', '\t', '\n', '\r\n', '  ', '\t\t'];
    return ws[Math.floor(Math.random() * ws.length)];
  });
}

function stringConcatenation(query: string): string {
  return query.replace(/'([^']*)'/g, (_, s) => {
    if (s.length < 2) return `'${s}'`;
    const mid = Math.floor(s.length / 2);
    return `CONCAT('${s.slice(0, mid)}','${s.slice(mid)}')`;
  });
}

function nullByteInjection(query: string): string {
  return query.replace(/\bSELECT\b/gi, 'SEL%00ECT')
    .replace(/\bUNION\b/gi, 'UNI%00ON')
    .replace(/\bFROM\b/gi, 'FR%00OM');
}

function unicodeHomoglyphs(query: string): string {
  const glyphs: Record<string, string> = {
    'a': 'а',
    'e': 'е',
    'o': 'о',
    'p': 'р',
    'c': 'с',
    'x': 'х',
    'A': 'А',
    'E': 'Е',
    'O': 'О',
  };
  return query.replace(/[aeopxcAEO]/g, (ch) => glyphs[ch] ?? ch);
}

const OBFUSCATORS: Record<Technique, (q: string) => string> = {
  case_variation: caseVariation,
  comment_insertion: commentInsertion,
  hex_encoding: hexEncoding,
  url_encoding: urlEncoding,
  whitespace_variation: whitespaceVariation,
  string_concatenation: stringConcatenation,
  null_byte_injection: nullByteInjection,
  unicode_homoglyphs: unicodeHomoglyphs,
};

class AdversarialService {
  generateObfuscations(query: string): ObfuscationResult[] {
    return TECHNIQUES.map((technique) => ({
      technique,
      original: query,
      obfuscated: OBFUSCATORS[technique](query),
    }));
  }

  async testRobustness(
    query: string,
    predictFn: (q: string) => Promise<{ label: string; confidence: number }>
  ): Promise<AdversarialReport> {
    const obfuscations = this.generateObfuscations(query);

    const results = await Promise.all(
      obfuscations.map(async (o) => {
        try {
          const prediction = await predictFn(o.obfuscated);
          return { technique: o.technique, ...prediction };
        } catch {
          return { technique: o.technique, label: 'SAFE', confidence: 0.5 };
        }
      })
    );

    const originalPrediction = await predictFn(query).catch(() => ({ label: 'SAFE', confidence: 0.5 }));
    const originalLabel = originalPrediction.label;

    const vulnerableTo = results
      .filter((r) => r.label !== originalLabel)
      .map((r) => r.technique);

    const robustness_score = (TECHNIQUES.length - vulnerableTo.length) / TECHNIQUES.length;

    return {
      original_query: query,
      obfuscations,
      robustness_score,
      vulnerable_to: vulnerableTo,
    };
  }
}

export const adversarialService = new AdversarialService();
