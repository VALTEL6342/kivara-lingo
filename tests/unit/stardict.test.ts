import { describe, it, expect } from 'vitest';
import { parseIfo, parseIdx, decodeDictPayload } from '../../src/content/nlp/stardict';

function makeIdx(entries: { word: string; offset: number; size: number }[]): Uint8Array {
  // Build a synthetic .idx blob: word\0 + uint32 BE offset + uint32 BE size, repeated.
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    const word = enc.encode(e.word);
    const tail = new Uint8Array(9);
    tail[0] = 0; // NUL
    const dv = new DataView(tail.buffer);
    dv.setUint32(1, e.offset, false);
    dv.setUint32(5, e.size, false);
    parts.push(word, tail);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

describe('stardict parseIfo', () => {
  it('parses standard key-value lines', () => {
    const ifo = parseIfo(
      [
        'StarDict\'s dict ifo file',
        'version=2.4.2',
        'bookname=Test Dictionary',
        'wordcount=42',
        'idxfilesize=1024',
        'sametypesequence=m',
        'author=Devin',
        '#comment line',
        'description=Trivial test dictionary',
        'date=2026-05-19',
      ].join('\n'),
    );
    expect(ifo.bookname).toBe('Test Dictionary');
    expect(ifo.wordcount).toBe(42);
    expect(ifo.idxfilesize).toBe(1024);
    expect(ifo.sametypesequence).toBe('m');
    expect(ifo.author).toBe('Devin');
    expect(ifo.description).toBe('Trivial test dictionary');
    expect(ifo.date).toBe('2026-05-19');
  });

  it('returns empty bookname when missing', () => {
    const ifo = parseIfo('wordcount=10');
    expect(ifo.bookname).toBe('');
    expect(ifo.wordcount).toBe(10);
  });

  it('splits the lang field into source/target', () => {
    const ifo = parseIfo('bookname=foo\nlang=en-es');
    expect(ifo.sourceLang).toBe('en');
    expect(ifo.targetLang).toBe('es');
  });
});

describe('stardict parseIdx', () => {
  it('walks word/offset/size triples', () => {
    const blob = makeIdx([
      { word: 'hello', offset: 0, size: 5 },
      { word: 'world', offset: 5, size: 11 },
    ]);
    const out = parseIdx(blob);
    expect(out).toEqual([
      { word: 'hello', offset: 0, size: 5 },
      { word: 'world', offset: 5, size: 11 },
    ]);
  });

  it('handles UTF-8 multi-byte words', () => {
    const blob = makeIdx([{ word: 'café', offset: 7, size: 3 }]);
    const out = parseIdx(blob);
    expect(out).toEqual([{ word: 'café', offset: 7, size: 3 }]);
  });

  it('returns empty array for empty idx', () => {
    expect(parseIdx(new Uint8Array(0))).toEqual([]);
  });
});

describe('stardict decodeDictPayload', () => {
  it('decodes a single-type "m" entry', () => {
    const enc = new TextEncoder();
    const bytes = enc.encode('hola');
    expect(decodeDictPayload(bytes, 'm')).toEqual(['hola']);
  });

  it('skips non-text types', () => {
    const enc = new TextEncoder();
    const bytes = enc.encode('\x00\x00\x00\x00');
    // Type 'P' = picture → skipped, returns nothing.
    expect(decodeDictPayload(bytes, 'P')).toEqual([]);
  });

  it('decodes multi-type sequences with NUL terminators', () => {
    // Sequence 'mt' = plain meaning + phonetic. Each chunk is NUL-terminated.
    const enc = new TextEncoder();
    const part1 = enc.encode('hola');
    const part2 = enc.encode('/ˈo.la/');
    const blob = new Uint8Array(part1.length + 1 + part2.length + 1);
    blob.set(part1, 0);
    blob[part1.length] = 0;
    blob.set(part2, part1.length + 1);
    blob[part1.length + 1 + part2.length] = 0;
    expect(decodeDictPayload(blob, 'mt')).toEqual(['hola', '/ˈo.la/']);
  });

  it('decodes uppercase types with explicit size prefix in multi-type sequences', () => {
    // Per the StarDict spec, only NON-LAST uppercase types carry an explicit
    // size prefix. For a 'Mm' sequence, the first chunk gets the uint32 BE
    // size; the trailing 'm' runs to the end of the entry.
    const enc = new TextEncoder();
    const part1 = enc.encode('hello');
    const part2 = enc.encode('world');
    const blob = new Uint8Array(4 + part1.length + part2.length);
    const dv = new DataView(blob.buffer);
    dv.setUint32(0, part1.length, false);
    blob.set(part1, 4);
    blob.set(part2, 4 + part1.length);
    expect(decodeDictPayload(blob, 'Mm')).toEqual(['hello', 'world']);
  });
});
