import {
  Inter,
  Montserrat,
  Unbounded,
  Manrope,
  Geologica,
  Rubik,
  Golos_Text,
  Onest,
  Oswald,
  Comfortaa,
  Russo_One,
  Playfair_Display,
  Cormorant,
  JetBrains_Mono,
  Fira_Code,
  IBM_Plex_Mono,
  PT_Mono,
  Ubuntu_Mono,
} from 'next/font/google';
import { SANS_FONT_VARS, MONO_FONT_VARS, SANS_FONTS, MONO_FONTS } from '@/lib/font-catalog';

// All fonts offered in the artist theme editor, exposed as CSS variables.
// Все — preload: false, грузятся только когда попадают в CSS страницы (артист выбрал тему).
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap', preload: false });
const montserrat = Montserrat({ subsets: ['latin', 'cyrillic'], variable: '--font-montserrat', display: 'swap', preload: false });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded', display: 'swap', preload: false });
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap', preload: false });
const geologica = Geologica({ subsets: ['latin', 'cyrillic'], variable: '--font-geologica', display: 'swap', preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains-mono', display: 'swap', preload: false });
const firaCode = Fira_Code({ subsets: ['latin', 'cyrillic'], variable: '--font-fira-code', display: 'swap', preload: false });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', display: 'swap', preload: false });

const rubik = Rubik({ subsets: ['latin', 'cyrillic'], variable: '--font-rubik', display: 'swap', preload: false });
const golosText = Golos_Text({ subsets: ['latin', 'cyrillic'], variable: '--font-golos-text', display: 'swap', preload: false });
const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-onest', display: 'swap', preload: false });
const oswald = Oswald({ subsets: ['latin', 'cyrillic'], variable: '--font-oswald', display: 'swap', preload: false });
const comfortaa = Comfortaa({ subsets: ['latin', 'cyrillic'], variable: '--font-comfortaa', display: 'swap', preload: false });
const russoOne = Russo_One({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-russo-one', display: 'swap', preload: false });
const playfairDisplay = Playfair_Display({ subsets: ['latin', 'cyrillic'], variable: '--font-playfair-display', display: 'swap', preload: false });
const cormorant = Cormorant({ subsets: ['latin', 'cyrillic'], variable: '--font-cormorant', display: 'swap', preload: false });
const ptMono = PT_Mono({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-pt-mono', display: 'swap', preload: false });
const ubuntuMono = Ubuntu_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--font-ubuntu-mono', display: 'swap', preload: false });

/** Space-separated className with every font variable — attach to <html>. */
export const fontVariables = [
  inter,
  montserrat,
  unbounded,
  manrope,
  geologica,
  rubik,
  golosText,
  onest,
  oswald,
  comfortaa,
  russoOne,
  playfairDisplay,
  cormorant,
  jetbrainsMono,
  firaCode,
  ibmPlexMono,
  ptMono,
  ubuntuMono,
]
  .map((f) => f.variable)
  .join(' ');

export { SANS_FONTS, MONO_FONTS };

/**
 * CSS-var overrides for an artist's fonts, spread into the root element's style.
 * Must override `--font-geist-sans`/`--font-geist-mono`, not `--font-sans`/`--font-mono` —
 * Tailwind's `@theme inline` bakes the geist var name into `.font-sans` at compile time.
 */
export function artistFontStyle(tokens: { fontSans?: string; fontMono?: string }): Record<string, string> {
  const style: Record<string, string> = {};
  const sans = tokens.fontSans ? SANS_FONT_VARS[tokens.fontSans] : undefined;
  const mono = tokens.fontMono ? MONO_FONT_VARS[tokens.fontMono] : undefined;
  if (sans) {
    style['--font-geist-sans'] = sans;
    style['--font-sans'] = sans;
  }
  if (mono) {
    style['--font-geist-mono'] = mono;
    style['--font-mono'] = mono;
  }
  return style;
}
