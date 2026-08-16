export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export interface Tokens {
  color: {
    background: OklchColor;
    foreground: OklchColor;
    card: OklchColor;
    cardForeground: OklchColor;
    popover: OklchColor;
    popoverForeground: OklchColor;
    primary: OklchColor;
    primaryForeground: OklchColor;
    secondary: OklchColor;
    secondaryForeground: OklchColor;
    muted: OklchColor;
    mutedForeground: OklchColor;
    accent: OklchColor;
    accentForeground: OklchColor;
    destructive: OklchColor;
    border: OklchColor;
    input: OklchColor;
    ring: OklchColor;
  };
  /** Базовый радиус в px (RN-совместимо — без rem, который зависит от root font-size). */
  radius: number;
}

const CSS_VAR_NAMES: Record<keyof Tokens['color'], string> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  cardForeground: 'card-foreground',
  popover: 'popover',
  popoverForeground: 'popover-foreground',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  secondary: 'secondary',
  secondaryForeground: 'secondary-foreground',
  muted: 'muted',
  mutedForeground: 'muted-foreground',
  accent: 'accent',
  accentForeground: 'accent-foreground',
  destructive: 'destructive',
  border: 'border',
  input: 'input',
  ring: 'ring',
};

const COLOR_KEYS = Object.keys(CSS_VAR_NAMES) as (keyof Tokens['color'])[];

function formatOklch({ l, c, h }: OklchColor): string {
  return `oklch(${l} ${c} ${h})`;
}

/** px → rem string, same convention as the hand-written --radius: 0.375rem. */
function pxToRem(px: number): string {
  return `${px / 16}rem`;
}

/** Не CSS-строка, а генератор — единственное место, где меняется формат вывода tokens.css. */
export function generateCss(tokens: Tokens): string {
  const lines = COLOR_KEYS.map(
    (key) => `  --${CSS_VAR_NAMES[key]}: ${formatOklch(tokens.color[key])};`,
  );
  return `:root {\n${lines.join('\n')}\n\n  --radius: ${pxToRem(tokens.radius)};\n}\n`;
}

/** sm/md/lg/xl — формула Tailwind-пресета (base-2/base/base+4/base+8), см. globals.css. */
export function generateTs(tokens: Tokens): string {
  const colorLines = COLOR_KEYS.map(
    (key) => `    ${key}: { l: ${tokens.color[key].l}, c: ${tokens.color[key].c}, h: ${tokens.color[key].h} },`,
  );
  return `// Автосгенерировано из packages/design-tokens/src/tokens.json — не редактировать руками.
export const tokens = {
  color: {
${colorLines.join('\n')}
  },
  radius: {
    sm: ${tokens.radius - 2},
    md: ${tokens.radius},
    lg: ${tokens.radius + 4},
    xl: ${tokens.radius + 8},
  },
} as const;

export type DesignTokens = typeof tokens;
`;
}
