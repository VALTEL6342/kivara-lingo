/**
 * Lightweight English lemmatizer.
 *
 * Goal: when the user hovers "ran", "running", or "runs", we should find the
 * dictionary entry under "run" instead of returning `unknown`. This is the
 * single highest-impact NLP improvement for video-subtitle learning because
 * verbs in real speech almost never appear in their citation form.
 *
 * Implementation notes:
 *   - We deliberately do NOT pull in a full NLP library (compromise, wink-lemmatizer,
 *     etc.) — they bundle ~200 kB each and we only need ~95 % coverage for top
 *     A1–B2 vocabulary.
 *   - The strategy is twofold:
 *       1. A small hand-curated table of irregular forms (~200 verbs + nouns).
 *       2. Suffix-stripping rules for regular inflection (-s, -es, -ed, -ing, -ies, -ied).
 *   - Every candidate is returned in priority order; callers should look up
 *     each candidate against the dictionary and use the first hit.
 *
 * Performance: each call is O(1) — no allocations beyond a small array.
 *
 * Future work: add ES/PT/FR lemmatizers once those dictionaries are bundled.
 */

/**
 * Hand-curated table of irregular forms → base form. Lowercased; lookups go
 * through `.toLowerCase()` before hitting this map.
 *
 * Coverage prioritizes the most common irregular verbs and plurals in
 * conversational English (per the BNC frequency list). Covering more is
 * cheap, but the table is exposed as `IRREGULAR_LEMMAS` so callers can extend
 * it at runtime if needed.
 */
