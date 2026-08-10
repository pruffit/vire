export interface ParsedKey {
  pitchClass: number;
  mode: 'major' | 'minor';
}

const NATURAL_PITCH_CLASS: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const NOTE_NAMES: Record<number, string[]> = {
  0: ['c'],
  1: ['c#', 'db'],
  2: ['d'],
  3: ['d#', 'eb'],
  4: ['e'],
  5: ['f'],
  6: ['f#', 'gb'],
  7: ['g'],
  8: ['g#', 'ab'],
  9: ['a'],
  10: ['a#', 'bb'],
  11: ['b'],
};

const MAJOR_SUFFIXES = ['', 'maj', 'major', 'dur'];
const MINOR_SUFFIXES = ['m', 'min', 'minor', 'moll'];

const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function normalizeKeyString(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
}

// Стандартное колесо Camelot: номер растёт на 1 при подъёме на квинту (pc+7 mod 12),
// 8B = C major якорь. 7 самообратно по модулю 12, поэтому прямая и обратная формулы совпадают по форме.
function camelotNumber(majorPitchClass: number): number {
  return mod(7 + 7 * majorPitchClass, 12) + 1;
}

function majorPitchClassFromCamelot(number: number): number {
  return mod(7 * (number - 8), 12);
}

function camelotSpelling(key: ParsedKey): string {
  const majorPc = key.mode === 'minor' ? mod(key.pitchClass + 3, 12) : key.pitchClass;
  const number = camelotNumber(majorPc);
  const letter = key.mode === 'major' ? 'b' : 'a';
  return `${number}${letter}`;
}

function parseNoteAndRest(s: string): { pitchClass: number; rest: string } | null {
  if (s.length === 0) return null;
  const letter = s[0];
  const natural = NATURAL_PITCH_CLASS[letter];
  if (natural === undefined) return null;

  const accidental = s[1];
  if (accidental === '#') {
    return { pitchClass: mod(natural + 1, 12), rest: s.slice(2) };
  }
  if (accidental === 'b') {
    return { pitchClass: mod(natural - 1, 12), rest: s.slice(2) };
  }
  return { pitchClass: natural, rest: s.slice(1) };
}

const CAMELOT_PATTERN = /^(1[0-2]|[1-9])([ab])$/;

export function parseMusicalKey(raw: string | null | undefined): ParsedKey | null {
  if (!raw) return null;
  const normalized = normalizeKeyString(raw);
  if (normalized.length === 0) return null;

  const camelotMatch = CAMELOT_PATTERN.exec(normalized);
  if (camelotMatch) {
    const number = Number(camelotMatch[1]);
    const mode: ParsedKey['mode'] = camelotMatch[2] === 'a' ? 'minor' : 'major';
    const majorPc = majorPitchClassFromCamelot(number);
    const pitchClass = mode === 'minor' ? mod(majorPc - 3, 12) : majorPc;
    return { pitchClass, mode };
  }

  const parsedNote = parseNoteAndRest(normalized);
  if (!parsedNote) return null;

  if (MAJOR_SUFFIXES.includes(parsedNote.rest)) {
    return { pitchClass: parsedNote.pitchClass, mode: 'major' };
  }
  if (MINOR_SUFFIXES.includes(parsedNote.rest)) {
    return { pitchClass: parsedNote.pitchClass, mode: 'minor' };
  }
  return null;
}

export function keySpellings(key: ParsedKey): string[] {
  const suffixes = key.mode === 'major' ? MAJOR_SUFFIXES : MINOR_SUFFIXES;
  const spellings: string[] = [];
  for (const letter of NOTE_NAMES[key.pitchClass]) {
    for (const suffix of suffixes) {
      spellings.push(`${letter}${suffix}`);
    }
  }
  spellings.push(camelotSpelling(key));
  return spellings;
}

export function neighborKeys(key: ParsedKey): ParsedKey[] {
  const { pitchClass, mode } = key;
  const relative: ParsedKey =
    mode === 'minor'
      ? { pitchClass: mod(pitchClass + 3, 12), mode: 'major' }
      : { pitchClass: mod(pitchClass - 3, 12), mode: 'minor' };
  const up: ParsedKey = { pitchClass: mod(pitchClass + 7, 12), mode };
  const down: ParsedKey = { pitchClass: mod(pitchClass - 7, 12), mode };
  return [relative, up, down];
}

export function keyMatchSets(
  raw: string | null | undefined,
): { exact: string[]; neighbor: string[] } | null {
  const parsed = parseMusicalKey(raw);
  if (!parsed) return null;

  const exact = keySpellings(parsed);
  const neighborSet = new Set<string>();
  for (const neighbor of neighborKeys(parsed)) {
    for (const spelling of keySpellings(neighbor)) {
      neighborSet.add(spelling);
    }
  }
  return { exact, neighbor: Array.from(neighborSet) };
}
