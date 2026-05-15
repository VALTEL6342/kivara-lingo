import React, { useState, useRef, useEffect } from 'react';
import { Volume1, Copy, Check, Quote, AudioLines, Camera } from 'lucide-react';
import { SubtitleStyles } from '../../app/types';
import { tokenizeSentence, SEGMENT_REGISTRY } from '../utils/tokenizer';
import { WordPopover } from './WordPopover';

interface SubtitleOverlayProps {
  subtitleStyles: SubtitleStyles;
  cue: { text: string } | null;
  onSaveCard: (token?: string, sentence?: string) => void;
}

export function SubtitleOverlay({ subtitleStyles, cue, onSaveCard }: SubtitleOverlayProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [captureState, setCaptureState] = useState<'idle' | 'screenshot' | 'audio'>('idle');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [expandedMWEs, setExpandedMWEs] = useState<Set<string>>(new Set());
  const [altExpandedKey, setAltExpandedKey] = useState<string | null>(null);
  const [savedTokens, setSavedTokens] = useState<Set<string>>(new Set());
  
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const wordHoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  
  useEffect(() => { hoveredKeyRef.current = hoveredKey; }, [hoveredKey]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      const hk = hoveredKeyRef.current;
      if (hk && SEGMENT_REGISTRY[hk]?.type === 'phrase') setAltExpandedKey(hk);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' && e.altKey) return;
      if (e.key === 'Alt') e.preventDefault();
      setAltExpandedKey(null);
    };
    const blur = () => setAltExpandedKey(null);
    const visibility = () => { if (document.hidden) setAltExpandedKey(null); };
    
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const effectiveExpanded = React.useMemo(() => {
    if (!altExpandedKey) return expandedMWEs;
    const next = new Set(expandedMWEs);
    next.add(altExpandedKey);
    return next;
  }, [expandedMWEs, altExpandedKey]);

  const targetSentence = cue?.text || "";

  const tokens = React.useMemo(
    () => tokenizeSentence(targetSentence, effectiveExpanded),
    [targetSentence, effectiveExpanded]
  );

  const handleTokenEnter = (key: string) => {
    if (wordHoverTimeout.current) clearTimeout(wordHoverTimeout.current);
    setHoveredKey(key);
  };
  const handleTokenLeave = () => {
    wordHoverTimeout.current = setTimeout(() => setHoveredKey(null), 180);
  };

  if (!cue) return null; // Only render when there's an active cue

  const toggleExpandMWE = (key: string) => {
    setExpandedMWEs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setHoveredKey(null);
  };

  const findParentMWE = (wordKey: string): string | null => {
    for (const phrase of expandedMWEs) {
      if (phrase.split(' ').includes(wordKey.toLowerCase())) return phrase;
    }
    return null;
  };

  const handleSaveToken = (e: React.MouseEvent, token: string) => {
    handleCreateCard(e, token);
    setSavedTokens(prev => new Set(prev).add(token.toLowerCase()));
  };

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  const handleCreateCard = (e: React.MouseEvent, token?: string) => {
    e.stopPropagation();
    // Simulate capture sequence visually
    setCaptureState('screenshot');
    setTimeout(() => {
      setCaptureState('audio');
      setTimeout(() => {
        setCaptureState('idle');
        onSaveCard(token, targetSentence);
      }, 1600);
    }, 220);
  };

  const bgOpacity = (subtitleStyles.backgroundOpacity / 100);
  const bgColor = subtitleStyles.backgroundColor;

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0,0,0';
  };

  const backgroundColorWithOpacity = `rgba(${hexToRgb(bgColor)}, ${bgOpacity})`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetSentence).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="relative w-full h-full pb-24"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: subtitleStyles.position === 'bottom' ? 'flex-end' : subtitleStyles.position === 'top' ? 'flex-start' : 'center',
      }}
    >
      <div 
        className={`transition-all duration-300 pointer-events-auto select-text`}
        style={{ 
          marginBottom: subtitleStyles.position === 'bottom' ? `${subtitleStyles.marginBottom}px` : 0,
          marginTop: subtitleStyles.position === 'top' ? `${subtitleStyles.marginTop}px` : 0,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col items-center gap-1.5 transition-all duration-200">
          
          {/* Action Toolbar on hover */}
          <div className={`absolute -top-12 z-10 flex items-center gap-1 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/60 p-1 rounded-lg shadow-xl transition-all duration-300 transform ${isHovered ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2 pointer-events-none'}`}>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 px-2">Frase</span>
            <div className="w-px h-3.5 bg-zinc-700/80" />
            <button className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700/50 rounded-md transition-colors" title="Reproducir audio de la frase">
              <Volume1 size={14} />
            </button>
            <button onClick={handleCopy} className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700/50 rounded-md transition-colors" title="Copiar texto">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
            <div className="w-px h-3.5 bg-zinc-700/80" />
            <button
              onClick={(e) => handleCreateCard(e, targetSentence)}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium px-2 py-1 rounded transition-colors"
              title="Guardar la frase completa como tarjeta"
            >
              <Quote size={11} /> Guardar frase
            </button>
          </div>

           {/* Fake Capture Overlays */}
           {captureState === 'audio' && (
             <div className="absolute inset-x-0 bottom-full mb-4 flex justify-center pointer-events-none z-50">
               <div className="bg-red-500/90 text-white rounded-full p-2 animate-bounce shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                 <AudioLines size={24} className="animate-pulse" />
               </div>
             </div>
           )}

          <div 
            className="px-6 py-2 rounded max-w-4xl text-center leading-snug tracking-wide transition-all"
            style={{
                fontSize: `${subtitleStyles.fontSize}px`,
              color: subtitleStyles.color,
              backgroundColor: isHovered ? 'rgba(0,0,0,0.8)' : backgroundColorWithOpacity,
              fontWeight: subtitleStyles.fontWeight,
              textShadow: (() => {
                const s = subtitleStyles.textShadow;
                if (s <= 0) return 'none';
                const a = (s / 100).toFixed(2);
                const blur = Math.max(2, Math.round(s / 18));
                  return `2px 2px ${blur}px rgba(0,0,0,${a}), -1px -1px 0 rgba(0,0,0,${a}), 1px -1px 0 rgba(0,0,0,${a}), -1px 1px 0 rgba(0,0,0,${a}), 1px 1px 0 rgba(0,0,0,${a})`;
              })(),
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              boxShadow: isHovered ? '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : 'none'
            }}
          >
            {tokens.map((tok, i) => {
              if (tok.kind === 'punct') return <React.Fragment key={tok.key + i}>{tok.text}</React.Fragment>;
              
              const isTokHovered = hoveredKey === tok.key;
              const isSaved = savedTokens.has(tok.key.toLowerCase());
              
              const colorClass = isTokHovered
                ? 'text-white bg-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.45)]'
                : isSaved
                ? 'text-emerald-300 border-b-2 border-emerald-400/70 hover:bg-emerald-400/10'
                : tok.kind === 'mwe'
                ? 'text-amber-300 border-b-2 border-amber-400 border-dotted hover:bg-amber-400/15'
                : tok.kind === 'known'
                ? 'border-b border-zinc-300/40 border-dashed hover:text-white hover:bg-white/10'
                : 'opacity-90';
                
              const parentForSplit = tok.kind !== 'mwe' ? findParentMWE(tok.key) : null;
              const wheelable = tok.kind === 'mwe' || !!parentForSplit;
              
              const handleWheel = (e: React.WheelEvent) => {
                if (!wheelable) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.deltaY > 0 && tok.kind === 'mwe') {
                  setExpandedMWEs(prev => { const n = new Set(prev); n.add(tok.key); return n; });
                } else if (e.deltaY < 0 && parentForSplit) {
                  setExpandedMWEs(prev => { const n = new Set(prev); n.delete(parentForSplit); return n; });
                  setHoveredKey(null);
                }
              };

              return (
                <span key={tok.key + i} className="relative inline-block cursor-pointer">
                  <span
                    onMouseEnter={() => tok.kind !== 'unknown' && handleTokenEnter(tok.key)}
                    onMouseLeave={handleTokenLeave}
                    onWheel={handleWheel}
                      className={`relative rounded px-0.5 transition-all duration-150 ${
                        isTokHovered ? 'bg-amber-400/80 text-zinc-900 shadow-sm cursor-pointer' : 
                        isSaved ? 'bg-emerald-500/20 text-emerald-200' : ''
                      }`}
                  >
                    {tok.text}
                    {isSaved && !isTokHovered && (
                      <Check size={9} className="inline-block ml-0.5 -mt-1 text-emerald-400" strokeWidth={3} />
                    )}
                  </span>
                  
                  {isTokHovered && tok.kind !== 'unknown' && (
                    <WordPopover
                      visible={true}
                      onMouseEnter={() => handleTokenEnter(tok.key)}
                      onMouseLeave={handleTokenLeave}
                      token={tok.text}
                      kind={tok.kind}
                      isExpanded={expandedMWEs.has(tok.key)}
                      isSaved={isSaved}
                      parentMWE={tok.kind !== 'mwe' ? findParentMWE(tok.key) : null}
                      onToggleExpand={() => toggleExpandMWE(tok.key)}
                      onRejoinParent={(parent) => {
                        setExpandedMWEs(prev => { const n = new Set(prev); n.delete(parent); return n; });
                        setHoveredKey(null);
                      }}
                      onSave={handleSaveToken}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}



