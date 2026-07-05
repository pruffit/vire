// Клиентский модуль жанров — зеркало ALL_GENRES из @vire/core / genreEnum в @vire/db
// (core/db нельзя тянуть в клиентский бандл целиком). Здесь же — группировка и подписи
// для UI: список большой, поэтому пикеры показывают его по категориям + поиск.

export type Genre =
  // Электроника
  | 'ELECTRONIC' | 'HOUSE' | 'TECHNO' | 'TRANCE' | 'DNB' | 'DUBSTEP' | 'GARAGE'
  | 'BREAKBEAT' | 'IDM' | 'SYNTHWAVE' | 'DOWNTEMPO' | 'HARDSTYLE' | 'AMBIENT' | 'LOFI'
  // Хип-хоп и R&B
  | 'HIPHOP' | 'BOOMBAP' | 'TRAP' | 'DRILL' | 'CLOUDRAP' | 'PHONK' | 'RNB' | 'NEOSOUL' | 'SOUL' | 'FUNK'
  // Рок
  | 'ROCK' | 'INDIE' | 'ALTERNATIVE' | 'PUNK' | 'POSTPUNK' | 'PSYCHEDELIC' | 'SHOEGAZE' | 'GRUNGE' | 'PROGROCK'
  // Метал
  | 'METAL' | 'HEAVYMETAL' | 'DEATHMETAL' | 'BLACKMETAL' | 'DOOM' | 'METALCORE' | 'POSTMETAL'
  // Поп
  | 'POP' | 'INDIEPOP' | 'SYNTHPOP' | 'HYPERPOP' | 'DREAMPOP'
  // Джаз и блюз
  | 'JAZZ' | 'BLUES' | 'BEBOP' | 'FUSION' | 'SWING'
  // Классика и оркестр
  | 'CLASSICAL' | 'ORCHESTRAL' | 'CINEMATIC' | 'NEOCLASSICAL' | 'OPERA' | 'PIANO'
  // Фолк и этника
  | 'FOLK' | 'ACOUSTIC' | 'SINGER_SONGWRITER' | 'COUNTRY' | 'WORLD'
  // Эксперимент и прочее
  | 'EXPERIMENTAL' | 'NOISE' | 'DRONE' | 'INDUSTRIAL' | 'REGGAE' | 'DUB' | 'SOUNDTRACK' | 'SPOKENWORD';

export interface GenreGroup {
  label: string;
  genres: Genre[];
}

// Общий лимит жанров на трек — используется пикером артиста и формой админки.
export const MAX_TRACK_GENRES = 3;

// Группировка для UI. Порядок здесь же определяет порядок в пикерах и <optgroup>.
export const GENRE_GROUPS: GenreGroup[] = [
  {
    label: 'Электроника',
    genres: ['ELECTRONIC', 'HOUSE', 'TECHNO', 'TRANCE', 'DNB', 'DUBSTEP', 'GARAGE', 'BREAKBEAT', 'IDM', 'SYNTHWAVE', 'DOWNTEMPO', 'HARDSTYLE', 'AMBIENT', 'LOFI'],
  },
  {
    label: 'Хип-хоп и R&B',
    genres: ['HIPHOP', 'BOOMBAP', 'TRAP', 'DRILL', 'CLOUDRAP', 'PHONK', 'RNB', 'NEOSOUL', 'SOUL', 'FUNK'],
  },
  {
    label: 'Рок',
    genres: ['ROCK', 'INDIE', 'ALTERNATIVE', 'PUNK', 'POSTPUNK', 'PSYCHEDELIC', 'SHOEGAZE', 'GRUNGE', 'PROGROCK'],
  },
  {
    label: 'Метал',
    genres: ['METAL', 'HEAVYMETAL', 'DEATHMETAL', 'BLACKMETAL', 'DOOM', 'METALCORE', 'POSTMETAL'],
  },
  {
    label: 'Поп',
    genres: ['POP', 'INDIEPOP', 'SYNTHPOP', 'HYPERPOP', 'DREAMPOP'],
  },
  {
    label: 'Джаз и блюз',
    genres: ['JAZZ', 'BLUES', 'BEBOP', 'FUSION', 'SWING'],
  },
  {
    label: 'Классика и оркестр',
    genres: ['CLASSICAL', 'ORCHESTRAL', 'CINEMATIC', 'NEOCLASSICAL', 'OPERA', 'PIANO'],
  },
  {
    label: 'Фолк и этника',
    genres: ['FOLK', 'ACOUSTIC', 'SINGER_SONGWRITER', 'COUNTRY', 'WORLD'],
  },
  {
    label: 'Эксперимент и прочее',
    genres: ['EXPERIMENTAL', 'NOISE', 'DRONE', 'INDUSTRIAL', 'REGGAE', 'DUB', 'SOUNDTRACK', 'SPOKENWORD'],
  },
];

