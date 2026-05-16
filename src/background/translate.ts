/// <reference types="chrome" />

import { lookupDictionary } from '../content/nlp/dictionary';
import type {
  DictionaryEntry,
  TranslateProvider,
  TranslateRequest,
  TranslateResponse,
  TranslateSettings,
} from '../shared/types';
import { DEFAULT_TRANSLATE } from '../shared/store';
import { callChain, callOne } from './translate-providers';
import type { ChainStep } from './translate-providers';
import { getDB, translationCacheKey } from '../shared/db';

const STORE_KEY = 'kivara-lingo-state';

let lastCallAt = 0;
const DEBOUNCE_MS = 200;

/**
 * Read the persisted Zustand store from chrome.storage.sync, then merge with
 * the defaults so older snapshots (missing the chain-mode fields) keep
 * working without a re-onboard.
 */
async function loadSettings(): Promise<TranslateSettings> {
  try {
    const raw = await chrome.storage.sync.get(STORE_KEY);
    const value = raw[STORE_KEY];
    if (typeof value !== 'string') return DEFAULT_TRANSLATE;
    const parsed = JSON.parse(value);
    const t = parsed?.state?.translate ?? parsed?.translate;
    if (t && typeof t === 'object') {
      const merged: TranslateSettings = { ...DEFAULT_TRANSLATE, ...t };
      // tiersEnabled is a nested object — JSON merge needs to be explicit so we
      // don't lose the `free`/`premium` keys when the persisted value omits
      // them.
      merged.tiersEnabled = {
        ...DEFAULT_TRANSLATE.tiersEnabled,
        ...(t.tiersEnabled ?? {}),
      };
      if (!Array.isArray(merged.freeChain)) merged.freeChain = DEFAULT_TRANSLATE.freeChain;
      if (!Array.isArray(merged.premiumChain))
        merged.premiumChain = DEFAULT_TRANSLATE.premiumChain;
      return merged;
    }
  } catch (err) {
    console.warn('[Kivara Lingo] could not read translate settings', err);
  }
  return DEFAULT_TRANSLATE;
}

/**
 * Phase 1 surface: returns a DictionaryEntry-ish blob assembled either from
 * the bundled dictionary or from the live translation provider chain.
 */
export async function translateToken(
  token: string,
  lang = 'en',
): Promise<DictionaryEntry | null> {
  // Always try the local dictionary first — it has phonetics and definitions.
  const entry = lookupDictionary(token, lang);
  if (entry) return entry;

  // Fall back to the configured provider(s) for unknown tokens.
  const settings = await loadSettings();
  if (settings.mode === 'single' && settings.provider === 'offline') return null;

  const remote = await translateText({
    text: token,
    sourceLang: lang,
    targetLang: settings.targetLanguage,
  });
  if (!remote.ok || !remote.translatedText) return null;
  return {
    token,
    type: token.includes(' ') ? 'phrase' : 'word',
    translation: remote.translatedText,
    bilingual: remote.translatedText,
  };
}

/**
 * Build the ordered provider list for chain mode. Tier order is fixed
 * (offline → free → premium) but inside each tier the user can reorder.
 *
 * Offline is *not* in the returned list because it's handled separately
 * (cache + bundled dictionary, both in-process, before we even attempt
 * networked providers).
 */
function buildChain(settings: TranslateSettings): TranslateProvider[] {
  const chain: TranslateProvider[] = [];
  if (settings.tiersEnabled.free) {
    for (const p of settings.freeChain) {
      if (p !== 'offline' && !chain.includes(p)) chain.push(p);
    }
  }
  if (settings.tiersEnabled.premium) {
    for (const p of settings.premiumChain) {
      if (p === 'offline' || chain.includes(p)) continue;
      // Drop premium providers that the user hasn't credentialed yet so chain
      // mode doesn't waste a round-trip producing a `*-token-missing` error.
      if (p === 'deepl' && !settings.deeplToken) continue;
      if (p === 'google' && !settings.googleToken) continue;
      // LibreTranslate allows anonymous public-instance calls so we keep it
      // even when the API key is empty.
      chain.push(p);
    }
  }
  return chain;
}

/**
 * Translate arbitrary text. Used both internally (translateToken fallback)
 * and by the popup/options panel to translate the full sentence.
 *
 * Caches results in IndexedDB so repeated lookups for the same word/phrase
 * don't hit DeepL/Google quotas.
 */
export async function translateText(req: TranslateRequest): Promise<TranslateResponse> {
  const text = req.text.trim();
  if (!text) return { ok: true, translatedText: '', provider: 'offline', cached: false };

  const settings = await loadSettings();
  const target = req.targetLang || settings.targetLanguage;

  // 1. In-process cache lookup. We key on a synthetic 'chain'/'single' provider
  // string so switching modes doesn't collide with old per-provider entries.
  const cacheProvider: string =
    settings.mode === 'chain' ? 'chain' : settings.provider;
  const cacheKey = translationCacheKey(cacheProvider, req.sourceLang, target, text);
  try {
    const cached = await getDB().translation_cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ok: true,
        translatedText: cached.translatedText,
        provider: cacheProvider,
        cached: true,
      };
    }
  } catch (err) {
    console.warn('[Kivara Lingo] translation cache read failed', err);
  }

  // 2. Debounce: at most one outbound call every DEBOUNCE_MS to respect
  // free-tier quotas (especially MyMemory's 5000 chars/day anonymous cap).
  const sinceLast = Date.now() - lastCallAt;
  if (sinceLast < DEBOUNCE_MS) {
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS - sinceLast));
  }
  lastCallAt = Date.now();

  // 3. Decide which mode we're in and execute.
  let result:
    | { ok: true; translatedText: string; provider: TranslateProvider; attempted?: ChainStep[] }
    | { ok: false; error: string; provider: TranslateProvider; attempted?: ChainStep[] };
  if (settings.mode === 'single') {
    if (settings.provider === 'offline') {
      return {
        ok: false,
        error: 'Translation provider is set to offline.',
        provider: 'offline',
      };
    }
    const r = await callOne(settings.provider, text, req.sourceLang, target, settings);
    result = r.ok
      ? { ok: true, translatedText: r.translatedText, provider: r.provider }
      : { ok: false, error: r.error, provider: r.provider };
  } else {
    const chain = buildChain(settings);
    if (chain.length === 0) {
      return {
        ok: false,
        error:
          'No translation providers enabled in chain mode. Enable free or premium tier in Settings.',
        provider: 'offline',
      };
    }
    const r = await callChain(chain, text, req.sourceLang, target, settings);
    result = r.ok
      ? {
          ok: true,
          translatedText: r.translatedText,
          provider: r.provider,
          attempted: r.attempted,
        }
      : {
          ok: false,
          error: r.error,
          provider: 'offline',
          attempted: r.attempted,
        };
  }

  // 4. Cache successful results.
  if (result.ok) {
    const ttl = (settings.cacheTtlDays || 30) * 24 * 60 * 60 * 1000;
    try {
      await getDB().translation_cache.put({
        key: cacheKey,
        provider: cacheProvider,
        sourceLang: req.sourceLang,
        targetLang: target,
        sourceText: text,
        translatedText: result.translatedText,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('[Kivara Lingo] translation cache write failed', err);
    }
    return {
      ok: true,
      translatedText: result.translatedText,
      provider: result.provider,
      cached: false,
    };
  }

  return { ok: false, error: result.error, provider: result.provider };
}
