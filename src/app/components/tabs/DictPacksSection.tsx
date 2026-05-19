/**
 * Dictionary Packs management section.
 *
 * Lists Yomitan-compatible packs the user has installed (stored in IndexedDB
 * via Dexie), lets them toggle each pack on/off, and offers four import
 * surfaces:
 *
 *   1. **Pack gallery**          — one-click "Importar" buttons for the
 *                                  curated Wiktionary EN→ES / IPA / Monolingüe
 *                                  packs published by the kaikki-to-yomitan
 *                                  project. The URL is downloaded by the
 *                                  service worker (which carries the
 *                                  extension's host_permissions).
 *   2. **Import from URL**       — same flow as the gallery, but with a
 *                                  user-entered URL — handy for nightly
 *                                  builds and forks.
 *   3. **Import from .zip file** — original local-file picker. Unchanged.
 *   4. **Personal CSV/TSV list** — paste a list of `word, translation, …`
 *                                  rows that surface in the popover under a
 *                                  synthetic "Mi lista" pack.
 *   5. **StarDict (.zip)**       — accepts StarDict bundles (`.ifo / .idx /
 *                                  .dict.dz`) zipped together. Imported as
 *                                  a regular Yomitan-style pack so it
 *                                  participates in normal lookups.
 *
 * All five paths share the same downstream pipeline (`dict_packs` +
 * `dict_terms` rows in Dexie), so once a pack is in IndexedDB every
 * surface — popover, save-card enrichment, options page — sees it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookText,
  Trash2,
  Upload,
  Power,
  PowerOff,
  Loader2,
  Globe,
  Download,
  FileText,
  Library,
} from 'lucide-react';
import type { DictPackRow } from '../../../shared/db';
import {
  importYomitanPack,
  importYomitanPackFromUrl,
  listYomitanPacks,
  deleteYomitanPack,
  setPackEnabled,
} from '../../../content/nlp/yomitan';
import { importCsvList } from '../../../content/nlp/csv-importer';
import { importStarDictPack } from '../../../content/nlp/stardict';

interface ImportFeedback {
  kind: 'ok' | 'err';
  message: string;
}

interface RecommendedPack {
  /** Display title shown in the gallery card. */
  title: string;
  /** One-line description of what's inside. */
  description: string;
  /** ZIP download URL (Yomitan-format). */
  url: string;
  /** Approximate compressed size — surfaced so users know the cost. */
  size: string;
  /** Coverage / impact tier — colours the card border for quick scanning. */
  tier: 'recommended' | 'core' | 'premium';
}

/**
 * Curated catalog of high-quality Wiktionary-derived packs published weekly
 * by the kaikki-to-yomitan project.
 *
 * Reference: https://github.com/themoeway/kaikki-to-yomitan
 */
const RECOMMENDED_PACKS: RecommendedPack[] = [
  {
    title: 'Wiktionary EN→ES',
    description: 'Diccionario bilingüe inglés→español (≈250 000 entradas, CC-BY-SA).',
    url: 'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-en-es.zip',
    size: '≈14 MB',
    tier: 'core',
  },
  {
    title: 'Wiktionary EN IPA',
    description: 'Transcripción fonética IPA real para ~200 000 palabras inglesas.',
    url: 'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-en-ipa.zip',
    size: '≈4 MB',
    tier: 'recommended',
  },
  {
    title: 'Wiktionary EN→EN',
    description: 'Definiciones monolingües en inglés (B2+). Útil para inmersión.',
    url: 'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-en-en.zip',
    size: '≈40 MB',
    tier: 'premium',
  },
];

