import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { SidePanel } from './SidePanel';
import { SubtitleOverlay } from './SubtitleOverlay';
import { SubtitleStyles, AnkiMapping } from '../../app/types';
import { sendMessage } from 'webext-bridge/content-script';

export function App({ adapter, videoOverlayRoot }: { adapter: any, videoOverlayRoot?: HTMLElement | null }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeCue, setActiveCue] = useState<{text: string} | null>(null);
  
  useEffect(() => {
    const mainHost = document.getElementById('kivara-lingo-host');
    const mainRoot = mainHost?.shadowRoot?.getElementById('kivara-lingo-react-root');
    const videoHost = document.getElementById('kivara-lingo-video-host');
    const videoRoot = videoHost?.shadowRoot?.getElementById('kivara-lingo-video-react-root');

    const elementsToUpdate = [
      mainHost,
      mainRoot,
      videoHost,
      videoRoot,
      videoOverlayRoot
    ].filter(Boolean) as HTMLElement[];

    elementsToUpdate.forEach(el => {
      if (isDarkMode) {
        el.classList.add('dark');
        if (el.style) el.style.colorScheme = 'dark';
      } else {
        el.classList.remove('dark');
        if (el.style) el.style.colorScheme = 'light';
      }
    });
  }, [isDarkMode, videoOverlayRoot]);

  useEffect(() => {
    if (adapter) {
      adapter.onCueChange((cues: any[]) => {
        if (cues.length > 0) {
          setActiveCue(cues[0]);
        } else {
          setActiveCue(null);
        }
      });
      const initialCue = adapter.getActiveCue?.();
      if (initialCue) setActiveCue(initialCue);
    }
  }, [adapter]);

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === 'TOGGLE_PANEL') {
        setIsPanelOpen(prev => !prev);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const [subtitleStyles, setSubtitleStyles] = useState<SubtitleStyles>({
    fontSize: 32,
    color: '#FCD34D',
    backgroundColor: '#000000',
    backgroundOpacity: 60,
    position: 'bottom',
    verticalOffset: 85,
    fontWeight: 'bold',
    textShadow: 80,
  });

  const [ankiMapping, setAnkiMapping] = useState<AnkiMapping>({
    ankiUrl: 'http://127.0.0.1:8765',
    deckName: 'Vocabulario Inglés',
    modelName: 'Basic', // 'KivaraLingo'
    fieldSources: {},
  });

  const handleSaveCard = (token?: string, sentence?: string) => {
    const saved = token || "frase";

    sendMessage('CREATE_CARD', { token: saved, sentence: sentence || '' }).then(() => {
      toast.custom((id) => (
        <div className="flex items-center gap-2.5 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60 rounded-lg shadow-2xl px-3 py-2.5 min-w-[280px]">
          <div className="w-7 h-7 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white leading-tight">Tarjeta guardada</div>
            <div className="text-[10px] text-zinc-400 leading-tight mt-0.5 truncate">
              <span className="font-mono text-indigo-300">{saved}</span>
              <span className="text-zinc-500"> → </span>
              {ankiMapping.deckName}
            </div>
          </div>
          <button onClick={() => toast.dismiss(id)} className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded transition-colors shrink-0">
            OK
          </button>
        </div>
      ), { duration: 3200 });
    }).catch(err => {
      console.error(err);
      toast.error('Error guardando en Anki: ' + err.message);
    });
  };

  return (
    <div className={`font-sans text-zinc-900 dark:text-zinc-100 pointer-events-none ${isDarkMode ? 'dark' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 999999, colorScheme: isDarkMode ? 'dark' : 'light' }}>
      <div className="pointer-events-auto">
        <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
      </div>

      {videoOverlayRoot ? 
        createPortal(
          <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${isDarkMode ? 'dark' : ''}`} style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}>
            <SubtitleOverlay 
                subtitleStyles={subtitleStyles}
                cue={activeCue}
                onSaveCard={handleSaveCard}
              />
          </div>,
          videoOverlayRoot
        ) : (
          <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${isDarkMode ? 'dark' : ''}`} style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}>
            <SubtitleOverlay 
                subtitleStyles={subtitleStyles}
                cue={activeCue}
                onSaveCard={handleSaveCard}
              />
          </div>
        )
      }

      <div className="pointer-events-auto">
        {isPanelOpen && (
          <SidePanel 
            isPopupMode={true} 
            togglePopupMode={() => setIsPanelOpen(false)} 
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            styles={subtitleStyles}
            setStyles={setSubtitleStyles}
            mapping={ankiMapping}
            setMapping={setAnkiMapping}
            mockData={{
              targetSentence: "",
              nativeSentence: "",
              word: "",
              translation: "",
              phonetic: "",
              bilingual: "",
              monolingual: ""
            }}
          />
        )}
      </div>
    </div>
  );
}

