import type { TrackGenre } from '@vire/db';
import { DISCOGS_400_LABELS } from './discogs-genre-labels.js';

export interface GenreSuggestion {
  genre: TrackGenre;
  confidence: number;
}

// Немузыкальные метки: осознанно не мапятся ни во что (озвучка, детский контент,
// пародии). Инвариант: каждая из 400 меток модели либо здесь, либо в DISCOGS_TO_GENRE.
export const DROPPED_LABELS: ReadonlySet<string> = new Set([
  'Non-Music---Audiobook',
  'Non-Music---Comedy',
  'Non-Music---Dialogue',
  'Non-Music---Education',
  'Non-Music---Interview',
  'Non-Music---Monolog',
  'Non-Music---Political',
  'Non-Music---Promotional',
  'Non-Music---Radioplay',
  'Non-Music---Religious',
  "Children's---Educational",
  "Children's---Nursery Rhymes",
  "Children's---Story",
  'Pop---Parody',
  'Rock---Parody',
]);

// Маппинг genre_discogs400 (таксономия Discogs "Parent---Subgenre") в наш genreEnum,
// покрытие ~1:1 (детали и обоснование сводов: docs/features/auto-genre.md). Единичные
// своды «размытый стиль в зонтик» помечены комментарием у строки.
export const DISCOGS_TO_GENRE: Readonly<Record<string, TrackGenre>> = {
  // Blues
  'Blues---Boogie Woogie': 'BOOGIE_WOOGIE',
  'Blues---Chicago Blues': 'CHICAGO_BLUES',
  'Blues---Country Blues': 'COUNTRY_BLUES',
  'Blues---Delta Blues': 'DELTA_BLUES',
  'Blues---Electric Blues': 'ELECTRIC_BLUES',
  'Blues---Harmonica Blues': 'HARMONICA_BLUES',
  'Blues---Jump Blues': 'JUMP_BLUES',
  'Blues---Louisiana Blues': 'LOUISIANA_BLUES',
  'Blues---Modern Electric Blues': 'MODERN_ELECTRIC_BLUES',
  'Blues---Piano Blues': 'PIANO_BLUES',
  'Blues---Rhythm & Blues': 'RNB',
  'Blues---Texas Blues': 'TEXAS_BLUES',

  // Brass & Military: духовые оркестры и марши, один жанр
  'Brass & Military---Brass Band': 'BRASS',
  'Brass & Military---Marches': 'BRASS',
  'Brass & Military---Military': 'BRASS',

  // Classical
  'Classical---Baroque': 'BAROQUE',
  'Classical---Choral': 'CHORAL',
  'Classical---Classical': 'CLASSICAL',
  'Classical---Contemporary': 'CONTEMPORARY_CLASSICAL',
  'Classical---Impressionist': 'IMPRESSIONIST',
  'Classical---Medieval': 'MEDIEVAL',
  'Classical---Modern': 'MODERN_CLASSICAL',
  'Classical---Neo-Classical': 'NEOCLASSICAL',
  'Classical---Neo-Romantic': 'NEO_ROMANTIC',
  'Classical---Opera': 'OPERA',
  'Classical---Post-Modern': 'POST_MODERN_CLASSICAL',
  'Classical---Renaissance': 'RENAISSANCE',
  'Classical---Romantic': 'ROMANTICISM',

  // Electronic
  'Electronic---Abstract': 'EXPERIMENTAL', // свод: слишком размытый стиль для пикера
  'Electronic---Acid': 'ACID',
  'Electronic---Acid House': 'ACID_HOUSE',
  'Electronic---Acid Jazz': 'ACID_JAZZ',
  'Electronic---Ambient': 'AMBIENT',
  'Electronic---Bassline': 'BASSLINE',
  'Electronic---Beatdown': 'BEATDOWN',
  'Electronic---Berlin-School': 'BERLIN_SCHOOL',
  'Electronic---Big Beat': 'BIG_BEAT',
  'Electronic---Bleep': 'BLEEP',
  'Electronic---Breakbeat': 'BREAKBEAT',
  'Electronic---Breakcore': 'BREAKCORE',
  'Electronic---Breaks': 'BREAKBEAT', // синоним breakbeat в таксономии Discogs
  'Electronic---Broken Beat': 'BROKEN_BEAT',
  'Electronic---Chillwave': 'CHILLWAVE',
  'Electronic---Chiptune': 'CHIPTUNE',
  'Electronic---Dance-pop': 'DANCE_POP',
  'Electronic---Dark Ambient': 'DARK_AMBIENT',
  'Electronic---Darkwave': 'DARKWAVE',
  'Electronic---Deep House': 'DEEP_HOUSE',
  'Electronic---Deep Techno': 'DEEP_TECHNO',
  'Electronic---Disco': 'DISCO',
  'Electronic---Disco Polo': 'DISCO_POLO',
  'Electronic---Donk': 'DONK',
  'Electronic---Downtempo': 'DOWNTEMPO',
  'Electronic---Drone': 'DRONE',
  'Electronic---Drum n Bass': 'DNB',
  'Electronic---Dub': 'DUB',
  'Electronic---Dub Techno': 'DUB_TECHNO',
  'Electronic---Dubstep': 'DUBSTEP',
  'Electronic---Dungeon Synth': 'DUNGEON_SYNTH',
  'Electronic---EBM': 'EBM',
  'Electronic---Electro': 'ELECTRO',
  'Electronic---Electro House': 'ELECTRO_HOUSE',
  'Electronic---Electroclash': 'ELECTROCLASH',
  'Electronic---Euro House': 'EURO_HOUSE',
  'Electronic---Euro-Disco': 'EURO_DISCO',
  'Electronic---Eurobeat': 'EUROBEAT',
  'Electronic---Eurodance': 'EURODANCE',
  'Electronic---Experimental': 'EXPERIMENTAL',
  'Electronic---Freestyle': 'FREESTYLE',
  'Electronic---Future Jazz': 'FUTURE_JAZZ',
  'Electronic---Gabber': 'GABBER',
  'Electronic---Garage House': 'GARAGE_HOUSE',
  'Electronic---Ghetto': 'GHETTO',
  'Electronic---Ghetto House': 'GHETTO_HOUSE',
  'Electronic---Glitch': 'GLITCH',
  'Electronic---Goa Trance': 'GOA_TRANCE',
  'Electronic---Grime': 'GRIME',
  'Electronic---Halftime': 'HALFTIME',
  'Electronic---Hands Up': 'HANDS_UP',
  'Electronic---Happy Hardcore': 'HAPPY_HARDCORE',
  'Electronic---Hard House': 'HARD_HOUSE',
  'Electronic---Hard Techno': 'HARD_TECHNO',
  'Electronic---Hard Trance': 'HARD_TRANCE',
  'Electronic---Hardcore': 'HARDCORE_EDM',
  'Electronic---Hardstyle': 'HARDSTYLE',
  'Electronic---Hi NRG': 'HI_NRG',
  'Electronic---Hip Hop': 'HIPHOP',
  'Electronic---Hip-House': 'HIP_HOUSE',
  'Electronic---House': 'HOUSE',
  'Electronic---IDM': 'IDM',
  'Electronic---Illbient': 'ILLBIENT',
  'Electronic---Industrial': 'INDUSTRIAL',
  'Electronic---Italo House': 'ITALO_HOUSE',
  'Electronic---Italo-Disco': 'ITALO_DISCO',
  'Electronic---Italodance': 'ITALODANCE',
  'Electronic---Jazzdance': 'JAZZDANCE',
  'Electronic---Juke': 'JUKE',
  'Electronic---Jumpstyle': 'JUMPSTYLE',
  'Electronic---Jungle': 'JUNGLE',
  'Electronic---Latin': 'LATIN',
  'Electronic---Leftfield': 'LEFTFIELD',
  'Electronic---Makina': 'MAKINA',
  'Electronic---Minimal': 'MINIMAL',
  'Electronic---Minimal Techno': 'MINIMAL_TECHNO',
  'Electronic---Modern Classical': 'MODERN_CLASSICAL',
  'Electronic---Musique Concrète': 'MUSIQUE_CONCRETE',
  'Electronic---Neofolk': 'NEOFOLK',
  'Electronic---New Age': 'NEW_AGE',
  'Electronic---New Beat': 'NEW_BEAT',
  'Electronic---New Wave': 'NEW_WAVE',
  'Electronic---Noise': 'NOISE',
  'Electronic---Nu-Disco': 'NU_DISCO',
  'Electronic---Power Electronics': 'POWER_ELECTRONICS',
  'Electronic---Progressive Breaks': 'PROGRESSIVE_BREAKS',
  'Electronic---Progressive House': 'PROGRESSIVE_HOUSE',
  'Electronic---Progressive Trance': 'PROGRESSIVE_TRANCE',
  'Electronic---Psy-Trance': 'PSY_TRANCE',
  'Electronic---Rhythmic Noise': 'RHYTHMIC_NOISE',
  'Electronic---Schranz': 'SCHRANZ',
  'Electronic---Sound Collage': 'SOUND_COLLAGE',
  'Electronic---Speed Garage': 'SPEED_GARAGE',
  'Electronic---Speedcore': 'SPEEDCORE',
  'Electronic---Synth-pop': 'SYNTHPOP',
  'Electronic---Synthwave': 'SYNTHWAVE',
  'Electronic---Tech House': 'TECH_HOUSE',
  'Electronic---Tech Trance': 'TECH_TRANCE',
  'Electronic---Techno': 'TECHNO',
  'Electronic---Trance': 'TRANCE',
  'Electronic---Tribal': 'TRIBAL',
  'Electronic---Tribal House': 'TRIBAL_HOUSE',
  'Electronic---Trip Hop': 'TRIP_HOP',
  'Electronic---Tropical House': 'TROPICAL_HOUSE',
  'Electronic---UK Garage': 'GARAGE',
  'Electronic---Vaporwave': 'VAPORWAVE',

  // Folk, World, & Country
  'Folk, World, & Country---African': 'AFRICAN',
  'Folk, World, & Country---Bluegrass': 'BLUEGRASS',
  'Folk, World, & Country---Cajun': 'CAJUN',
  'Folk, World, & Country---Canzone Napoletana': 'CANZONE_NAPOLETANA',
  'Folk, World, & Country---Catalan Music': 'CATALAN_MUSIC',
  'Folk, World, & Country---Celtic': 'CELTIC',
  'Folk, World, & Country---Country': 'COUNTRY',
  'Folk, World, & Country---Fado': 'FADO',
  'Folk, World, & Country---Flamenco': 'FLAMENCO',
  'Folk, World, & Country---Folk': 'FOLK',
  'Folk, World, & Country---Gospel': 'GOSPEL',
  'Folk, World, & Country---Highlife': 'HIGHLIFE',
  'Folk, World, & Country---Hillbilly': 'HILLBILLY',
  'Folk, World, & Country---Hindustani': 'HINDUSTANI',
  'Folk, World, & Country---Honky Tonk': 'HONKY_TONK',
  'Folk, World, & Country---Indian Classical': 'INDIAN_CLASSICAL',
  'Folk, World, & Country---Laïkó': 'LAIKO',
  'Folk, World, & Country---Nordic': 'NORDIC',
  'Folk, World, & Country---Pacific': 'PACIFIC',
  'Folk, World, & Country---Polka': 'POLKA',
  'Folk, World, & Country---Raï': 'RAI',
  'Folk, World, & Country---Romani': 'ROMANI',
  'Folk, World, & Country---Soukous': 'SOUKOUS',
  'Folk, World, & Country---Séga': 'SEGA',
  'Folk, World, & Country---Volksmusik': 'VOLKSMUSIK',
  'Folk, World, & Country---Zouk': 'ZOUK',
  'Folk, World, & Country---Éntekhno': 'ENTEKHNO',

  // Funk / Soul
  'Funk / Soul---Afrobeat': 'AFROBEAT',
  'Funk / Soul---Boogie': 'BOOGIE',
  'Funk / Soul---Contemporary R&B': 'RNB',
  'Funk / Soul---Disco': 'DISCO',
  'Funk / Soul---Free Funk': 'FREE_FUNK',
  'Funk / Soul---Funk': 'FUNK',
  'Funk / Soul---Gospel': 'GOSPEL',
  'Funk / Soul---Neo Soul': 'NEOSOUL',
  'Funk / Soul---New Jack Swing': 'NEW_JACK_SWING',
  'Funk / Soul---P.Funk': 'P_FUNK',
  'Funk / Soul---Psychedelic': 'PSYCHEDELIC_SOUL',
  'Funk / Soul---Rhythm & Blues': 'RNB',
  'Funk / Soul---Soul': 'SOUL',
  'Funk / Soul---Swingbeat': 'NEW_JACK_SWING', // синоним new jack swing (UK-термин)
  'Funk / Soul---UK Street Soul': 'UK_STREET_SOUL',

  // Hip Hop
  'Hip Hop---Bass Music': 'BASS_MUSIC',
  'Hip Hop---Boom Bap': 'BOOMBAP',
  'Hip Hop---Bounce': 'BOUNCE',
  'Hip Hop---Britcore': 'BRITCORE',
  'Hip Hop---Cloud Rap': 'CLOUDRAP',
  'Hip Hop---Conscious': 'CONSCIOUS',
  'Hip Hop---Crunk': 'CRUNK',
  'Hip Hop---Cut-up/DJ': 'CUT_UP_DJ',
  'Hip Hop---DJ Battle Tool': 'TURNTABLISM', // свод: скретч-болванки, материал тёрнтейблизма
  'Hip Hop---Electro': 'ELECTRO',
  'Hip Hop---G-Funk': 'G_FUNK',
  'Hip Hop---Gangsta': 'GANGSTA',
  'Hip Hop---Grime': 'GRIME',
  'Hip Hop---Hardcore Hip-Hop': 'HARDCORE_HIPHOP',
  'Hip Hop---Horrorcore': 'HORRORCORE',
  'Hip Hop---Instrumental': 'INSTRUMENTAL_HIPHOP',
  'Hip Hop---Jazzy Hip-Hop': 'JAZZY_HIPHOP',
  'Hip Hop---Miami Bass': 'MIAMI_BASS',
  'Hip Hop---Pop Rap': 'POP_RAP',
  'Hip Hop---Ragga HipHop': 'RAGGA_HIPHOP',
  'Hip Hop---RnB/Swing': 'RNB',
  'Hip Hop---Screw': 'SCREW',
  'Hip Hop---Thug Rap': 'GANGSTA', // свод: thug rap ≈ gangsta, отдельный жанр бессмыслен
  'Hip Hop---Trap': 'TRAP',
  'Hip Hop---Trip Hop': 'TRIP_HOP',
  'Hip Hop---Turntablism': 'TURNTABLISM',

  // Jazz
  'Jazz---Afro-Cuban Jazz': 'AFRO_CUBAN_JAZZ',
  'Jazz---Afrobeat': 'AFROBEAT',
  'Jazz---Avant-garde Jazz': 'AVANTGARDE_JAZZ',
  'Jazz---Big Band': 'BIG_BAND',
  'Jazz---Bop': 'BEBOP',
  'Jazz---Bossa Nova': 'BOSSA_NOVA',
  'Jazz---Contemporary Jazz': 'CONTEMPORARY_JAZZ',
  'Jazz---Cool Jazz': 'COOL_JAZZ',
  'Jazz---Dixieland': 'DIXIELAND',
  'Jazz---Easy Listening': 'EASY_LISTENING',
  'Jazz---Free Improvisation': 'FREE_IMPROVISATION',
  'Jazz---Free Jazz': 'FREE_JAZZ',
  'Jazz---Fusion': 'FUSION',
  'Jazz---Gypsy Jazz': 'GYPSY_JAZZ',
  'Jazz---Hard Bop': 'HARD_BOP',
  'Jazz---Jazz-Funk': 'JAZZ_FUNK',
  'Jazz---Jazz-Rock': 'JAZZ_ROCK',
  'Jazz---Latin Jazz': 'LATIN_JAZZ',
  'Jazz---Modal': 'MODAL_JAZZ',
  'Jazz---Post Bop': 'POST_BOP',
  'Jazz---Ragtime': 'RAGTIME',
  'Jazz---Smooth Jazz': 'SMOOTH_JAZZ',
  'Jazz---Soul-Jazz': 'SOUL_JAZZ',
  'Jazz---Space-Age': 'SPACE_AGE',
  'Jazz---Swing': 'SWING',

  // Latin
  'Latin---Afro-Cuban': 'AFRO_CUBAN',
  'Latin---Baião': 'BAIAO',
  'Latin---Batucada': 'BATUCADA',
  'Latin---Beguine': 'BEGUINE',
  'Latin---Bolero': 'BOLERO',
  'Latin---Boogaloo': 'BOOGALOO',
  'Latin---Bossanova': 'BOSSA_NOVA',
  'Latin---Cha-Cha': 'CHA_CHA',
  'Latin---Charanga': 'CHARANGA',
  'Latin---Compas': 'COMPAS',
  'Latin---Cubano': 'CUBANO',
  'Latin---Cumbia': 'CUMBIA',
  'Latin---Descarga': 'DESCARGA',
  'Latin---Forró': 'FORRO',
  'Latin---Guaguancó': 'GUAGUANCO',
  'Latin---Guajira': 'GUAJIRA',
  'Latin---Guaracha': 'GUARACHA',
  'Latin---MPB': 'MPB',
  'Latin---Mambo': 'MAMBO',
  'Latin---Mariachi': 'MARIACHI',
  'Latin---Merengue': 'MERENGUE',
  'Latin---Norteño': 'NORTENO',
  'Latin---Nueva Cancion': 'NUEVA_CANCION',
  'Latin---Pachanga': 'PACHANGA',
  'Latin---Porro': 'PORRO',
  'Latin---Ranchera': 'RANCHERA',
  'Latin---Reggaeton': 'REGGAETON',
  'Latin---Rumba': 'RUMBA',
  'Latin---Salsa': 'SALSA',
  'Latin---Samba': 'SAMBA',
  'Latin---Son': 'SON',
  'Latin---Son Montuno': 'SON_MONTUNO',
  'Latin---Tango': 'TANGO',
  'Latin---Tejano': 'TEJANO',
  'Latin---Vallenato': 'VALLENATO',

  // Non-Music: музыкально осмысленное, остальное в DROPPED_LABELS
  'Non-Music---Field Recording': 'FIELD_RECORDING',
  'Non-Music---Poetry': 'SPOKENWORD',
  'Non-Music---Spoken Word': 'SPOKENWORD',

  // Pop
  'Pop---Ballad': 'BALLAD',
  'Pop---Bollywood': 'BOLLYWOOD',
  'Pop---Bubblegum': 'BUBBLEGUM',
  'Pop---Chanson': 'CHANSON',
  'Pop---City Pop': 'CITY_POP',
  'Pop---Europop': 'EUROPOP',
  'Pop---Indie Pop': 'INDIEPOP',
  'Pop---J-pop': 'J_POP',
  'Pop---K-pop': 'K_POP',
  'Pop---Kayōkyoku': 'KAYOKYOKU',
  'Pop---Light Music': 'LIGHT_MUSIC',
  'Pop---Music Hall': 'MUSIC_HALL',
  'Pop---Novelty': 'NOVELTY',
  'Pop---Schlager': 'SCHLAGER',
  'Pop---Vocal': 'VOCAL',

  // Reggae
  'Reggae---Calypso': 'CALYPSO',
  'Reggae---Dancehall': 'DANCEHALL',
  'Reggae---Dub': 'DUB',
  'Reggae---Lovers Rock': 'LOVERS_ROCK',
  'Reggae---Ragga': 'RAGGA',
  'Reggae---Reggae': 'REGGAE',
  'Reggae---Reggae-Pop': 'REGGAE_POP',
  'Reggae---Rocksteady': 'ROCKSTEADY',
  'Reggae---Roots Reggae': 'ROOTS_REGGAE',
  'Reggae---Ska': 'SKA',
  'Reggae---Soca': 'SOCA',

  // Rock
  'Rock---AOR': 'AOR',
  'Rock---Acid Rock': 'ACID_ROCK',
  'Rock---Acoustic': 'ACOUSTIC',
  'Rock---Alternative Rock': 'ALTERNATIVE',
  'Rock---Arena Rock': 'ARENA_ROCK',
  'Rock---Art Rock': 'ART_ROCK',
  'Rock---Atmospheric Black Metal': 'ATMOSPHERIC_BLACK_METAL',
  'Rock---Avantgarde': 'EXPERIMENTAL', // свод: слишком размытый стиль для пикера
  'Rock---Beat': 'BEAT',
  'Rock---Black Metal': 'BLACKMETAL',
  'Rock---Blues Rock': 'BLUES_ROCK',
  'Rock---Brit Pop': 'BRITPOP',
  'Rock---Classic Rock': 'CLASSIC_ROCK',
  'Rock---Coldwave': 'COLDWAVE',
  'Rock---Country Rock': 'COUNTRY_ROCK',
  'Rock---Crust': 'CRUST',
  'Rock---Death Metal': 'DEATHMETAL',
  'Rock---Deathcore': 'DEATHCORE',
  'Rock---Deathrock': 'DEATHROCK',
  'Rock---Depressive Black Metal': 'DEPRESSIVE_BLACK_METAL',
  'Rock---Doo Wop': 'DOO_WOP',
  'Rock---Doom Metal': 'DOOM',
  'Rock---Dream Pop': 'DREAMPOP',
  'Rock---Emo': 'EMO',
  'Rock---Ethereal': 'ETHEREAL',
  'Rock---Experimental': 'EXPERIMENTAL',
  'Rock---Folk Metal': 'FOLK_METAL',
  'Rock---Folk Rock': 'FOLK_ROCK',
  'Rock---Funeral Doom Metal': 'FUNERAL_DOOM',
  'Rock---Funk Metal': 'FUNK_METAL',
  'Rock---Garage Rock': 'GARAGE_ROCK',
  'Rock---Glam': 'GLAM',
  'Rock---Goregrind': 'GRINDCORE', // гор/порно-нейминг не тащим в пикер, общий GRINDCORE
  'Rock---Goth Rock': 'GOTH_ROCK',
  'Rock---Gothic Metal': 'GOTHIC_METAL',
  'Rock---Grindcore': 'GRINDCORE',
  'Rock---Grunge': 'GRUNGE',
  'Rock---Hard Rock': 'HARD_ROCK',
  'Rock---Hardcore': 'HARDCORE_PUNK',
  'Rock---Heavy Metal': 'HEAVYMETAL',
  'Rock---Indie Rock': 'INDIE',
  'Rock---Industrial': 'INDUSTRIAL',
  'Rock---Krautrock': 'KRAUTROCK',
  'Rock---Lo-Fi': 'LOFI',
  'Rock---Lounge': 'LOUNGE',
  'Rock---Math Rock': 'MATH_ROCK',
  'Rock---Melodic Death Metal': 'MELODIC_DEATH_METAL',
  'Rock---Melodic Hardcore': 'MELODIC_HARDCORE',
  'Rock---Metalcore': 'METALCORE',
  'Rock---Mod': 'MOD',
  'Rock---Neofolk': 'NEOFOLK',
  'Rock---New Wave': 'NEW_WAVE',
  'Rock---No Wave': 'NO_WAVE',
  'Rock---Noise': 'NOISE',
  'Rock---Noisecore': 'NOISECORE',
  'Rock---Nu Metal': 'NU_METAL',
  'Rock---Oi': 'OI',
  'Rock---Pop Punk': 'POP_PUNK',
  'Rock---Pop Rock': 'POP_ROCK',
  'Rock---Pornogrind': 'GRINDCORE', // см. Goregrind
  'Rock---Post Rock': 'POST_ROCK',
  'Rock---Post-Hardcore': 'POST_HARDCORE',
  'Rock---Post-Metal': 'POSTMETAL',
  'Rock---Post-Punk': 'POSTPUNK',
  'Rock---Power Metal': 'POWER_METAL',
  'Rock---Power Pop': 'POWER_POP',
  'Rock---Power Violence': 'POWER_VIOLENCE',
  'Rock---Prog Rock': 'PROGROCK',
  'Rock---Progressive Metal': 'PROGRESSIVE_METAL',
  'Rock---Psychedelic Rock': 'PSYCHEDELIC',
  'Rock---Psychobilly': 'PSYCHOBILLY',
  'Rock---Pub Rock': 'PUB_ROCK',
  'Rock---Punk': 'PUNK',
  'Rock---Rock & Roll': 'ROCK_N_ROLL',
  'Rock---Rockabilly': 'ROCKABILLY',
  'Rock---Shoegaze': 'SHOEGAZE',
  'Rock---Ska': 'SKA',
  'Rock---Sludge Metal': 'SLUDGE_METAL',
  'Rock---Soft Rock': 'SOFT_ROCK',
  'Rock---Southern Rock': 'SOUTHERN_ROCK',
  'Rock---Space Rock': 'SPACE_ROCK',
  'Rock---Speed Metal': 'SPEED_METAL',
  'Rock---Stoner Rock': 'STONER_ROCK',
  'Rock---Surf': 'SURF',
  'Rock---Symphonic Rock': 'SYMPHONIC_ROCK',
  'Rock---Technical Death Metal': 'TECHNICAL_DEATH_METAL',
  'Rock---Thrash': 'THRASH',
  'Rock---Twist': 'TWIST',
  'Rock---Viking Metal': 'VIKING_METAL',
  'Rock---Yé-Yé': 'YEYE',

  // Stage & Screen
  'Stage & Screen---Musical': 'MUSICAL',
  'Stage & Screen---Score': 'CINEMATIC',
  'Stage & Screen---Soundtrack': 'SOUNDTRACK',
  'Stage & Screen---Theme': 'SOUNDTRACK', // свод: ТВ-заставки отдельным жанром бессмысленны
};

