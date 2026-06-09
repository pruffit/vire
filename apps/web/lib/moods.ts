export type Mood =
  | 'MELANCHOLY'
  | 'NIGHT'
  | 'DRIVE'
  | 'AMBIENT'
  | 'HYPE'
  | 'CHILL'
  | 'EPIC'
  | 'DARK'
  | 'ROMANTIC'
  | 'NOSTALGIC';

export const ALL_MOODS: Mood[] = [
  'MELANCHOLY', 'NIGHT', 'DRIVE', 'AMBIENT', 'HYPE',
  'CHILL', 'EPIC', 'DARK', 'ROMANTIC', 'NOSTALGIC',
];

export const MOOD_LABELS: Record<Mood, string> = {
  MELANCHOLY: 'Меланхолия',
  NIGHT: 'Ночь',
  DRIVE: 'Драйв',
  AMBIENT: 'Эмбиент',
  HYPE: 'Энергия',
  CHILL: 'Релакс',
  EPIC: 'Эпик',
  DARK: 'Тёмное',
  ROMANTIC: 'Романтика',
  NOSTALGIC: 'Ностальгия',
};
