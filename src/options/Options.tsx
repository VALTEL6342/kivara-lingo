import React, { useState } from 'react';
import { SidePanel } from '../content/ui/SidePanel';
import { SubtitleStyles, AnkiMapping } from '../app/types';

export function Options() {
  const [isDarkMode, setIsDarkMode] = useState(true);

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
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-zinc-950' : 'bg-zinc-50'} flex items-center justify-center p-8`}>
      <div className="w-[400px] h-[800px] shadow-2xl overflow-hidden rounded-xl">
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
    </div>
  );
}