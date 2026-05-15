import globalsCss from '../styles/globals.css?inline';
import themeCss from '../styles/theme.css?inline';
import tailwindCss from '../styles/tailwind.css?inline';

export class ShadowHost {
  static mount(container: HTMLElement, options: { isOverlay?: boolean } = {}) {
    const hostElement = document.createElement('div');
    hostElement.id = options.isOverlay ? 'kivara-lingo-video-host' : 'kivara-lingo-host';
    
    // Position it robustly to overlay absolute on top without interfering
    hostElement.style.position = options.isOverlay ? 'absolute' : 'fixed';
    hostElement.style.top = '0';
    hostElement.style.left = '0';
    hostElement.style.width = '100%';
    hostElement.style.height = options.isOverlay ? '100%' : '0'; 
    hostElement.style.zIndex = '2147483647'; // Max z-index
    hostElement.style.pointerEvents = 'none'; // Only interactive elements inside should capture clicks

    container.appendChild(hostElement);

    const shadowRoot = hostElement.attachShadow({ mode: 'open' });
    
    const styleEl = document.createElement('style');
    styleEl.textContent = `${globalsCss}\n${themeCss}\n${tailwindCss}`;
    shadowRoot.appendChild(styleEl);

    const reactRoot = document.createElement('div');
    reactRoot.id = options.isOverlay ? 'kivara-lingo-video-react-root' : 'kivara-lingo-react-root';
    if (!options.isOverlay) {
        reactRoot.style.pointerEvents = 'auto'; // allow clicks on panels/popovers
    }
    // For overlay, we want the root div to fill the container unconditionally
    if (options.isOverlay) {
        reactRoot.style.position = 'absolute';
        reactRoot.style.inset = '0';
        reactRoot.style.pointerEvents = 'none';
        reactRoot.style.display = 'flex';
        reactRoot.style.flexDirection = 'column';
    }
    
    shadowRoot.appendChild(reactRoot);

    return { hostElement, shadowRoot, reactRoot };
  }
}