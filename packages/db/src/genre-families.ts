import { genreEnum } from './schema/releases';

// Тип дублируется из queries/track-genres: модуль не должен тянуть client.ts,
// его импортирует и код без доступа к БД (тесты, edge).
type TrackGenre = (typeof genreEnum.enumValues)[number];

export type GenreFamily =
  | 'house'
  | 'techno'
  | 'trance'
  | 'hard-dance'
  | 'bass'
  | 'breakbeat'
  | 'ambient'
  | 'downtempo'
  | 'synth-retro'
  | 'disco-funk'
  | 'electronic'
  | 'hiphop'
  | 'rnb-soul'
  | 'rock'
  | 'indie'
  | 'punk'
  | 'metal'
  | 'pop'
  | 'jazz'
  | 'blues'
  | 'classical'
  | 'folk'
  | 'country'
  | 'world'
  | 'latin'
  | 'reggae'
  | 'soundtrack'
  | 'experimental'
  | 'spoken';

export const GENRE_FAMILY: Record<TrackGenre, GenreFamily> = {
  // house
  HOUSE: 'house', ACID: 'house', ACID_HOUSE: 'house', BEATDOWN: 'house',
  DEEP_HOUSE: 'house', ELECTRO_HOUSE: 'house', EURO_HOUSE: 'house',
  GARAGE_HOUSE: 'house', GHETTO: 'house', GHETTO_HOUSE: 'house', HARD_HOUSE: 'house',
  HIP_HOUSE: 'house', ITALO_HOUSE: 'house', PROGRESSIVE_HOUSE: 'house',
  TECH_HOUSE: 'house', TRIBAL_HOUSE: 'house', TROPICAL_HOUSE: 'house',
  // techno
  TECHNO: 'techno', BLEEP: 'techno', DEEP_TECHNO: 'techno', DUB_TECHNO: 'techno',
  HARD_TECHNO: 'techno', MINIMAL: 'techno', MINIMAL_TECHNO: 'techno', SCHRANZ: 'techno',
  // trance
  TRANCE: 'trance', GOA_TRANCE: 'trance', HARD_TRANCE: 'trance',
  PROGRESSIVE_TRANCE: 'trance', PSY_TRANCE: 'trance', TECH_TRANCE: 'trance',
  // hard-dance
  HARDSTYLE: 'hard-dance', HARDCORE_EDM: 'hard-dance', GABBER: 'hard-dance',
  HAPPY_HARDCORE: 'hard-dance', SPEEDCORE: 'hard-dance', DONK: 'hard-dance',
  HANDS_UP: 'hard-dance', JUMPSTYLE: 'hard-dance', MAKINA: 'hard-dance',
  // bass (днб/дабстеп/гараж)
  DNB: 'bass', JUNGLE: 'bass', DUBSTEP: 'bass', HALFTIME: 'bass', GARAGE: 'bass',
  SPEED_GARAGE: 'bass', BASSLINE: 'bass', GRIME: 'bass', JUKE: 'bass',
  // breakbeat
  BREAKBEAT: 'breakbeat', BIG_BEAT: 'breakbeat', BREAKCORE: 'breakbeat',
  BROKEN_BEAT: 'breakbeat', PROGRESSIVE_BREAKS: 'breakbeat', ELECTRO: 'breakbeat',
  // ambient
  AMBIENT: 'ambient', DARK_AMBIENT: 'ambient', NEW_AGE: 'ambient',
  BERLIN_SCHOOL: 'ambient', ILLBIENT: 'ambient', DRONE: 'ambient', DUNGEON_SYNTH: 'ambient',
  // downtempo
  DOWNTEMPO: 'downtempo', CHILLWAVE: 'downtempo', TRIP_HOP: 'downtempo',
  LOFI: 'downtempo', FUTURE_JAZZ: 'downtempo', ACID_JAZZ: 'downtempo', JAZZDANCE: 'downtempo',
  // synth-retro
  SYNTHPOP: 'synth-retro', SYNTHWAVE: 'synth-retro', VAPORWAVE: 'synth-retro',
  NEW_WAVE: 'synth-retro', DARKWAVE: 'synth-retro', ELECTROCLASH: 'synth-retro',
  EBM: 'synth-retro', NEW_BEAT: 'synth-retro', HI_NRG: 'synth-retro',
  EUROBEAT: 'synth-retro', EURODANCE: 'synth-retro', ITALODANCE: 'synth-retro',
  ITALO_DISCO: 'synth-retro', EURO_DISCO: 'synth-retro', DISCO_POLO: 'synth-retro',
  DANCE_POP: 'synth-retro', FREESTYLE: 'synth-retro', CHIPTUNE: 'synth-retro',
  // disco-funk
  DISCO: 'disco-funk', NU_DISCO: 'disco-funk', FUNK: 'disco-funk',
  FREE_FUNK: 'disco-funk', P_FUNK: 'disco-funk', BOOGIE: 'disco-funk', AFROBEAT: 'disco-funk',
  // electronic (без чёткого соседства)
  ELECTRONIC: 'electronic', IDM: 'electronic', GLITCH: 'electronic',
  LEFTFIELD: 'electronic', TRIBAL: 'electronic',
  // hiphop
  HIPHOP: 'hiphop', BOOMBAP: 'hiphop', TRAP: 'hiphop', DRILL: 'hiphop',
  CLOUDRAP: 'hiphop', PHONK: 'hiphop', GANGSTA: 'hiphop', G_FUNK: 'hiphop',
  HARDCORE_HIPHOP: 'hiphop', HORRORCORE: 'hiphop', CONSCIOUS: 'hiphop',
  JAZZY_HIPHOP: 'hiphop', INSTRUMENTAL_HIPHOP: 'hiphop', POP_RAP: 'hiphop',
  CRUNK: 'hiphop', BOUNCE: 'hiphop', SCREW: 'hiphop', MIAMI_BASS: 'hiphop',
  BASS_MUSIC: 'hiphop', BRITCORE: 'hiphop', RAGGA_HIPHOP: 'hiphop',
  TURNTABLISM: 'hiphop', CUT_UP_DJ: 'hiphop',
  // rnb-soul
  RNB: 'rnb-soul', NEOSOUL: 'rnb-soul', SOUL: 'rnb-soul', GOSPEL: 'rnb-soul',
  PSYCHEDELIC_SOUL: 'rnb-soul', NEW_JACK_SWING: 'rnb-soul', UK_STREET_SOUL: 'rnb-soul',
  // rock
  ROCK: 'rock', CLASSIC_ROCK: 'rock', HARD_ROCK: 'rock', BLUES_ROCK: 'rock',
  ROCK_N_ROLL: 'rock', ROCKABILLY: 'rock', PSYCHOBILLY: 'rock', SURF: 'rock',
  BEAT: 'rock', MOD: 'rock', TWIST: 'rock', DOO_WOP: 'rock', GARAGE_ROCK: 'rock',
  GLAM: 'rock', AOR: 'rock', ARENA_ROCK: 'rock', SOFT_ROCK: 'rock', POP_ROCK: 'rock',
  POWER_POP: 'rock', PUB_ROCK: 'rock', FOLK_ROCK: 'rock', COUNTRY_ROCK: 'rock',
  SOUTHERN_ROCK: 'rock', PSYCHEDELIC: 'rock', ACID_ROCK: 'rock', SPACE_ROCK: 'rock',
  PROGROCK: 'rock', ART_ROCK: 'rock', SYMPHONIC_ROCK: 'rock', KRAUTROCK: 'rock',
  MATH_ROCK: 'rock', POST_ROCK: 'rock', YEYE: 'rock',
  // indie
  INDIE: 'indie', ALTERNATIVE: 'indie', BRITPOP: 'indie', SHOEGAZE: 'indie',
  DREAMPOP: 'indie', ETHEREAL: 'indie', GRUNGE: 'indie', INDIEPOP: 'indie',
  // punk
  PUNK: 'punk', HARDCORE_PUNK: 'punk', MELODIC_HARDCORE: 'punk', POST_HARDCORE: 'punk',
  EMO: 'punk', POP_PUNK: 'punk', OI: 'punk', CRUST: 'punk', POWER_VIOLENCE: 'punk',
  NOISECORE: 'punk', POSTPUNK: 'punk', NO_WAVE: 'punk', GOTH_ROCK: 'punk',
  DEATHROCK: 'punk', COLDWAVE: 'punk',
  // metal
  METAL: 'metal', HEAVYMETAL: 'metal', THRASH: 'metal', SPEED_METAL: 'metal',
  POWER_METAL: 'metal', PROGRESSIVE_METAL: 'metal', DEATHMETAL: 'metal',
  MELODIC_DEATH_METAL: 'metal', TECHNICAL_DEATH_METAL: 'metal', BLACKMETAL: 'metal',
  ATMOSPHERIC_BLACK_METAL: 'metal', DEPRESSIVE_BLACK_METAL: 'metal',
  VIKING_METAL: 'metal', DOOM: 'metal', FUNERAL_DOOM: 'metal', SLUDGE_METAL: 'metal',
  STONER_ROCK: 'metal', GRINDCORE: 'metal', DEATHCORE: 'metal', METALCORE: 'metal',
  POSTMETAL: 'metal', NU_METAL: 'metal', FOLK_METAL: 'metal', FUNK_METAL: 'metal',
  GOTHIC_METAL: 'metal',
  // pop
  POP: 'pop', HYPERPOP: 'pop', BALLAD: 'pop', BUBBLEGUM: 'pop', EUROPOP: 'pop',
  CITY_POP: 'pop', J_POP: 'pop', K_POP: 'pop', KAYOKYOKU: 'pop', SCHLAGER: 'pop',
  CHANSON: 'pop', VOCAL: 'pop', NOVELTY: 'pop', LIGHT_MUSIC: 'pop', MUSIC_HALL: 'pop',
  BOLLYWOOD: 'pop', EASY_LISTENING: 'pop', LOUNGE: 'pop',
  // jazz
  JAZZ: 'jazz', BEBOP: 'jazz', HARD_BOP: 'jazz', POST_BOP: 'jazz', COOL_JAZZ: 'jazz',
  MODAL_JAZZ: 'jazz', FREE_JAZZ: 'jazz', FREE_IMPROVISATION: 'jazz',
  AVANTGARDE_JAZZ: 'jazz', FUSION: 'jazz', JAZZ_FUNK: 'jazz', JAZZ_ROCK: 'jazz',
  SWING: 'jazz', BIG_BAND: 'jazz', DIXIELAND: 'jazz', RAGTIME: 'jazz',
  GYPSY_JAZZ: 'jazz', SMOOTH_JAZZ: 'jazz', CONTEMPORARY_JAZZ: 'jazz',
  SOUL_JAZZ: 'jazz', LATIN_JAZZ: 'jazz', AFRO_CUBAN_JAZZ: 'jazz', SPACE_AGE: 'jazz',
  // blues
  BLUES: 'blues', DELTA_BLUES: 'blues', CHICAGO_BLUES: 'blues', TEXAS_BLUES: 'blues',
  LOUISIANA_BLUES: 'blues', COUNTRY_BLUES: 'blues', ELECTRIC_BLUES: 'blues',
  MODERN_ELECTRIC_BLUES: 'blues', HARMONICA_BLUES: 'blues', PIANO_BLUES: 'blues',
  JUMP_BLUES: 'blues', BOOGIE_WOOGIE: 'blues',
  // classical
  CLASSICAL: 'classical', MEDIEVAL: 'classical', RENAISSANCE: 'classical',
  BAROQUE: 'classical', ROMANTICISM: 'classical', IMPRESSIONIST: 'classical',
  MODERN_CLASSICAL: 'classical', CONTEMPORARY_CLASSICAL: 'classical',
  POST_MODERN_CLASSICAL: 'classical', NEO_ROMANTIC: 'classical',
  NEOCLASSICAL: 'classical', CHORAL: 'classical', OPERA: 'classical',
  ORCHESTRAL: 'classical', PIANO: 'classical',
  // folk
  FOLK: 'folk', NEOFOLK: 'folk', ACOUSTIC: 'folk', SINGER_SONGWRITER: 'folk',
  CAJUN: 'folk', CELTIC: 'folk', POLKA: 'folk', VOLKSMUSIK: 'folk',
  // country
  COUNTRY: 'country', BLUEGRASS: 'country', HILLBILLY: 'country', HONKY_TONK: 'country',
  // world
  WORLD: 'world', AFRICAN: 'world', HIGHLIFE: 'world', SOUKOUS: 'world', SEGA: 'world',
  RAI: 'world', ZOUK: 'world', PACIFIC: 'world', NORDIC: 'world', ROMANI: 'world',
  FADO: 'world', FLAMENCO: 'world', CANZONE_NAPOLETANA: 'world',
  CATALAN_MUSIC: 'world', LAIKO: 'world', ENTEKHNO: 'world', HINDUSTANI: 'world',
  INDIAN_CLASSICAL: 'world',
  // latin
  LATIN: 'latin', REGGAETON: 'latin', SALSA: 'latin', CUMBIA: 'latin',
  BOSSA_NOVA: 'latin', SAMBA: 'latin', BATUCADA: 'latin', BAIAO: 'latin',
  FORRO: 'latin', MPB: 'latin', TANGO: 'latin', BOLERO: 'latin', MAMBO: 'latin',
  CHA_CHA: 'latin', RUMBA: 'latin', GUAGUANCO: 'latin', GUAJIRA: 'latin',
  GUARACHA: 'latin', SON: 'latin', SON_MONTUNO: 'latin', AFRO_CUBAN: 'latin',
  CUBANO: 'latin', DESCARGA: 'latin', CHARANGA: 'latin', PACHANGA: 'latin',
  BOOGALOO: 'latin', MERENGUE: 'latin', VALLENATO: 'latin', PORRO: 'latin',
  NUEVA_CANCION: 'latin', RANCHERA: 'latin', MARIACHI: 'latin', NORTENO: 'latin',
  TEJANO: 'latin', BEGUINE: 'latin', COMPAS: 'latin',
  // reggae
  REGGAE: 'reggae', ROOTS_REGGAE: 'reggae', DANCEHALL: 'reggae', RAGGA: 'reggae',
  DUB: 'reggae', ROCKSTEADY: 'reggae', SKA: 'reggae', LOVERS_ROCK: 'reggae',
  REGGAE_POP: 'reggae', CALYPSO: 'reggae', SOCA: 'reggae',
  // soundtrack
  SOUNDTRACK: 'soundtrack', CINEMATIC: 'soundtrack', MUSICAL: 'soundtrack', BRASS: 'soundtrack',
  // experimental
  EXPERIMENTAL: 'experimental', NOISE: 'experimental', INDUSTRIAL: 'experimental',
  MUSIQUE_CONCRETE: 'experimental', POWER_ELECTRONICS: 'experimental',
  RHYTHMIC_NOISE: 'experimental', SOUND_COLLAGE: 'experimental',
  FIELD_RECORDING: 'experimental',
  // spoken
  SPOKENWORD: 'spoken',
};

export function expandGenresToFamilies(genres: TrackGenre[]): TrackGenre[] {
  const families = new Set<GenreFamily>();
  for (const genre of genres) families.add(GENRE_FAMILY[genre]);
  return genreEnum.enumValues.filter((genre) => families.has(GENRE_FAMILY[genre]));
}
