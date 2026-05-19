import enDict from '../../assets/dictionaries/en.json';
import enExtensions from '../../assets/dictionaries/en-extensions.json';
import type { DictionaryEntry } from '../../shared/types';
import { lemmaCandidates } from './lemma';

// Strip the `_meta` informational block before treating the file as a
// dictionary so it doesn't pollute lookups.
const { _meta: _enExtMeta, ...enExtensionEntries } = enExtensions as Record<
  string,
  unknown
>;
void _enExtMeta;

// Merge precedence: the curated extension pack wins over the base bundle for
// any colliding key. Most collisions are slang/contractions (gonna, wanna,
// gotta, ain't) where the base entries were auto-generated from Wiktionary
// and have low-quality translations — the extension entries are hand-curated.
const enMerged = {
  ...(enDict as Record<string, DictionaryEntry>),
  ...(enExtensionEntries as Record<string, DictionaryEntry>),
};

const DICTIONARIES: Record<string, Record<string, DictionaryEntry>> = {
  en: enMerged,
};

/**
 * Returns the entry for a token in a given language, or undefined.
 *
 * Lookup order:
 *   1. Literal lowercased token.
 *   2. Lemma candidates (only for EN — `lemmaCandidates()` returns just the
 *      literal for other languages so this is a no-op there).
 *
 * When the hit comes from a lemma we return a *shallow copy* with the
 * original surface form on `token` so the popover header reads naturally and
 * the resolved lemma is exposed on the optional `lemmaOf` field.
 */
export function lookupDictionary(token: string, lang = 'en'): DictionaryEntry | undefined {
  const dict = DICTIONARIES[lang];
  if (!dict) return undefined;
  const key = token.trim().toLowerCase();
  const direct = dict[key];
  if (direct) return direct;

  // Lemma fallback (EN only — see lemma.ts).
  if (lang !== 'en') return undefined;
  const candidates = lemmaCandidates(token);
  for (let i = 1; i < candidates.length; i++) {
    const hit = dict[candidates[i]];
    if (hit) return { ...hit, token, lemmaOf: candidates[i] };
  }
  return undefined;
}

export function getDictionary(lang = 'en'): Record<string, DictionaryEntry> {
  return DICTIONARIES[lang] ?? {};
}
