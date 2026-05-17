import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage } from 'webext-bridge/popup';
import { Power, ExternalLink, MicIcon, MicOffIcon, Settings } from 'lucide-react';
import { useKivaraStore } from '../shared/store';
import { KivaraLingoLogo } from '../app/components/KivaraLingoLogo';
import type { AnkiPingErrorCode, AnkiPingResponse } from '../shared/types';

interface PingState {
  status: 'idle' | 'pinging' | 'ok' | 'error';
  version?: number;
  error?: string;
  code?: AnkiPingErrorCode;
}

export function Popup() {
  const {
    enabled,
    isDarkMode,
    audioCaptureActive,
    ankiMapping,
    setEnabled,
    setPanelOpen,
    setIsDarkMode,
    setAudioCaptureActive,
  } = useKivaraStore();

  const [ping, setPing] = useState<PingState>({ status: 'idle' });
  const cancelledRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  /**
   * Single source of truth for pinging AnkiConnect. Wrapped in `useCallback`
   * so the auto-poll effect and the "Reintentar" button both call exactly
   * the same code path.
   */
  const runPing = useCallback(async () => {
    setPing({ status: 'pinging' });
    try {
      const result = (await sendMessage(
        'ANKI_PING',
        { url: ankiMapping.ankiUrl, apiKey: ankiMapping.apiKey },
        'background',
      )) as AnkiPingResponse;
      if (cancelledRef.current) return;
      if (result.ok) setPing({ status: 'ok', version: result.version });
      else setPing({ status: 'error', error: result.error, code: result.code });
    } catch (err) {
      if (cancelledRef.current) return;
      const reason = err instanceof Error ? err.message : 'unknown';
      setPing({ status: 'error', error: reason });
    }
  }, [ankiMapping.ankiUrl, ankiMapping.apiKey]);

  // Ping on mount / when the AnkiConnect URL or API key changes.
  useEffect(() => {
    cancelledRef.current = false;
    void runPing();
    return () => {
      cancelledRef.current = true;
    };
  }, [runPing]);

  // Auto-retry every 4s while we are in an error state. This is what the
  // user actually wants: open the popup, open Anki, and watch the dot
  // turn green within a few seconds — without having to remember to
  // press "Reintentar".
  useEffect(() => {
    if (ping.status !== 'error') return;
    const interval = window.setInterval(() => {
      void runPing();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [ping.status, runPing]);

  // Re-ping the instant the popup regains focus — e.g. the user just
  // alt-tabbed to start Anki and came back.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void runPing();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [runPing]);

  async function openPanelOnActiveTab() {
    setPanelOpen(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_PANEL' });
      }
    } catch {
      // ignore — no content script on tab
    }
    window.close();
  }

  async function toggleAudioCapture() {
    const next = !audioCaptureActive;
    setAudioCaptureActive(next);
    try {
      if (next) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const result = (await sendMessage(
          'START_AUDIO_CAPTURE',
          { tabId: tab?.id },
          'background',
        )) as { ok: boolean; error?: string };
        if (!result.ok) {
          setAudioCaptureActive(false);
          setPing((p) => ({ ...p, error: result.error || 'No se pudo iniciar la captura.' }));
        }
      } else {
        await sendMessage('STOP_AUDIO_CAPTURE', {}, 'background');
      }
    } catch (err) {
      setAudioCaptureActive(false);
      console.warn('[Kivara Lingo] toggleAudioCapture failed', err);
    }
  }

  function openOptions() {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  }

  const statusColor =
    ping.status === 'ok'
      ? 'bg-emerald-500'
      : ping.status === 'error'
        ? 'bg-rose-500'
        : 'bg-amber-400';

  const statusLabel =
    ping.status === 'ok'
      ? `Conectado a Anki (v${ping.version})`
      : ping.status === 'pinging'
        ? 'Comprobando AnkiConnect…'
        : ping.status === 'error'
          ? 'AnkiConnect no responde'
          : '—';

  return (
    <div className={`w-[360px] ${isDarkMode ? 'dark' : ''}`} style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}>
      <div className="p-4 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KivaraLingoLogo size={28} />
            <div>
              <div className="text-sm font-bold leading-none">Kivara Lingo</div>
              <div className="text-[10px] text-zinc-500 leading-none mt-0.5">v0.2 — Fase 2</div>
            </div>
          </div>
          <button
            onClick={openOptions}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            title="Abrir página de opciones"
          >
            <Settings size={14} />
          </button>
        </header>

        <section className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
              <span className="text-[12px]">{statusLabel}</span>
            </div>
            <button
              onClick={() => void runPing()}
              disabled={ping.status === 'pinging'}
              className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
            >
              Reintentar
            </button>
          </div>
          {ping.status === 'error' && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              {ping.code === 'API_KEY'
                ? 'Tu AnkiConnect requiere API key — configúrala en la tab Cards → Conexión.'
                : ping.code === 'TIMEOUT'
                  ? 'AnkiConnect tardó demasiado. Verifica que Anki esté respondiendo.'
                  : 'Abre Anki y verifica que el complemento AnkiConnect esté instalado. Los subtítulos y la traducción siguen funcionando sin conexión — solo "Guardar" requiere Anki.'}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <button
            onClick={() => setEnabled(!enabled)}
            className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              enabled
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Power size={14} />
              {enabled ? 'Extensión activada' : 'Extensión desactivada'}
            </span>
          </button>

          <button
            onClick={openPanelOnActiveTab}
            className="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            <span>Abrir panel en la pestaña</span>
            <ExternalLink size={12} />
          </button>

          <button
            onClick={toggleAudioCapture}
            className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              audioCaptureActive
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25'
                : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
            title="Captura el audio de la pestaña para anexar a las tarjetas Anki"
          >
            <span className="flex items-center gap-2">
              {audioCaptureActive ? <MicIcon size={14} /> : <MicOffIcon size={14} />}
              {audioCaptureActive ? 'Captura de audio activa' : 'Activar captura de audio'}
            </span>
            <span className="text-[9px] text-zinc-500">tabCapture</span>
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full text-left text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1"
          >
            Cambiar a tema {isDarkMode ? 'claro' : 'oscuro'}
          </button>
        </section>
      </div>
    </div>
  );
}
