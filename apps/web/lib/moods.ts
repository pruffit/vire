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
  | 'NOSTALGIC'
  | 'DREAMY'
  | 'AGGRESSIVE'
  | 'UPLIFTING'
  | 'SAD'
  | 'GROOVY'
  | 'MEDITATIVE'
  | 'TENSE'
  | 'PLAYFUL';

export const ALL_MOODS: Mood[] = [
  'MELANCHOLY', 'NIGHT', 'DRIVE', 'AMBIENT', 'HYPE',
  'CHILL', 'EPIC', 'DARK', 'ROMANTIC', 'NOSTALGIC',
  'DREAMY', 'AGGRESSIVE', 'UPLIFTING', 'SAD', 'GROOVY',
  'MEDITATIVE', 'TENSE', 'PLAYFUL',
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
  DREAMY: 'Мечтательное',
  AGGRESSIVE: 'Агрессивное',
  UPLIFTING: 'Воодушевляющее',
  SAD: 'Грустное',
  GROOVY: 'Грувовое',
  MEDITATIVE: 'Медитативное',
  TENSE: 'Напряжённое',
  PLAYFUL: 'Игривое',
};
