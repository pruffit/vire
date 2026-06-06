import {
  Inter,
  Montserrat,
  Unbounded,
  Manrope,
  Geologica,
  JetBrains_Mono,
  Fira_Code,
  IBM_Plex_Mono,
} from 'next/font/google';

// All fonts offered in the artist theme editor. Loaded once, exposed as CSS
// variables so an artist's chosen font can be applied per-page.
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin', 'cyrillic'], variable: '--font-montserrat', display: 'swap' });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded', display: 'swap' });
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap' });
const geologica = Geologica({ subsets: ['latin', 'cyrillic'], variable: '--font-geologica', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains-mono', display: 'swap' });
const firaCode = Fira_Code({ subsets: ['latin', 'cyrillic'], variable: '--font-fira-code', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', display: 'swap' });

/** Space-separated className with every font variable — attach to <html>. */
export const fontVariables = [
  inter,
  montserrat,
  unbounded,
  manrope,
  geologica,
  jetbrainsMono,
  firaCode,
  ibmPlexMono,
]
  .map((f) => f.variable)
  .join(' ');

const SANS_VARS: Record<string, string> = {
  Inter: 'var(--font-inter)',
  Montserrat: 'var(--font-montserrat)',
  Unbounded: 'var(--font-unbounded)',
  Manrope: 'var(--font-manrope)',
  Geologica: 'var(--font-geologica)',
};

const MONO_VARS: Record<string, string> = {
  'JetBrains Mono': 'var(--font-jetbrains-mono)',
  'Fira Code': 'var(--font-fira-code)',
  'IBM Plex Mono': 'var(--font-ibm-plex-mono)',
};

export const SANS_FONTS = Object.keys(SANS_VARS);
export const MONO_FONTS = Object.keys(MONO_VARS);

/**
 * CSS-variable overrides for an artist's chosen fonts. Spread into the root
 * element's `style` on a themed page; descendants using `font-sans`/`font-mono`
 * (or inheriting from it) then resolve to the artist's fonts.
 */
export function artistFontStyle(tokens: { fontSans?: string; fontMono?: string }): Record<string, string> {
  const style: Record<string, string> = {};
  const sans = tokens.fontSans ? SANS_VARS[tokens.fontSans] : undefined;
  const mono = tokens.fontMono ? MONO_VARS[tokens.fontMono] : undefined;
  if (sans) style['--font-sans'] = sans;
  if (mono) style['--font-mono'] = mono;
  return style;
}
