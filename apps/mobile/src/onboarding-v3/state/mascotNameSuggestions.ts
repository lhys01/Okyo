export const MASCOT_NAME_SUGGESTIONS = Object.freeze([
  'Kiko', 'Milo', 'Luna', 'Theo', 'Ollie', 'Coco', 'Mochi', 'Leo', 'Pip', 'Nico',
  'Sunny', 'Teddy', 'Remy', 'Mika', 'Finn', 'Ruby', 'Louie', 'Bean', 'Archie', 'Nori',
] as const);

export const TYPEWRITER_NAME_SUGGESTIONS = Object.freeze([
  'Milo', 'Luna', 'Theo', 'Ollie', 'Coco', 'Mochi', 'Leo', 'Nico',
  'Sunny', 'Remy', 'Mika', 'Finn', 'Ruby', 'Louie', 'Archie', 'Nori',
] as const);

export const NAME_TYPEWRITER_TIMINGS = Object.freeze({ typeMs: 125, pauseMs: 900, deleteMs: 85 });

export type NameTypewriterState = {
  nameIndex: number;
  phase: 'typing' | 'pausing' | 'deleting';
  text: string;
};

export function createNameTypewriterState(nameIndex = 0): NameTypewriterState {
  return { nameIndex: normalizeIndex(nameIndex, TYPEWRITER_NAME_SUGGESTIONS.length), phase: 'typing', text: '' };
}

export function advanceNameTypewriter(state: NameTypewriterState): NameTypewriterState {
  const name = TYPEWRITER_NAME_SUGGESTIONS[normalizeIndex(state.nameIndex, TYPEWRITER_NAME_SUGGESTIONS.length)];
  if (state.phase === 'typing') {
    const text = name.slice(0, state.text.length + 1);
    return { ...state, phase: text === name ? 'pausing' : 'typing', text };
  }
  if (state.phase === 'pausing') return { ...state, phase: 'deleting' };
  const text = state.text.slice(0, -1);
  return text.length > 0
    ? { ...state, text }
    : createNameTypewriterState(state.nameIndex + 1);
}

export function getNameTypewriterDelay(state: NameTypewriterState): number {
  if (state.phase === 'pausing') return NAME_TYPEWRITER_TIMINGS.pauseMs;
  return state.phase === 'deleting' ? NAME_TYPEWRITER_TIMINGS.deleteMs : NAME_TYPEWRITER_TIMINGS.typeMs;
}

export function shouldAnimateNamePlaceholder(value: string, focused: boolean, reduceMotion: boolean): boolean {
  return value.length === 0 && !focused && !reduceMotion;
}

export function pickRandomMascotName(previous: string | null, random = Math.random): string {
  const choices = MASCOT_NAME_SUGGESTIONS.filter((name) => name !== previous);
  const safeRandom = Math.max(0, Math.min(0.999999, random()));
  return choices[Math.floor(safeRandom * choices.length)] ?? 'Kiko';
}

function normalizeIndex(index: number, length: number): number {
  return ((Math.trunc(index) % length) + length) % length;
}

