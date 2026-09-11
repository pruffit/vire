import {
  DEBUG_MODES,
  MATERIAL_RANGES,
  PRESET_NAMES,
  type VireGlassMaterial,
  type VireGlassNumericKey,
  type VireGlassOptics,
} from '@vire/vireglass';

/** Три стенда: доводка материала, экраны с деталями по месту и сцена морфинга. */
const VIEWS = ['material', 'screens', 'morph'] as const;
const VIEW_NAMES = ['материал', 'экраны', 'морфинг'] as const;

export type PanelState = {
  /** Что на стенде: доводка материала или телефонные экраны с деталями по месту. */
  view: 'material' | 'screens' | 'morph';
  zone: number;
  /** -1 — базовый материал продукта, иначе индекс в PRESET_NAMES. */
  preset: number;
  debug: number;
  material: VireGlassMaterial;
};

export type PanelHandlers = {
  onView: (view: PanelState['view']) => void;
  onZone: (index: number) => void;
  onPreset: (index: number) => void;
  onDebug: (index: number) => void;
  onMaterial: (key: VireGlassNumericKey, value: number) => void;
  onReset: () => void;
};

const CSS = `
.vg-panel {
  position: fixed; inset: 12px 12px 12px auto; width: 316px; z-index: 10;
  display: flex; flex-direction: column; border-radius: 16px; overflow: hidden;
  background: #0d1016f2; border: 1px solid #ffffff1a;
  box-shadow: 0 24px 60px #00000073, inset 0 1px 0 #ffffff14;
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e7ecf3;
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
}
/* min-height:0 обязателен: без него flex-элемент не сжимается ниже своего контента,
   overflow-y:auto остаётся без работы, и панель просто обрезает низ вместо прокрутки. */
.vg-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: 16px 16px 20px; scrollbar-width: thin; scrollbar-color: #ffffff33 transparent; }
/* Пока внизу есть что показать, край панели притенён: без этого признака панель читается
   как обрезанная, и прокрутку просто не ищут. */
.vg-panel[data-more="1"]::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; pointer-events: none;
  background: linear-gradient(to bottom, #0d101600, #0d1016e6);
}
.vg-scroll::-webkit-scrollbar { width: 10px; }
.vg-scroll::-webkit-scrollbar-thumb {
  background: #ffffff26; border-radius: 999px; border: 3px solid transparent; background-clip: content-box;
}
.vg-scroll::-webkit-scrollbar-thumb:hover { background: #ffffff40; background-clip: content-box; }

.vg-title { padding: 14px 16px 12px; border-bottom: 1px solid #ffffff14; display: flex;
  align-items: baseline; justify-content: space-between; gap: 8px; }
.vg-title b { font-size: 13px; font-weight: 600; letter-spacing: .01em; }
.vg-title span { font-size: 11px; color: #7d8a9b; }

.vg-panel h2 { margin: 20px 0 8px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: #78859a; font-weight: 600; }
.vg-panel h2:first-child { margin-top: 0; }

.vg-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.vg-chip { padding: 6px 11px; border-radius: 9px; border: 1px solid #ffffff1f; background: #ffffff0a;
  color: #cdd6e2; font: inherit; line-height: 1.1; cursor: pointer; transition: background .12s, color .12s; }
.vg-chip:hover { background: #ffffff17; color: #f2f6fa; }
.vg-chip[aria-pressed="true"] { background: #eaf0f8; color: #0d1016; border-color: transparent; font-weight: 500; }

.vg-row { display: grid; grid-template-columns: 76px 1fr 46px; align-items: center; gap: 10px; margin: 9px 0; }
.vg-row > span { color: #9aa7b8; font-size: 12px; }
.vg-row output { text-align: right; color: #e7ecf3; font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.vg-row input { -webkit-appearance: none; appearance: none; width: 100%; height: 18px; background: none; cursor: pointer; }
.vg-row input::-webkit-slider-runnable-track { height: 3px; border-radius: 999px; background: #ffffff21; }
.vg-row input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 13px; height: 13px;
  margin-top: -5px; border-radius: 50%; background: #eaf0f8; box-shadow: 0 1px 3px #0009; }
.vg-row input::-moz-range-track { height: 3px; border-radius: 999px; background: #ffffff21; }
.vg-row input::-moz-range-thumb { width: 13px; height: 13px; border: none; border-radius: 50%; background: #eaf0f8; }

.vg-derived { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; font-size: 12px; }
.vg-derived span { color: #8492a4; }
.vg-derived b { color: #dbe3ec; font-weight: 400;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.vg-hint { color: #6c7a8c; margin-top: 16px; font-size: 11px; line-height: 1.6; }
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

type ChipRow = { node: HTMLElement; setActive: (index: number) => void };

function chipRow(labels: readonly string[], onPick: (i: number) => void): ChipRow {
  const row = el('div', { className: 'vg-chips' });
  const chips = labels.map((label, i) => {
    const chip = el('button', { className: 'vg-chip', textContent: label, type: 'button' });
    chip.addEventListener('click', () => onPick(i));
    row.append(chip);
    return chip;
  });
  return {
    node: row,
    setActive(index) {
      chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(i === index)));
    },
  };
}

/** Следствия показываются рядом с причинами и НЕ редактируются: настраивают причины. */
const DERIVED: (keyof VireGlassOptics)[] = [
  'blur',
  'refraction',
  'refractionScale',
  'bevelDp',
  'fresnel',
  'specular',
  'dispersion',
  'bodyDensity',
  'edgeLight',
  'iridescence',
  'diffraction',
  'colorPickup',
];

export function createPanel(state: PanelState, handlers: PanelHandlers, zoneNames: readonly string[]) {
  document.head.append(el('style', { textContent: CSS }));
  const shell = el('aside', { className: 'vg-panel' });
  const panel = el('div', { className: 'vg-scroll' });
  shell.append(
    el('div', { className: 'vg-title' }, [
      el('b', { textContent: 'VireGlass' }),
      el('span', { textContent: 'лаборатория материала' }),
    ]),
    panel,
  );

  const views = chipRow([...VIEW_NAMES], (i) => handlers.onView(VIEWS[i]));
  const zones = chipRow(zoneNames, handlers.onZone);
  const presets = chipRow(['база', ...PRESET_NAMES], (i) => handlers.onPreset(i - 1));

  panel.append(
    el('h2', { textContent: 'стенд' }),
    views.node,
    el('h2', { textContent: 'фон' }),
    zones.node,
    el('h2', { textContent: 'пресет' }),
    presets.node,
    el('h2', { textContent: 'причины' }),
  );

  const rows = new Map<VireGlassNumericKey, { input: HTMLInputElement; out: HTMLOutputElement }>();
  for (const key of Object.keys(MATERIAL_RANGES) as VireGlassNumericKey[]) {
    const [lo, hi] = MATERIAL_RANGES[key];
    const value = state.material[key];
    const out = el('output', { textContent: String(round(value)) });
    const input = el('input', {
      type: 'range',
      min: String(lo),
      max: String(hi),
      step: String((hi - lo) / 200),
      value: String(value),
    });
    input.addEventListener('input', () => {
      out.textContent = String(round(Number(input.value)));
      handlers.onMaterial(key, Number(input.value));
    });
    rows.set(key, { input, out });
    panel.append(el('div', { className: 'vg-row' }, [el('span', { textContent: key }), input, out]));
  }

  panel.append(el('h2', { textContent: 'следствия' }));
  const derived = el('div', { className: 'vg-derived' });
  const derivedValues = new Map<string, HTMLElement>();
  for (const key of DERIVED) {
    const value = el('b', { textContent: '—' });
    derivedValues.set(key, value);
    derived.append(el('span', { textContent: key }), value);
  }
  panel.append(derived);

  const debugRow = chipRow(DEBUG_MODES, handlers.onDebug);
  panel.append(
    el('h2', { textContent: 'debug' }),
    debugRow.node,
    el('div', { className: 'vg-hint' }, [
      'Состояние живёт в адресе — ссылку можно сохранить и вернуться к тому же кадру. ',
      '?ui=0 убирает панель.',
    ]),
  );

  const reset = el('button', { className: 'vg-chip', textContent: 'сбросить причины', type: 'button' });
  reset.addEventListener('click', handlers.onReset);
  panel.append(el('div', { className: 'vg-chips' }, [reset]));

  document.body.append(shell);

  const markOverflow = () => {
    const more = panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;
    shell.dataset.more = more ? '1' : '0';
  };
  panel.addEventListener('scroll', markOverflow, { passive: true });
  window.addEventListener('resize', markOverflow);
  markOverflow();

  return {
    /** Панель ничего не помнит: каждый кадр её приводят к живому состоянию стенда. */
    update(next: PanelState, optics: VireGlassOptics): void {
      views.setActive(VIEWS.indexOf(next.view));
      zones.setActive(next.zone);
      presets.setActive(next.preset + 1);
      debugRow.setActive(next.debug);
      for (const [key, node] of derivedValues) {
        const v = optics[key as keyof VireGlassOptics];
        node.textContent = typeof v === 'number' ? String(round(v)) : '—';
      }
      for (const [key, row] of rows) {
        const value = next.material[key];
        row.out.textContent = String(round(value));
        // Значение из пресета или сброса надо донести до ползунка; пока его тянут — нет,
        // иначе он дёргается под пальцем.
        if (document.activeElement !== row.input) row.input.value = String(value);
      }
    },
  };
}

const round = (v: number) => Math.round(v * 100) / 100;
