import React, { useState, useEffect } from 'react';
import { SidePanel } from '../content/ui/SidePanel';
import { SubtitleStyles, AnkiMapping } from '../app/types';

export function Popup() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
    modelName: 'KivaraLingo',
    fieldSources: {},
  });

  const mockData = {
    targetSentence: "These days, Nicola doesn't travel much.",
    nativeSentence: "Estos días, Nicola no viaja mucho.",
    word: "these days",
    translation: "estos días",
    phonetic: "/ðiːz deɪz/",
    bilingual: "(noun) estos días",
    monolingual: "Used to refer to the present time period.",
  };

  return (
    <div className={`w-[400px] h-[600px] overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <SidePanel 
        isPopupMode={false} 
        togglePopupMode={() => {}} 
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        styles={subtitleStyles}
        setStyles={setSubtitleStyles}
        mapping={ankiMapping}
        setMapping={setAnkiMapping}
        mockData={mockData}
      />
    </div>
  );
}