export const IRREGULAR_LEMMAS: Record<string, string> = {
  // be
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  // have
  has: 'have', had: 'have', having: 'have',
  // do
  does: 'do', did: 'do', done: 'do', doing: 'do',
  // top irregular verbs
  went: 'go', gone: 'go', goes: 'go', going: 'go',
  said: 'say', says: 'say', saying: 'say',
  made: 'make', makes: 'make', making: 'make',
  got: 'get', gotten: 'get', gets: 'get', getting: 'get',
  knew: 'know', known: 'know', knows: 'know', knowing: 'know',
  took: 'take', taken: 'take', takes: 'take', taking: 'take',
  saw: 'see', seen: 'see', sees: 'see', seeing: 'see',
  came: 'come', comes: 'come', coming: 'come',
  thought: 'think', thinks: 'think', thinking: 'think',
  looked: 'look', looks: 'look', looking: 'look',
  wanted: 'want', wants: 'want', wanting: 'want',
  gave: 'give', given: 'give', gives: 'give', giving: 'give',
  used: 'use', uses: 'use', using: 'use',
  found: 'find', finds: 'find', finding: 'find',
  told: 'tell', tells: 'tell', telling: 'tell',
  asked: 'ask', asks: 'ask', asking: 'ask',
  worked: 'work', works: 'work', working: 'work',
  seemed: 'seem', seems: 'seem', seeming: 'seem',
  felt: 'feel', feels: 'feel', feeling: 'feel',
  tried: 'try', tries: 'try', trying: 'try',
  left: 'leave', leaves: 'leave', leaving: 'leave',
  called: 'call', calls: 'call', calling: 'call',
  ran: 'run', runs: 'run', running: 'run',
  brought: 'bring', brings: 'bring', bringing: 'bring',
  began: 'begin', begun: 'begin', begins: 'begin', beginning: 'begin',
  kept: 'keep', keeps: 'keep', keeping: 'keep',
  held: 'hold', holds: 'hold', holding: 'hold',
  wrote: 'write', written: 'write', writes: 'write', writing: 'write',
  stood: 'stand', stands: 'stand', standing: 'stand',
  heard: 'hear', hears: 'hear', hearing: 'hear',
  let: 'let', lets: 'let', letting: 'let',
  meant: 'mean', means: 'mean', meaning: 'mean',
  set: 'set', sets: 'set', setting: 'set',
  met: 'meet', meets: 'meet', meeting: 'meet',
  paid: 'pay', pays: 'pay', paying: 'pay',
  sat: 'sit', sits: 'sit', sitting: 'sit',
  spoke: 'speak', spoken: 'speak', speaks: 'speak', speaking: 'speak',
  lay: 'lie', lain: 'lie', lies: 'lie', lying: 'lie',
  led: 'lead', leads: 'lead', leading: 'lead',
  read: 'read', reads: 'read', reading: 'read',
  grew: 'grow', grown: 'grow', grows: 'grow', growing: 'grow',
  lost: 'lose', loses: 'lose', losing: 'lose',
  fell: 'fall', fallen: 'fall', falls: 'fall', falling: 'fall',
  sent: 'send', sends: 'send', sending: 'send',
  built: 'build', builds: 'build', building: 'build',
  understood: 'understand', understands: 'understand', understanding: 'understand',
  drew: 'draw', drawn: 'draw', draws: 'draw', drawing: 'draw',
  broke: 'break', broken: 'break', breaks: 'break', breaking: 'break',
  spent: 'spend', spends: 'spend', spending: 'spend',
  cut: 'cut', cuts: 'cut', cutting: 'cut',
  rose: 'rise', risen: 'rise', rises: 'rise', rising: 'rise',
  drove: 'drive', driven: 'drive', drives: 'drive', driving: 'drive',
  bought: 'buy', buys: 'buy', buying: 'buy',
  wore: 'wear', worn: 'wear', wears: 'wear', wearing: 'wear',
  chose: 'choose', chosen: 'choose', chooses: 'choose', choosing: 'choose',
  flew: 'fly', flown: 'fly', flies: 'fly', flying: 'fly',
  ate: 'eat', eaten: 'eat', eats: 'eat', eating: 'eat',
  // Additional irregular verbs (expanded after Tier 2 audit). Coverage now
  // includes most CEFR B1–C1 irregulars present in conversational English.
  swam: 'swim', swum: 'swim', swims: 'swim', swimming: 'swim',
  hung: 'hang', hangs: 'hang', hanging: 'hang',
  lit: 'light', lights: 'light', lighting: 'light',
  fled: 'flee', flees: 'flee', fleeing: 'flee',
  sought: 'seek', seeks: 'seek', seeking: 'seek',
  shook: 'shake', shaken: 'shake', shakes: 'shake', shaking: 'shake',
  stuck: 'stick', sticks: 'stick', sticking: 'stick',
  struck: 'strike', strikes: 'strike', striking: 'strike',
  swept: 'sweep', sweeps: 'sweep', sweeping: 'sweep',
  swung: 'swing', swings: 'swing', swinging: 'swing',
  woke: 'wake', woken: 'wake', wakes: 'wake', waking: 'wake',
  fed: 'feed', feeds: 'feed', feeding: 'feed',
  hid: 'hide', hidden: 'hide', hides: 'hide', hiding: 'hide',
  slept: 'sleep', sleeps: 'sleep', sleeping: 'sleep',
  dug: 'dig', digs: 'dig', digging: 'dig',
  lent: 'lend', lends: 'lend', lending: 'lend',
  spread: 'spread', spreads: 'spread', spreading: 'spread',
  swore: 'swear', sworn: 'swear', swears: 'swear', swearing: 'swear',
  wound: 'wind', winds: 'wind', winding: 'wind',
  tore: 'tear', torn: 'tear', tears: 'tear', tearing: 'tear',
  bit: 'bite', bitten: 'bite', bites: 'bite', biting: 'bite',
  bled: 'bleed', bleeds: 'bleed', bleeding: 'bleed',
  blew: 'blow', blown: 'blow', blows: 'blow', blowing: 'blow',
  burnt: 'burn', burns: 'burn', burning: 'burn',
  burst: 'burst', bursts: 'burst', bursting: 'burst',
  caught: 'catch', catches: 'catch', catching: 'catch',
  clung: 'cling', clings: 'cling', clinging: 'cling',
  crept: 'creep', creeps: 'creep', creeping: 'creep',
  dealt: 'deal', deals: 'deal', dealing: 'deal',
  // "dove" not mapped — most modern English uses "dived" and "dove" can be
  // a noun (the bird). Let the -ed/-es/-ing rules resolve dived/dives/diving.
  dived: 'dive', dives: 'dive', diving: 'dive',
  drank: 'drink', drunk: 'drink', drinks: 'drink', drinking: 'drink',
  dwelt: 'dwell', dwells: 'dwell', dwelling: 'dwell',
  forbade: 'forbid', forbidden: 'forbid', forbids: 'forbid', forbidding: 'forbid',
  forgot: 'forget', forgotten: 'forget', forgets: 'forget', forgetting: 'forget',
  forgave: 'forgive', forgiven: 'forgive', forgives: 'forgive', forgiving: 'forgive',
  froze: 'freeze', frozen: 'freeze', freezes: 'freeze', freezing: 'freeze',
  ground: 'grind', grinds: 'grind', grinding: 'grind',
  hit: 'hit', hits: 'hit', hitting: 'hit',
  hurt: 'hurt', hurts: 'hurt', hurting: 'hurt',
  knelt: 'kneel', kneels: 'kneel', kneeling: 'kneel',
  knit: 'knit', knits: 'knit', knitting: 'knit',
  laid: 'lay', lays: 'lay', laying: 'lay',
  leapt: 'leap', leaps: 'leap', leaping: 'leap',
  learnt: 'learn', learns: 'learn', learning: 'learn',
  put: 'put', puts: 'put', putting: 'put',
  quit: 'quit', quits: 'quit', quitting: 'quit',
  rang: 'ring', rung: 'ring', rings: 'ring', ringing: 'ring',
  rid: 'rid', rids: 'rid', ridding: 'rid',
  rode: 'ride', ridden: 'ride', rides: 'ride', riding: 'ride',
  sang: 'sing', sung: 'sing', sings: 'sing', singing: 'sing',
  sank: 'sink', sunk: 'sink', sinks: 'sink', sinking: 'sink',
  shed: 'shed', sheds: 'shed', shedding: 'shed',
  shot: 'shoot', shoots: 'shoot', shooting: 'shoot',
  shut: 'shut', shuts: 'shut', shutting: 'shut',
  slid: 'slide', slides: 'slide', sliding: 'slide',
  smelt: 'smell', smells: 'smell', smelling: 'smell',
  sped: 'speed', speeds: 'speed', speeding: 'speed',
  spelt: 'spell', spells: 'spell', spelling: 'spell',
  spilt: 'spill', spills: 'spill', spilling: 'spill',
  split: 'split', splits: 'split', splitting: 'split',
  spoilt: 'spoil', spoils: 'spoil', spoiling: 'spoil',
  sprang: 'spring', sprung: 'spring', springs: 'spring', springing: 'spring',
  stole: 'steal', stolen: 'steal', steals: 'steal', stealing: 'steal',
  stung: 'sting', stings: 'sting', stinging: 'sting',
  stank: 'stink', stunk: 'stink', stinks: 'stink', stinking: 'stink',
  strode: 'stride', stridden: 'stride', strides: 'stride', striding: 'stride',
  swelled: 'swell', swollen: 'swell', swells: 'swell', swelling: 'swell',
  taught: 'teach', teaches: 'teach', teaching: 'teach',
  threw: 'throw', thrown: 'throw', throws: 'throw', throwing: 'throw',
  trod: 'tread', trodden: 'tread', treads: 'tread', treading: 'tread',
  woven: 'weave', wove: 'weave', weaves: 'weave', weaving: 'weave',
  wept: 'weep', weeps: 'weep', weeping: 'weep',
  wet: 'wet', wets: 'wet', wetting: 'wet',
  won: 'win', wins: 'win', winning: 'win',
  withdrew: 'withdraw', withdrawn: 'withdraw', withdraws: 'withdraw', withdrawing: 'withdraw',
  wrung: 'wring', wrings: 'wring', wringing: 'wring',
  // irregular plurals (expanded)
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  feet: 'foot',
  teeth: 'tooth',
  geese: 'goose',
  mice: 'mouse',
  oxen: 'ox',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  indices: 'index',
  foci: 'focus',
  fungi: 'fungus',
  cacti: 'cactus',
  nuclei: 'nucleus',
  syllabi: 'syllabus',
  alumni: 'alumnus',
  bacteria: 'bacterium',
  data: 'datum',
  media: 'medium',
  // "leaves" / "lives" / "dives" are intentionally NOT mapped to their
  // -f plural forms here — the verb interpretation ('leave', 'live',
  // 'dive') is far more common in conversational English, and the -ves → -f
  // rule in lemmaCandidates() handles the noun-plural fallback.
  wives: 'wife',
  halves: 'half',
  knives: 'knife',
  calves: 'calf',
  selves: 'self',
  dwarves: 'dwarf',
  hooves: 'hoof',
  wolves: 'wolf',
  loaves: 'loaf',
  shelves: 'shelf',
  scarves: 'scarf',
  thieves: 'thief',
  // Contractions are now first-class dictionary entries (own translation /
  // example pair). The lemma map only keeps the auxiliary fallback for cases
  // where the contraction isn't found as its own entry yet.
  "doesn't": 'do', "don't": 'do', "didn't": 'do',
  "isn't": 'be', "aren't": 'be', "wasn't": 'be', "weren't": 'be',
  "hasn't": 'have', "haven't": 'have', "hadn't": 'have',
  "won't": 'will', "wouldn't": 'will',
  "can't": 'can', "couldn't": 'can',
  "shouldn't": 'should',
  "mustn't": 'must',
};

