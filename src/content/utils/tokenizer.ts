export interface SegmentMeta {
  token: string;
  type: 'phrase' | 'word';
  phonetic?: string;
  translation: string;
  bilingual?: string;
  monolingual?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

/* Mock MWE registry (en producción: bundle local mwes.json + CEFR) */
export const SEGMENT_REGISTRY: Record<string, SegmentMeta> = {
  'these days': {
    token: 'these days', type: 'phrase',
    phonetic: '/ðiːz deɪz/',
    translation: 'estos días, en la actualidad',
    bilingual: '(adv.) en la actualidad, hoy en día',
    monolingual: 'In the present period of time.',
  },
  'these': {
    token: 'these', type: 'word', level: 'A1',
    phonetic: '/ðiːz/',
    translation: 'estos, estas',
    bilingual: '(det. pl.) estos / estas',
    monolingual: 'Plural of "this"; referring to nearby items.',
  },
  'days': {
    token: 'days', type: 'word', level: 'A1',
    phonetic: '/deɪz/',
    translation: 'días',
    bilingual: '(sust. pl.) días, jornadas',
    monolingual: 'Plural of "day"; periods of 24 hours.',
  },
  "doesn't": {
    token: "doesn't", type: 'word', level: 'A1',
    phonetic: '/ˈdʌzənt/',
    translation: 'no (3ª pers.)',
    bilingual: '(aux. neg.) does + not',
    monolingual: 'Negative form of "does".',
  },
  'travel': {
    token: 'travel', type: 'word', level: 'A2',
    phonetic: '/ˈtrævəl/',
    translation: 'viajar',
    bilingual: '(verbo) viajar, desplazarse',
    monolingual: 'To go from one place to another.',
  },
  'much': {
    token: 'much', type: 'word', level: 'A1',
    phonetic: '/mʌtʃ/',
    translation: 'mucho',
    bilingual: '(adv.) en gran cantidad',
    monolingual: 'A large amount or to a great degree.',
  },
};

export type Token = { text: string; key: string; kind: 'mwe' | 'known' | 'unknown' | 'punct' };

export function tokenizeSentence(sentence: string, expanded: Set<string> = new Set()): Token[] {
  const raw = sentence.match(/[\w']+|[^\w\s]+|\s+/g) ?? [];
  const words: { text: string; idx: number }[] = [];
  raw.forEach((t, idx) => { if (/[\w']/.test(t)) words.push({ text: t, idx }); });

  const wordKey = new Map<number, Token>();
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(4, words.length - i); len >= 2; len--) {
      const phrase = words.slice(i, i + len).map(w => w.text).join(' ').toLowerCase();
      if (SEGMENT_REGISTRY[phrase]?.type === 'phrase' && !expanded.has(phrase)) {
        const text = words.slice(i, i + len).map(w => w.text).join(' ');
        wordKey.set(words[i].idx, { text, key: phrase, kind: 'mwe' });
        for (let k = 1; k < len; k++) wordKey.set(words[i + k].idx, { text: '', key: '', kind: 'mwe' });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const w = words[i];
      const lower = w.text.toLowerCase();
      const known = !!SEGMENT_REGISTRY[lower];
      wordKey.set(w.idx, { text: w.text, key: lower, kind: known ? 'known' : 'unknown' });
      i++;
    }
  }

  const tokens: Token[] = [];
  raw.forEach((t, idx) => {
      if (/^\s+$/.test(t)) tokens.push({ text: t, key: `_sp${idx}`, kind: 'punct' });
      else if (/^[^\w\s]+$/.test(t)) tokens.push({ text: t, key: `_p${idx}`, kind: 'punct' });
    else {
      const tok = wordKey.get(idx);
      if (tok && tok.text) tokens.push(tok);
    }
  });
  return tokens;
}
