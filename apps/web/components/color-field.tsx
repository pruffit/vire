'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

/**
 * Color picker — замена нативному `<input type=color>` (попап светлый, мимо темы).
 * SV-квадрат + hue-слайдер + hex; `value`/`onChange` — hex `#rrggbb`, `name` —
 * скрытый input для сабмита формы через FormData.
 */

interface Props {
  label: string;
  name: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}

// ─── Конверсии ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

// ─── Компонент ─────────────────────────────────────────────────────────────

export function ColorField({ label, name, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // HSV держим локально (иначе на сером/чёрном теряется hue — hex его не хранит).
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });

  // Hex, соответствующий текущему hsv (чистая функция — можно в рендере).
  const hsvRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hsvHex = rgbToHex(hsvRgb.r, hsvRgb.g, hsvRgb.b);

  // синхронизация при внешнем изменении value (пресеты); сравнение с hsvHex не теряет hue,
  // который мы сами и отдали; setState в фазе рендера для подгонки под пропсы React поддерживает
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value.toLowerCase() !== hsvHex.toLowerCase()) {
      const rgb = hexToRgb(value);
      if (rgb) setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function emit(next: { h: number; s: number; v: number }) {
    setHsv(next);
    const { r, g, b } = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(r, g, b));
  }

  function dragSV(e: React.PointerEvent) {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const move = (cx: number, cy: number) => {
      const s = clamp01((cx - rect.left) / rect.width);
      const v = clamp01(1 - (cy - rect.top) / rect.height);
      emit({ h: hsv.h, s, v });
    };
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function dragHue(e: React.PointerEvent) {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const move = (cx: number) => {
      const h = clamp01((cx - rect.left) / rect.width) * 360;
      emit({ h, s: hsv.s, v: hsv.v });
    };
    move(e.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onHexInput(raw: string) {
    let v = raw.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    onChange(v);
    const rgb = hexToRgb(v);
    if (rgb) setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
  }

  const hueRgb = hsvToRgb(hsv.h, 1, 1);
  const hueColor = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b);
  const valid = hexToRgb(value);

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      <span className="text-sm font-medium">{label}</span>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-label={`${label}: выбрать цвет`}
          className="h-8 w-8 shrink-0 rounded border border-foreground/15 disabled:opacity-50"
          style={{ backgroundColor: valid ? value : 'transparent' }}
        />
        <input
          type="text"
          value={value}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => onHexInput(e.target.value)}
          placeholder="#000000"
          className="w-24 rounded-md bg-foreground/5 border border-foreground/10 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        {name && <input type="hidden" name={name} value={value} />}

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring.snappy}
              className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-foreground/15 bg-background p-3 shadow-xl shadow-black/40"
            >
              {/* SV-квадрат */}
              <div
                ref={svRef}
                onPointerDown={dragSV}
                className="relative h-32 w-full cursor-crosshair rounded-md touch-none"
                style={{
                  backgroundColor: hueColor,
                  backgroundImage:
                    'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
                }}
              >
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
                />
              </div>

              {/* Hue-слайдер */}
              <div
                ref={hueRef}
                onPointerDown={dragHue}
                className="relative mt-3 h-3 w-full cursor-pointer rounded-full touch-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
