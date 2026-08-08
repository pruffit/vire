import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// app/__tests__/ -> app/ -> apps/web/
const WEB_DIR = fileURLToPath(new URL('../..', import.meta.url));
const SCAN_ROOTS = ['app', 'components'];

/** Рекурсивно собрать все .tsx файлы (кроме тестов) внутри app/ и components/. */
function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectTsx(full));
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function collectAll(): string[] {
  return SCAN_ROOTS.flatMap((root) => collectTsx(path.join(WEB_DIR, root)));
}

function relFiles(files: string[]): string[] {
  return files.map((f) => path.relative(WEB_DIR, f).replace(/\\/g, '/'));
}

// text-white / bg-white / border-white / white\/NN / black\/NN литералами, и hex в
// Tailwind arbitrary-value синтаксисе (bg-[#...] и т.п.) — запрещены ui-principles.md:129-132.
const COLOR_LITERAL_RE = /\b(?:text|bg|border)-white\b|\bwhite\/\d{1,3}\b|\bblack\/\d{1,3}\b|\b[\w-]+-\[#[0-9a-fA-F]{3,8}\]/;

// Сырой eyebrow-паттерн вместо роли `label-mono` — три токена в одной строке className.
const RAW_EYEBROW_RE = /\bfont-mono\b/;
const UPPERCASE_RE = /\buppercase\b/;
const TRACKING_ARBITRARY_RE = /\btracking-\[/;

/**
 * Allowlist правила 1 (цветовые литералы). Ключ — путь относительно apps/web.
 * `overlay: true` — легитимный оверлей поверх видео/изображения (постоянное исключение).
 * `overlay: false` — временный технический долг, кандидат на чистку в срезах B/C.
 */
const COLOR_LITERAL_ALLOWLIST: Record<string, { overlay: boolean; reason: string }> = {
  'app/(listener)/nrvz914/[code]/party-screen.tsx': {
    overlay: true,
    reason: 'полноэкранный оверлей поверх видео вечеринки — токен фона неприменим (спека A4)',
  },
  'components/video-player.tsx': {
    overlay: true,
    reason: 'контролы и градиент поверх произвольного видео — цвет должен быть нейтральным вне темы',
  },
  'components/zoomable-cover.tsx': {
    overlay: true,
    reason: 'полноэкранный зум-оверлей поверх обложки — токен фона неприменим',
  },
  'components/visualizer/capture-button.tsx': {
    overlay: true,
    reason: 'контрол поверх canvas-визуализатора (произвольная генеративная графика)',
  },
  'components/home/cover-rail.tsx': {
    overlay: true,
    reason: 'hover-плашка поверх обложки трека в ленте — токен фона неприменим',
  },

  'components/artist-card.tsx': {
    overlay: true,
    reason: 'кольцо+тень вокруг аватара артиста при hover — токен рамки даёт непредсказуемый контраст на произвольном фото',
  },

  // Временные — литералы вне медиа-оверлеев, чистка в срезах B/C (design-system plan, A4).
  'components/adaptive-menu.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/announcements.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/color-field.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(listener)/about/about-content.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/cookie-banner.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/command-palette.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(listener)/(home)/loading.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/easter-eggs.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/date-field.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(auth)/sign-in/page.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/chat/link-approve.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/genre-picker.tsx': { overlay: false, reason: 'temporary — срез B/C (в карте плана, топ-15)' },
  'components/artist-catalog.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/explicit-badge.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/editorial-playlist-card.tsx': {
    overlay: true,
    reason: 'обложки-веер плейлиста и бейдж поверх них — токен фона неприменим к произвольным обложкам',
  },
  'components/featured-release.tsx': {
    overlay: true,
    reason: 'полноэкранная hero-карточка: текст и контролы поверх блюра обложки и градиента-скрима — токен фона неприменим',
  },
  'components/friends/profile-more-menu.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/listening-now.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/lyrics-editor.tsx': { overlay: false, reason: 'temporary — срез B/C (в карте плана, топ-15)' },
  'app/(listener)/smartlink/[artistSlug]/[linkSlug]/page.tsx': {
    overlay: true,
    reason: 'тень обложки и белые плашки под лого поверх произвольного --artist-accent — гарантируют читаемость на любой теме артиста',
  },
  'components/jam/party-video-slot.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/notifications/notification-bell.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/playlist-quick-look.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/playlist-cover.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/release-countdown.tsx': {
    overlay: true,
    reason: 'кольцо+тень и тёмный скрим поверх обложки релиза — токен фона неприменим',
  },
  'components/presave-button.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/waveform-scrubber.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/popover.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/queue-panel.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/listener/profile/setting-toggle.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/progress-line.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/listener/profile/profile-hero.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/home/feed-list.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/select.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/player-icons.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/mini-bar.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/listener/profile/appearance-settings.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/player/fullscreen.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/release-quick-look.tsx': {
    overlay: true,
    reason: 'кольцо/тень/скрим-плей поверх обложки релиза в peek-оверлее — токен фона неприменим',
  },
  'components/links-editor.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/sortable-track-row.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/videos-editor.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/sheet.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/theme-editor.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'components/track-row.tsx': {
    overlay: true,
    reason: 'play/pause-скрим и иконка поверх обложки трека — токен фона неприменим',
  },
  'app/(listener)/design/page.tsx': { overlay: false, reason: 'демо-витрина токенов — swatch-примеры сознательно показывают сырые значения' },
  'app/(listener)/artists/[slug]/follow-button.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(listener)/artists/[slug]/artist-collapse-bar.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(listener)/artists/(catalog)/loading.tsx': { overlay: false, reason: 'temporary — срез B/C' },
  'app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/download-button.tsx': { overlay: false, reason: 'temporary — срез B/C' },
};

/**
 * Allowlist правила 2 (сырой eyebrow-паттерн). Временный — раскатка `label-mono`
 * по экранам вне ui-kit.tsx/content-kit.tsx идёт в срезах B/C.
 */
const RAW_EYEBROW_ALLOWLIST = new Set<string>([
  'app/(listener)/design/page.tsx',
  'app/admin/artists/[id]/edit/artist-edit-form.tsx',
  'app/admin/layout.tsx',
  'app/admin/releases/[id]/edit/release-edit-form.tsx',
  'app/admin/system/system-panel.tsx',
  'app/admin/tracks/[id]/edit/track-edit-form.tsx',
  'app/dashboard/layout.tsx',
  'app/dashboard/mobile-artist-switcher.tsx',
  'app/dashboard/releases/[id]/track-manager.tsx',
  'app/dashboard/stats-section.tsx',
  'app/fwqa688/page.tsx',
  'components/credits-editor.tsx',
  'components/select.tsx',
]);

describe('design tokens: роли и запрет литералов вне allowlist', () => {
  // Регрессия: `text-white`/`bg-white`/`white/NN`/`black/NN`/hex в className в обход
  // OKLCH-токенов платформы (ui-principles.md:129-132). Часть легитимна — оверлеи поверх
  // видео/изображений, где токен фона неприменим; остальное — временный долг (срез B/C).
  it('цветовые литералы вне allowlist не используются', () => {
    const files = relFiles(collectAll());
    const offenders = files.filter((rel) => {
      if (rel in COLOR_LITERAL_ALLOWLIST) return false;
      const full = path.join(WEB_DIR, rel);
      return COLOR_LITERAL_RE.test(stripComments(readFileSync(full, 'utf8')));
    });

    expect(offenders).toEqual([]);
  });

  // Allowlist не должен протухать в другую сторону: запись, для которой в коде больше
  // нет нарушения, — сигнал вычистить её (срез B/C уже почистил файл).
  it('allowlist цветовых литералов не содержит лишних записей', () => {
    const stale = Object.keys(COLOR_LITERAL_ALLOWLIST).filter((rel) => {
      const full = path.join(WEB_DIR, rel);
      try {
        return !COLOR_LITERAL_RE.test(stripComments(readFileSync(full, 'utf8')));
      } catch {
        return true;
      }
    });

    expect(stale).toEqual([]);
  });

  // Регрессия: `font-mono` + `uppercase` + `tracking-[...]` вручную в одной строке вместо
  // роли `label-mono` (packages/ui/src/globals.css) — копия того паттерна, который эта
  // роль призвана устранить.
  it('сырой eyebrow-паттерн вне allowlist не используется', () => {
    const files = relFiles(collectAll());
    const offenders = files.filter((rel) => {
      if (RAW_EYEBROW_ALLOWLIST.has(rel)) return false;
      const full = path.join(WEB_DIR, rel);
      const lines = stripComments(readFileSync(full, 'utf8')).split('\n');
      return lines.some(
        (line) => RAW_EYEBROW_RE.test(line) && UPPERCASE_RE.test(line) && TRACKING_ARBITRARY_RE.test(line),
      );
    });

    expect(offenders).toEqual([]);
  });

  it('allowlist eyebrow-паттерна не содержит лишних записей', () => {
    const stale = [...RAW_EYEBROW_ALLOWLIST].filter((rel) => {
      const full = path.join(WEB_DIR, rel);
      let lines: string[];
      try {
        lines = stripComments(readFileSync(full, 'utf8')).split('\n');
      } catch {
        return true;
      }
      return !lines.some(
        (line) => RAW_EYEBROW_RE.test(line) && UPPERCASE_RE.test(line) && TRACKING_ARBITRARY_RE.test(line),
      );
    });

    expect(stale).toEqual([]);
  });

  // Роли определены рядом с токенами, не изобретены заново в потребителях.
  it('роли label-mono/label-wide/readout и text-wrap:balance определены в packages/ui/src/globals.css', () => {
    const css = readFileSync(path.join(WEB_DIR, '..', '..', 'packages', 'ui', 'src', 'globals.css'), 'utf8');
    expect(css).toMatch(/@utility label-mono\s*\{/);
    expect(css).toMatch(/@utility label-wide\s*\{/);
    expect(css).toMatch(/@utility readout\s*\{/);
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{\s*text-wrap:\s*balance;?\s*\}/);
  });
});
