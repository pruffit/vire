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
  /**
   * ВИТРИННОЕ НАЧЕРТАНИЕ — одно на все клиенты. Им набираются заголовок трека, строка песни
   * и кнопка «ПОТОК»; интерфейс им не набирают, в мелком кегле плакатный гротеск превращается
   * в гребёнку. Живёт в токенах, а не в ките одного клиента: выбор делается один раз и обязан
   * быть одинаковым в вебе и на Android, иначе одна и та же кнопка выглядит по-разному.
   *
   * `tracking` — разрядка в пикселях при наборе прописными: широкому гротеску её нужно мало,
   * узкому много, и это свойство самого начертания, а не кнопки.
   */
  font: {
    display: { family: string; weight: number; tracking: number };
  };
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

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Линейный sRGB-канал -> гамма-корректированный (стандартная sRGB transfer function). */
function linearToGammaChannel(c: number): number {
  const clamped = clamp01(c);
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

/**
 * OKLCH -> sRGB hex. Björn Ottosson's OKLab matrices (те же, что в культовом culori/CSS
 * Color 4), переписаны как чистая функция без зависимостей — RN не ест `oklch()` в JS.
 */
export function oklchToHex({ l, c, h }: OklchColor): string {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const toByte = (channel: number) => Math.round(clamp01(linearToGammaChannel(channel)) * 255);
  const toHex = (byte: number) => byte.toString(16).padStart(2, '0');

  return `#${toHex(toByte(rLinear))}${toHex(toByte(gLinear))}${toHex(toByte(bLinear))}`;
}

/** RN не понимает `oklch()` в JS-объектах — цвета конвертируются в hex на этапе генерации. */
export function generateNative(tokens: Tokens): string {
  const colorLines = COLOR_KEYS.map((key) => `    ${key}: '${oklchToHex(tokens.color[key])}',`);
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
  font: {
    display: {
      family: '${tokens.font.display.family}',
      weight: ${tokens.font.display.weight},
      tracking: ${tokens.font.display.tracking},
    },
  },
} as const;

export type DesignTokens = typeof tokens;
`;
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
  font: {
    display: {
      family: '${tokens.font.display.family}',
      weight: ${tokens.font.display.weight},
      tracking: ${tokens.font.display.tracking},
    },
  },
} as const;

export type DesignTokens = typeof tokens;
`;
}
