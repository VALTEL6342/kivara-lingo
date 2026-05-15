import { createRoot } from 'react-dom/client';
import { ShadowHost } from './shadow-host';
import { detectPlatform } from './platform-adapters';
import { App } from './ui/App';

console.log('Kivara Lingo Content Script injected.');

async function init() {
  const adapter = await detectPlatform();

  // Wait for the video player container to exist, particularly on YouTube SPA navigations
  let attempts = 0;
  let videoContainer = null;
  while (attempts < 20) {
    if (window.location.hostname.includes('youtube.com')) {
      videoContainer = document.querySelector('.html5-video-player') as HTMLElement;
    } else {
      const video = document.querySelector('video');
      videoContainer = video?.parentElement as HTMLElement;
    }
    if (videoContainer) break;
    await new Promise(r => setTimeout(r, 200));
    attempts++;
  }

  if (!adapter && !videoContainer) {
    console.log('Kivara Lingo: No supported video platform found on this page.');
  }

  // Hide native subtitles if available
  adapter?.hideNativeSubtitles?.();

  // Create our isolated UI container
  const host = ShadowHost.mount(document.body);
  
  let videoReactRoot = null;
  if (videoContainer) {
      const videoHost = ShadowHost.mount(videoContainer, { isOverlay: true });
      videoReactRoot = videoHost.reactRoot;
  }
  
  // Render the React App inside host.reactRoot
  createRoot(host.reactRoot).render(
    <App adapter={adapter} videoOverlayRoot={videoReactRoot} />
  );
}

// Start
init();