export function DictPacksSection() {
  const [packs, setPacks] = useState<DictPackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvTitle, setCsvTitle] = useState('Mi lista');
  const [csvText, setCsvText] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stardictInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listYomitanPacks();
      setPacks(list);
    } catch (err) {
      console.warn('[Kivara Lingo] could not list dict packs', err);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onPickFile = useCallback(() => fileInputRef.current?.click(), []);
  const onPickStarDict = useCallback(() => stardictInputRef.current?.click(), []);
  const onPickCsvFile = useCallback(() => csvFileInputRef.current?.click(), []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setFeedback(null);
      setImporting(true);
      try {
        const buffer = await file.arrayBuffer();
        const result = await importYomitanPack(buffer);
        if (result.ok) {
          setFeedback({
            kind: 'ok',
            message: `${result.pack.title} · ${result.termsImported.toLocaleString()} términos importados`,
          });
        } else {
          setFeedback({ kind: 'err', message: result.error });
        }
        await refresh();
      } catch (err) {
        setFeedback({
          kind: 'err',
          message: `Error inesperado: ${(err as Error).message}`,
        });
      } finally {
        setImporting(false);
      }
    },
    [refresh],
  );

  const onStarDictFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setFeedback(null);
      setImporting(true);
      try {
        const buffer = await file.arrayBuffer();
        const result = await importStarDictPack(buffer);
        if (result.ok) {
          setFeedback({
            kind: 'ok',
            message: `${result.pack.title} · ${result.termsImported.toLocaleString()} términos importados (StarDict)`,
          });
        } else {
          setFeedback({ kind: 'err', message: result.error });
        }
        await refresh();
      } catch (err) {
        setFeedback({
          kind: 'err',
          message: `Error inesperado: ${(err as Error).message}`,
        });
      } finally {
        setImporting(false);
      }
    },
    [refresh],
  );

  const onImportUrl = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setFeedback(null);
      setImportingUrl(trimmed);
      try {
        const result = await importYomitanPackFromUrl(trimmed);
        if (result.ok) {
          setFeedback({
            kind: 'ok',
            message: `${result.pack.title} · ${result.termsImported.toLocaleString()} términos importados`,
          });
          setUrlInput('');
        } else {
          setFeedback({ kind: 'err', message: result.error });
        }
        await refresh();
      } catch (err) {
        setFeedback({
          kind: 'err',
          message: `Error inesperado: ${(err as Error).message}`,
        });
      } finally {
        setImportingUrl(null);
      }
    },
    [refresh],
  );

  const onImportCsv = useCallback(async () => {
    setFeedback(null);
    setImportingCsv(true);
    try {
      const result = await importCsvList(csvText, { title: csvTitle.trim() || 'Mi lista' });
      if (result.ok) {
        setFeedback({
          kind: 'ok',
          message: `${result.pack.title} · ${result.termsImported.toLocaleString()} términos importados${
            result.skipped > 0 ? ` (${result.skipped} saltados)` : ''
          }`,
        });
        setCsvText('');
        setCsvOpen(false);
      } else {
        setFeedback({ kind: 'err', message: result.error });
      }
      await refresh();
    } catch (err) {
      setFeedback({
        kind: 'err',
        message: `Error inesperado: ${(err as Error).message}`,
      });
    } finally {
      setImportingCsv(false);
    }
  }, [csvText, csvTitle, refresh]);

  const onCsvFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        // Default the title to the filename minus extension if the user
        // hasn't typed one yet (or left the placeholder).
        const baseTitle = file.name.replace(/\.[^.]+$/, '');
        if (!csvTitle.trim() || csvTitle === 'Mi lista') {
          setCsvTitle(baseTitle);
        }
        setCsvText(text);
        setCsvOpen(true);
      } catch (err) {
        setFeedback({
          kind: 'err',
          message: `No se pudo leer el archivo: ${(err as Error).message}`,
        });
      }
    },
    [csvTitle],
  );

  const onToggle = useCallback(
    async (pack: DictPackRow) => {
      await setPackEnabled(pack.id, !pack.enabled);
      await refresh();
    },
    [refresh],
  );

  const onDelete = useCallback(
    async (pack: DictPackRow) => {
      if (
        // eslint-disable-next-line no-alert
        !window.confirm(`¿Eliminar "${pack.title}" y sus ${pack.termCount.toLocaleString()} términos?`)
      ) {
        return;
      }
      await deleteYomitanPack(pack.id);
      await refresh();
    },
    [refresh],
  );

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <header className="px-2.5 py-1.5 bg-zinc-50/60 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2">
        <BookText size={10} className="text-zinc-500" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex-1">
          Diccionarios offline
        </h3>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 normal-case">
          {packs.length} {packs.length === 1 ? 'pack' : 'packs'}
        </span>
      </header>
      <div className="p-2.5 space-y-3">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 leading-snug">
          Importa packs en formato Yomitan (.zip) o StarDict, o pega una lista CSV/TSV personal.
          Toda la data se guarda en IndexedDB — los packs grandes (50 MB+) no afectan al tamaño de la extensión.
        </p>

        {/* ── Pack gallery (Tier 3a) ──────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1.5">
            <Library size={10} />
            Packs recomendados
          </div>
          <ul className="grid grid-cols-1 gap-1.5">
            {RECOMMENDED_PACKS.map((p) => (
              <li
                key={p.url}
                className={`border rounded px-2 py-1.5 flex items-center gap-2 ${
                  p.tier === 'core'
                    ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-900/10'
                    : p.tier === 'recommended'
                    ? 'border-zinc-200 dark:border-zinc-800'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 truncate normal-case">
                      {p.title}
                    </span>
                    <span className="text-[9px] text-zinc-500 normal-case shrink-0">{p.size}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 normal-case leading-snug">
                    {p.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onImportUrl(p.url)}
                  disabled={importingUrl === p.url || importing}
                  className="text-[10px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title={`Importar desde ${p.url}`}
                >
                  {importingUrl === p.url ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  {importingUrl === p.url ? 'Descargando…' : 'Importar'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Installed packs list ────────────────────────────────────── */}
        {loading ? (
          <div className="text-[11px] text-zinc-500 italic">Cargando packs…</div>
        ) : packs.length === 0 ? null : (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Instalados
            </div>
            <ul className="space-y-1.5">
              {packs.map((pack) => (
                <li
                  key={pack.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 truncate normal-case">
                        {pack.title}
                      </span>
                      <span className="text-[9px] text-zinc-500 normal-case shrink-0">
                        {pack.sourceLang} → {pack.targetLang}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 normal-case flex gap-2">
                      <span>{pack.termCount.toLocaleString()} términos</span>
                      <span>· rev. {pack.revision}</span>
                      {!pack.enabled && (
                        <span className="text-rose-400">· deshabilitado</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onToggle(pack)}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                    title={pack.enabled ? 'Deshabilitar' : 'Habilitar'}
                  >
                    {pack.enabled ? <Power size={12} /> : <PowerOff size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(pack)}
                    className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Import from URL ─────────────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1.5">
            <Globe size={10} />
            Importar desde URL
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…/pack.zip"
              className="sl-input flex-1 text-[11px] py-1 px-1.5"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim() && !importingUrl) {
                  void onImportUrl(urlInput);
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onImportUrl(urlInput)}
              disabled={!urlInput.trim() || !!importingUrl}
              className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importingUrl === urlInput.trim() ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Download size={11} />
              )}
              Descargar
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1 leading-snug">
            Cualquier ZIP de Yomitan público (R2, GitHub Pages, …). La extensión hace la descarga
            por ti — no necesitas guardar el archivo a disco.
          </p>
        </div>

        {/* ── Action row: local file pickers (Yomitan + StarDict + CSV) ── */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
          <button
            type="button"
            onClick={onPickFile}
            disabled={importing}
            className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Importar archivo .zip Yomitan"
          >
            {importing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            Yomitan .zip
          </button>
          <button
            type="button"
            onClick={onPickStarDict}
            disabled={importing}
            className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Importar bundle StarDict (.ifo/.idx/.dict zipped)"
          >
            <BookText size={11} />
            StarDict .zip
          </button>
          <button
            type="button"
            onClick={() => setCsvOpen((v) => !v)}
            className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5"
          >
            <FileText size={11} />
            Lista CSV/TSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void onFile(e)}
            className="hidden"
          />
          <input
            ref={stardictInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void onStarDictFile(e)}
            className="hidden"
          />
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(e) => void onCsvFile(e)}
            className="hidden"
          />
        </div>

        {/* ── CSV import drawer (Tier 3b) ─────────────────────────────── */}
        {csvOpen && (
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-2 space-y-2 bg-zinc-50/60 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={csvTitle}
                onChange={(e) => setCsvTitle(e.target.value)}
                placeholder="Título de la lista"
                className="sl-input flex-1 text-[11px] py-1 px-1.5"
              />
              <button
                type="button"
                onClick={onPickCsvFile}
                className="text-[10px] px-1.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1"
                title="Cargar archivo .csv / .tsv"
              >
                <Upload size={10} />
                Archivo…
              </button>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'word, translation, phonetic, definition, example\nhello, hola, /heˈloʊ/, A greeting, Hello world!'}
              rows={5}
              className="sl-input w-full text-[11px] font-mono py-1 px-1.5 leading-tight"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onImportCsv()}
                disabled={!csvText.trim() || importingCsv}
                className="text-[11px] px-2 py-1 rounded border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importingCsv ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Upload size={11} />
                )}
                Importar lista
              </button>
              <button
                type="button"
                onClick={() => {
                  setCsvOpen(false);
                  setCsvText('');
                }}
                className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <span className="text-[10px] text-zinc-500 normal-case leading-snug">
                Coma o tabulador como separador. Cabecera opcional.
              </span>
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`text-[10px] leading-snug normal-case pt-0.5 ${
              feedback.kind === 'ok' ? 'text-emerald-500' : 'text-rose-400'
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </section>
  );
}
