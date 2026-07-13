import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// app/__tests__/ -> app/
const APP_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Рекурсивно собрать все .tsx файлы внутри app/ (страницы, лейауты, компоненты). */
function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectTsx(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Убрать комментарии, чтобы не ловить упоминания классов в пояснениях. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('app-shell layout invariants', () => {
  // Регрессия: страницы/лейауты не должны распирать вьюпорт на 100vh — иначе
  // высота Nav + резерв под плеер дают постоянный «лишний» скролл документа.
  // Вертикальную высоту даёт скролл-область в корневом layout; страницы
  // заполняют её через min-h-full / flex-1.
  it('никакой .tsx в app/ не использует min-h-screen или h-screen', () => {
    const offenders = collectTsx(APP_DIR)
      .filter((file) => /\b(min-h-screen|h-screen)\b/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => path.relative(APP_DIR, file));

    expect(offenders).toEqual([]);
  });

  it('корневой layout задаёт app-shell: фиксированное окно + одна скролл-область', () => {
    const layout = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf8');
    // <body> фиксированной высоты без скролла документа
    expect(layout).toMatch(/<body[^>]*className="[^"]*\bh-full\b/);
    // overflow-clip, не overflow-hidden: hidden остаётся программно скроллируемым
    // контейнером (scrollIntoView/фокус за краем сдвигает весь UI без возможности
    // вернуть — скроллбара нет), clip не создаёт скролл-контейнер вовсе.
    expect(layout).toMatch(/<body[^>]*className="[^"]*\boverflow-clip\b/);
    expect(stripComments(layout)).not.toMatch(/<body[^>]*className="[^"]*\boverflow-hidden\b/);
    // единственная вертикальная скролл-область для контента, без горизонтального
    // программного скролла (см. #main-content)
    expect(layout).toMatch(/overflow-y-auto/);
    expect(layout).toMatch(/id="main-content"[^>]*className="[^"]*\boverflow-x-clip\b/);
    // плеер — элемент потока (занимает место только когда играет), без постоянного резерва
    expect(layout).toMatch(/<PlayerWrapper\s*\/>/);
  });

  it('admin layout скроллит контент внутри, а не страницей целиком', () => {
    const layout = readFileSync(path.join(APP_DIR, 'admin', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/<main[^>]*className="[^"]*\boverflow-y-auto\b/);
    expect(layout).toMatch(/<main[^>]*className="[^"]*\boverflow-x-clip\b/);
  });

  it('(listener) layout: двухпанельный шелл — скролл во внутренней панели, не sticky в общей области', () => {
    // Эталон — admin/layout.tsx: сайдбар закреплён (flex-панель), скроллится только
    // <main>. Sticky-сайдбар в ОБЩЕЙ скролл-области (#main-content) давал смазывание
    // контента при быстрой прокрутке — поэтому здесь именно внутренний скролл-пейн.
    const layout = readFileSync(path.join(APP_DIR, '(listener)', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/data-scroll-area[^>]*\boverflow-y-auto\b/);
    expect(layout).toMatch(/data-scroll-area[^>]*\bmd:overflow-x-clip\b/);
    expect(layout).toMatch(/<ListenerSidebar\b/);
    // обёртка-пейн НЕ <main> (страницы рендерят собственный <main> — без вложенности)
    expect(layout).not.toMatch(/<main\b/);
    // на десктопе шелл занимает фиксированную высоту окна (h-full), а не распирает 100vh
    expect(layout).toMatch(/\bmd:h-full\b/);
  });

  it('root layout не дублирует футер (он в (listener) layout)', () => {
    const root = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf8');
    expect(root).not.toMatch(/<Footer\s*\/>/);
  });

  // Регрессия «двойной скролл»: на десктопе listener-страниц скроллит внутренняя панель,
  // а #main-content обязан быть заклипан — иначе любой случайный overflow (плюс
  // scrollbar-gutter) рисует вторую полосу скролла у края окна.
  it('десктоп listener: внешняя область клипается при наличии внутренней панели', () => {
    const layout = readFileSync(path.join(APP_DIR, '(listener)', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/data-desktop-pane/);

    const css = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');
    const rule = css.match(/@media \(min-width: 48rem\)[\s\S]*?#main-content:has\(\[data-desktop-pane\]\)[\s\S]*?\{([\s\S]*?)\}/);
    expect(rule?.[1]).toMatch(/overflow-y:\s*clip/);
  });

  // Регрессия «чёрная страница»: SSR-вывод template.tsx не должен прятать контент
  // (инлайн opacity:0 до гидрации = чёрный экран, пока dev/медленный клиент грузит JS).
  it('template.tsx не задаёт безусловный initial opacity 0', () => {
    const tpl = readFileSync(path.join(APP_DIR, 'template.tsx'), 'utf8');
    expect(tpl).not.toMatch(/initial=\{\{/);
  });

  // Регрессия scroll-jitter: завершённая CSS-анимация с fill both/forwards остаётся
  // «в силе» → Chromium держит композит-слой навсегда, соседи дрожат при скролле.
  // Entrance-анимации обязаны отпускать элемент: fill backwards (или без fill).
  it('конечные анимации в globals.css не используют fill both/forwards', () => {
    const css = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');
    const offenders = [...css.matchAll(/animation:[^;]+;/g)]
      .map((m) => m[0])
      .filter((decl) => !/\binfinite\b/.test(decl) && /\b(both|forwards)\b/.test(decl));

    expect(offenders).toEqual([]);
  });
});
