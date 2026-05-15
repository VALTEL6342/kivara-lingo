/// <reference types="chrome" />
import { onMessage } from 'webext-bridge/background';

console.log('Kivara Lingo Service Worker running.');

interface AnkiNotePayload {
  token: string;
  sentence: string;
}

// Basic AnkiConnect implementation for Phase 1
async function invokeAnki(action: string, params: any = {}) {
  const response = await fetch('http://127.0.0.1:8765', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  
  if (!response.ok) throw new Error("HTTP error: " + response.status);
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.result;
}

onMessage('CREATE_CARD', async ({ data }) => {
  console.log('Received request to create Anki card:', data);
  const payload = data as unknown as AnkiNotePayload;
  
  try {
    const noteId = await invokeAnki('addNote', {
      note: {
        deckName: 'Vocabulario Inglés',
        modelName: 'Basic', // Hardcoded fallback or use params
        fields: {
          Front: payload.token + "\n\n" + payload.sentence,
          Back: "Translation placeholder" // Phase 1 doesn't fetch live translations unless in mock
        },
        tags: ["KivaraLingo"]
      }
    });
    console.log('Anki card created successfully:', noteId);
    return { ok: true, noteId };
  } catch (err: any) {
    console.error('Failed to create Anki card:', err);
    return { ok: false, error: err.message };
  }
});

chrome.commands.onCommand.addListener(async (command: string) => {
  // Empty space
});

chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }).catch(() => {});
  }
});
