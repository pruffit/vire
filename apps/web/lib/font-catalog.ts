/** Имя шрифта → CSS-переменная, без next/font/google — используется там, где не нужно тянуть загрузчик шрифтов (серверная валидация, клиентский пикер). */
export const SANS_FONT_VARS: Record<string, string> = {
  Inter: 'var(--font-inter)',
  Montserrat: 'var(--font-montserrat)',
  Unbounded: 'var(--font-unbounded)',
  Manrope: 'var(--font-manrope)',
  Geologica: 'var(--font-geologica)',
  Rubik: 'var(--font-rubik)',
  'Golos Text': 'var(--font-golos-text)',
  Onest: 'var(--font-onest)',
  Oswald: 'var(--font-oswald)',
  Comfortaa: 'var(--font-comfortaa)',
  'Russo One': 'var(--font-russo-one)',
  'Playfair Display': 'var(--font-playfair-display)',
  Cormorant: 'var(--font-cormorant)',
};

export const MONO_FONT_VARS: Record<string, string> = {
  'JetBrains Mono': 'var(--font-jetbrains-mono)',
  'Fira Code': 'var(--font-fira-code)',
  'IBM Plex Mono': 'var(--font-ibm-plex-mono)',
  'PT Mono': 'var(--font-pt-mono)',
  'Ubuntu Mono': 'var(--font-ubuntu-mono)',
};

export const SANS_FONTS = Object.keys(SANS_FONT_VARS);
export const MONO_FONTS = Object.keys(MONO_FONT_VARS);
