import { SubtitleSource } from './types';
import { attachGenericHtml5 } from './generic-html5';

import { attachYouTube } from './youtube';

export async function detectPlatform(): Promise<SubtitleSource | null> {
  const host = window.location.hostname;
  
  if (host.includes('youtube.com')) {
    const video = document.querySelector('video');
    if (video) {
        return attachYouTube();
    }
  }
  
  // Fallback to generic HTML5 video if available
  const video = document.querySelector('video');
  if (video) {
    return attachGenericHtml5(video);
  }

  return null;
}
