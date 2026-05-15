export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
  language: string;
}

export type CueListener = (cues: SubtitleCue[]) => void;

export interface SubtitleSource {
  platform: 'netflix' | 'youtube' | 'disney' | 'hbo' | 'prime' | 'generic';
  
  onCueChange(listener: CueListener): void;
  getCurrentTime(): number;
  getActiveCue(): SubtitleCue | null;
  seek(timeMs: number): void;
  
  hideNativeSubtitles(): void;
  showNativeSubtitles(): void;
}