// Клиентский модуль жанров — зеркало ALL_GENRES из @vire/core
// (core нельзя тянуть в клиентский бандл целиком).

export type Genre =
  | 'ELECTRONIC' | 'HIPHOP' | 'ROCK' | 'INDIE' | 'POP' | 'AMBIENT' | 'JAZZ'
  | 'CLASSICAL' | 'METAL' | 'FOLK' | 'RNB' | 'TECHNO' | 'EXPERIMENTAL' | 'LOFI';

export const ALL_GENRES: Genre[] = [
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
];

export const GENRE_LABELS: Record<Genre, string> = {
  ELECTRONIC: 'Электроника',
  HIPHOP: 'Хип-хоп',
  ROCK: 'Рок',
  INDIE: 'Инди',
  POP: 'Поп',
  AMBIENT: 'Эмбиент',
  JAZZ: 'Джаз',
  CLASSICAL: 'Классика',
  METAL: 'Метал',
  FOLK: 'Фолк',
  RNB: 'R&B',
  TECHNO: 'Техно',
  EXPERIMENTAL: 'Экспериментальное',
  LOFI: 'Lo-fi',
};