export const ALL_GENRES: Genre[] = GENRE_GROUPS.flatMap((g) => g.genres);

export const GENRE_LABELS: Record<Genre, string> = {
  // Электроника
  ELECTRONIC: 'Электроника',
  HOUSE: 'House',
  TECHNO: 'Техно',
  TRANCE: 'Транс',
  DNB: 'Drum & Bass',
  DUBSTEP: 'Dubstep',
  GARAGE: 'UK Garage',
  BREAKBEAT: 'Breakbeat',
  IDM: 'IDM',
  SYNTHWAVE: 'Synthwave',
  DOWNTEMPO: 'Downtempo',
  HARDSTYLE: 'Hardstyle',
  AMBIENT: 'Эмбиент',
  LOFI: 'Lo-fi',
  // Хип-хоп и R&B
  HIPHOP: 'Хип-хоп',
  BOOMBAP: 'Boom Bap',
  TRAP: 'Трэп',
  DRILL: 'Дрилл',
  CLOUDRAP: 'Cloud Rap',
  PHONK: 'Фонк',
  RNB: 'R&B',
  NEOSOUL: 'Neo-Soul',
  SOUL: 'Соул',
  FUNK: 'Фанк',
  // Рок
  ROCK: 'Рок',
  INDIE: 'Инди',
  ALTERNATIVE: 'Альтернатива',
  PUNK: 'Панк',
  POSTPUNK: 'Пост-панк',
  PSYCHEDELIC: 'Психоделика',
  SHOEGAZE: 'Shoegaze',
  GRUNGE: 'Грандж',
  PROGROCK: 'Прог-рок',
  // Метал
  METAL: 'Метал',
  HEAVYMETAL: 'Хэви-метал',
  DEATHMETAL: 'Дэт-метал',
  BLACKMETAL: 'Блэк-метал',
  DOOM: 'Дум',
  METALCORE: 'Металкор',
  POSTMETAL: 'Пост-метал',
  // Поп
  POP: 'Поп',
  INDIEPOP: 'Инди-поп',
  SYNTHPOP: 'Синти-поп',
  HYPERPOP: 'Гиперпоп',
  DREAMPOP: 'Dream Pop',
  // Джаз и блюз
  JAZZ: 'Джаз',
  BLUES: 'Блюз',
  BEBOP: 'Бибоп',
  FUSION: 'Фьюжн',
  SWING: 'Свинг',
  // Классика и оркестр
  CLASSICAL: 'Классика',
  ORCHESTRAL: 'Оркестровое',
  CINEMATIC: 'Кинематографик',
  NEOCLASSICAL: 'Неоклассика',
  OPERA: 'Опера',
  PIANO: 'Фортепиано',
  // Фолк и этника
  FOLK: 'Фолк',
  ACOUSTIC: 'Акустика',
  SINGER_SONGWRITER: 'Автор-исполнитель',
  COUNTRY: 'Кантри',
  WORLD: 'Этника',
  // Эксперимент и прочее
  EXPERIMENTAL: 'Экспериментальное',
  NOISE: 'Нойз',
  DRONE: 'Дроун',
  INDUSTRIAL: 'Индастриал',
  REGGAE: 'Регги',
  DUB: 'Даб',
  SOUNDTRACK: 'Саундтрек',
  SPOKENWORD: 'Spoken Word',
};
