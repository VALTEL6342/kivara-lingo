import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/content/nlp/csv-importer';

describe('parseCsv', () => {
  it('parses positional CSV with default fields', () => {
    const { rows } = parseCsv('hello, hola\nworld, mundo');
    expect(rows).toHaveLength(2);
    expect(rows[0].word).toBe('hello');
    expect(rows[0].translation).toBe('hola');
    expect(rows[1].word).toBe('world');
    expect(rows[1].translation).toBe('mundo');
  });

  it('parses positional TSV', () => {
    const { rows } = parseCsv('hello\thola\nworld\tmundo');
    expect(rows).toHaveLength(2);
    expect(rows[0].word).toBe('hello');
    expect(rows[1].translation).toBe('mundo');
  });

  it('detects English header row and maps aliases', () => {
    const { rows } = parseCsv('Word,Translation,IPA\nrun,correr,/rʌn/');
    expect(rows).toHaveLength(1);
    expect(rows[0].word).toBe('run');
    expect(rows[0].translation).toBe('correr');
    expect(rows[0].phonetic).toBe('/rʌn/');
  });

  it('detects Spanish header row', () => {
    const { rows } = parseCsv('Palabra,Traducción,Fonética\nrun,correr,/rʌn/');
    expect(rows).toHaveLength(1);
    expect(rows[0].word).toBe('run');
    expect(rows[0].translation).toBe('correr');
    expect(rows[0].phonetic).toBe('/rʌn/');
  });

  it('honors quoted fields with embedded commas', () => {
    const { rows } = parseCsv('word,translation\n"hello, world",hola');
    expect(rows).toHaveLength(1);
    expect(rows[0].word).toBe('hello, world');
    expect(rows[0].translation).toBe('hola');
  });

  it('collapses doubled quotes inside quoted fields', () => {
    const { rows } = parseCsv('word,translation\n"say ""hi""",saludar');
    expect(rows).toHaveLength(1);
    expect(rows[0].word).toBe('say "hi"');
    expect(rows[0].translation).toBe('saludar');
  });

  it('skips blank lines and # comments', () => {
    const { rows } = parseCsv('# this is a comment\nhello, hola\n\nworld, mundo');
    expect(rows).toHaveLength(2);
    expect(rows[0].word).toBe('hello');
    expect(rows[1].word).toBe('world');
  });

  it('accepts a 5-column CSV with all fields', () => {
    const text = 'word,translation,phonetic,definition,example\nrun,correr,/rʌn/,Move quickly,She runs daily.';
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].word).toBe('run');
    expect(rows[0].translation).toBe('correr');
    expect(rows[0].phonetic).toBe('/rʌn/');
    expect(rows[0].definition).toBe('Move quickly');
    expect(rows[0].example).toBe('She runs daily.');
  });

  it('handles trailing whitespace', () => {
    const { rows } = parseCsv('hello, hola \n   world ,  mundo  ');
    expect(rows[0].translation).toBe('hola');
    expect(rows[1].word).toBe('world');
    expect(rows[1].translation).toBe('mundo');
  });

  it('returns empty rows for empty input', () => {
    expect(parseCsv('').rows).toHaveLength(0);
    expect(parseCsv('\n\n').rows).toHaveLength(0);
  });
});