// Страховка инварианта на module load: каждая метка модели ровно в одном из
// {DISCOGS_TO_GENRE, DROPPED_LABELS}, опечаток в ключах нет.
const KNOWN_LABELS = new Set(DISCOGS_400_LABELS);
for (const label of Object.keys(DISCOGS_TO_GENRE)) {
  if (!KNOWN_LABELS.has(label)) {
    throw new Error(`DISCOGS_TO_GENRE: неизвестная метка "${label}" — нет в DISCOGS_400_LABELS`);
  }
  if (DROPPED_LABELS.has(label)) {
    throw new Error(`Метка "${label}" одновременно в DISCOGS_TO_GENRE и DROPPED_LABELS`);
  }
}
for (const label of DISCOGS_400_LABELS) {
  if (!(label in DISCOGS_TO_GENRE) && !DROPPED_LABELS.has(label)) {
    throw new Error(`Метка "${label}" не покрыта ни DISCOGS_TO_GENRE, ни DROPPED_LABELS`);
  }
}

// Жанры с 2+ метками (GRINDCORE, BRASS, RNB…) при чистой сумме вероятностей
// перевешивали бы один уверенный лейбл диффузной массой. Смешиваем max с
// остатком суммы, взятым с весом ниже единицы, чтобы число меток не решало исход.
const SUM_TAIL_WEIGHT = 0.3;

