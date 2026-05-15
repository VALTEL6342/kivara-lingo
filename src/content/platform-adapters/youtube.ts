import { SubtitleSource, SubtitleCue, CueListener } from './types';

export function attachYouTube(): SubtitleSource | null {
  const video = document.querySelector('video');
  if (!video) return null;

  const captionContainer = document.querySelector('.ytp-caption-window-container');
  if (!captionContainer) {
    // Sometimes it loads late, but for now we expect it to exist or we retry later
  }

  const listeners: CueListener[] = [];
  let currentActiveCue: SubtitleCue | null = null;
  let isNativeHidden = false;

  let parseInterval: any = null;

  const parseCues = () => {
    // YouTube's active subtitles logic: look at .captions-text
    const segments = document.querySelectorAll('.captions-text');
    if (segments.length === 0) {
      if (currentActiveCue !== null) {
        currentActiveCue = null;
        listeners.forEach(l => l([]));
      }
      return;
    }

    // Join text from all current segments using textContent
    const text = Array.from(segments).map(el => el.textContent || '').join('\n').trim();
    if (!text) {
      if (currentActiveCue !== null) {
        currentActiveCue = null;
        listeners.forEach(l => l([]));
      }
      return;
    }

    const now = video.currentTime * 1000;
    
    // Avoid re-emitting the same text
    if (currentActiveCue && currentActiveCue.text === text) {
      currentActiveCue.end = now + 1000;
      return;
    }

    currentActiveCue = {
      id: Math.random().toString(),
      start: now,
      end: now + 2000,
      text: text,
      language: 'en'
    };

    listeners.forEach(l => l([currentActiveCue!]));
  };

  // YouTube dynamically recreates caption containers, observing the whole body or polling is occasionally more robust
  parseInterval = setInterval(parseCues, 100);

  // To hide native subtitles on YouTube, we must inject CSS
  const styleId = 'kivara-lingo-yt-hide';
  
  return {
    platform: 'youtube',
    onCueChange(listener) {
      listeners.push(listener);
    },
    getCurrentTime() {
      return video.currentTime * 1000;
    },
    getActiveCue() {
      return currentActiveCue;
    },
    seek(timeMs) {
      video.currentTime = timeMs / 1000;
    },
    hideNativeSubtitles() {
      isNativeHidden = true;
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.caption-window { opacity: 0 !important; }'; // Hide the window but keep DOM updates
        document.head.appendChild(style);
      }
    },
    showNativeSubtitles() {
      isNativeHidden = false;
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    }
  };
}