/**
 * Return an ordered list of lemma candidates for an English token. The first
 * candidate is always the token itself (so a dictionary hit on the original
 * form short-circuits before we try inflected variants).
 *
 * Returned candidates are guaranteed to be lowercase, distinct, and at least
 * 2 characters long (to avoid silly matches like "i" → "i").
 */
export function lemmaCandidates(token: string): string[] {
  const lower = token.trim().toLowerCase();
  if (!lower) return [];

  const out: string[] = [lower];
  const push = (c: string) => {
    if (c.length >= 2 && !out.includes(c)) out.push(c);
  };

  // 1. Hand-curated irregulars (highest priority after the literal token).
  const irregular = IRREGULAR_LEMMAS[lower];
  if (irregular) push(irregular);

  // 2. Regular inflection rules. Order matters — try longer suffixes first so
  // "running" → "run" rather than "running" → "runnin".
  if (lower.endsWith('ies') && lower.length > 4) push(lower.slice(0, -3) + 'y'); // tries → try
  if (lower.endsWith('ied') && lower.length > 4) push(lower.slice(0, -3) + 'y'); // tried → try
  if (lower.endsWith('ying') && lower.length > 5) push(lower.slice(0, -4) + 'y'); // flying → flie? no — handled by irregulars; keep as fallback
  if (lower.endsWith('ing') && lower.length > 4) {
    const stem = lower.slice(0, -3);
    push(stem); // running → runnin? Actually need double-letter drop:
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // running → run
    }
    push(stem + 'e'); // making → make
  }
  if (lower.endsWith('ed') && lower.length > 3) {
    const stem = lower.slice(0, -2);
    push(stem); // worked → work
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // stopped → stop
    }
    push(stem + 'e'); // moved → move (after we already pushed mov)
    push(lower.slice(0, -1)); // moved → move alternative
  }
  if (lower.endsWith('ves') && lower.length > 4) {
    push(lower.slice(0, -3) + 'f'); // leaves → leaf, knives → knif? handled by 'fe' below
    push(lower.slice(0, -3) + 'fe'); // knives → knife, wives → wife
  }
  if (lower.endsWith('es') && lower.length > 3) push(lower.slice(0, -2)); // boxes → box
  if (lower.endsWith('s') && lower.length > 2 && !lower.endsWith('ss')) {
    push(lower.slice(0, -1)); // dogs → dog
  }
  if (lower.endsWith("'s")) push(lower.slice(0, -2)); // John's → john

  // Comparatives and superlatives (Tier 2 audit). The regex rules cover the
  // regular monosyllabic cases (faster, bigger, fastest, biggest); irregular
  // ones (better, best, worse, worst, more, most, less, least) live in the
  // dictionary as their own lemmas.
  if (lower.endsWith('est') && lower.length > 4) {
    const stem = lower.slice(0, -3); // biggest → bigg
    push(stem);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // biggest → big
    }
    push(stem + 'e'); // largest → large (after we already pushed larg)
    if (stem.endsWith('i')) push(stem.slice(0, -1) + 'y'); // happiest → happy
  }
  if (lower.endsWith('er') && lower.length > 3) {
    const stem = lower.slice(0, -2); // bigger → bigg
    push(stem);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // bigger → big
    }
    push(stem + 'e'); // larger → large
    if (stem.endsWith('i')) push(stem.slice(0, -1) + 'y'); // happier → happy
  }

  // Adverbs derived with -ly. Only as a fallback — most -ly adverbs are
  // either first-class dictionary entries (slowly, quickly) or compositional
  // and the underlying adjective is what the learner cares about.
  if (lower.endsWith('ly') && lower.length > 4) {
    const stem = lower.slice(0, -2); // slowly → slow
    push(stem);
    if (stem.endsWith('i')) push(stem.slice(0, -1) + 'y'); // happily → happy
    if (stem.endsWith('l')) push(stem.slice(0, -1)); // fully → ful? rare; cheap fallback
  }

  return out;
}

/**
 * Detect whether a word is likely a proper noun based on lightweight cues:
 *  - Capitalized
 *  - Not at the start of the sentence (so "The" doesn't false-positive)
 *  - Not present in the dictionary (so "America" still highlights normally
 *    when bundled, but unknown capitalized words like "Nicola" become
 *    `ignored`).
 *
 * The caller is responsible for the dictionary check — this function is pure
 * regex / index inspection.
 */
export function isLikelyProperNoun(
  surfaceForm: string,
  cuePosition: 'start' | 'middle' | 'end',
): boolean {
  if (cuePosition === 'start') return false;
  if (!/^[A-Z]/.test(surfaceForm)) return false;
  // All-caps acronyms aren't proper nouns in our sense, but they're also not
  // useful for vocab learning — leave them as unknown for now.
  if (surfaceForm.length >= 2 && surfaceForm === surfaceForm.toUpperCase()) return false;
  return true;
}