/**
 * Топ-5 наших жанров из 400 сырых предсказаний. Score = max метки жанра +
 * SUM_TAIL_WEIGHT × остаток суммы; confidence нормализован по сумме score
 * замэпленных жанров (не всех 400 меток). Жанры без аналога в Discogs-400
 * (PHONK, DRILL, HYPERPOP, ORCHESTRAL, PIANO, SINGER_SONGWRITER) сюда не попадают,
 * см. docs/features/auto-genre.md.
 */
export function mapDiscogsPredictionsToGenres(
  probabilities: ArrayLike<number>,
): GenreSuggestion[] {
  const sums = new Map<TrackGenre, number>();
  const maxes = new Map<TrackGenre, number>();

  for (let i = 0; i < DISCOGS_400_LABELS.length && i < probabilities.length; i++) {
    const genre = DISCOGS_TO_GENRE[DISCOGS_400_LABELS[i]];
    if (!genre) continue;
    const p = probabilities[i];
    if (p <= 0) continue;
    sums.set(genre, (sums.get(genre) ?? 0) + p);
    if (p > (maxes.get(genre) ?? 0)) maxes.set(genre, p);
  }

  const scores = new Map<TrackGenre, number>();
  let totalScore = 0;
  for (const [genre, sum] of sums) {
    const max = maxes.get(genre) ?? 0;
    const score = max + SUM_TAIL_WEIGHT * (sum - max);
    scores.set(genre, score);
    totalScore += score;
  }

  if (totalScore <= 0) return [];

  return Array.from(scores.entries())
    .map(([genre, score]) => ({ genre, confidence: score / totalScore }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}
