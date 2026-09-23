#!/usr/bin/env node
/**
 * Гейт на сохранение структуры (`src/medium/advect-shader.ts` пакета vireuikit): численная
 * диффузия семи-лагранжева переноса размешивает виды пара (три цветных канала r/g/b одного
 * буфера, спека фона «Среда») в равномерную смесь — вся турбулентность, ради которой сетка
 * вообще есть, выцветает в плоский фон. MacCormack + лимитер (`MEDIUM_*_CORRECT_SHADER`) призван
 * это лечить; этот гейт ловит регресс обратно к размытию, откуда бы он ни пришёл.
 *
 * Мера — пространственный контраст поля пара: на каждой ячейке сетки берём среднее абсолютное
 * отклонение трёх видов (r/g/b) от их среднего в этой ячейке (0, когда виды слились в один
 * серый тон), и усредняем это по всей сетке — `window.__vgVaporGrid()` (в обход конденсата,
 * следов и композита, как и у гейта равновесия: композит мешает Oklab-нелинейностью). Другая
 * прочитанная при калибровке мера — пространственный МАД суммарной плотности (r+g+b) по сетке —
 * отброшена: она гаснет к общему полу за первые ~10-15с ОДИНАКОВО что на старой, что на новой
 * схеме (перенормировка суммы воды и конденсация гонят суммарную плотность к пространственно
 * ровному состоянию сами по себе, независимо от качества переноса) и потому не различает схемы.
 *
 * Снимает контраст раз в 5с на протяжении 90с, порог — доля от значения ПОСЛЕ ПРОГРЕВА (первого
 * замера), не абсолютное число: абсолютный уровень контраста зависит от палитры и параметров
 * сева, а деградация схемы — от того, ЧТО ПРОИСХОДИТ С НИМ СО ВРЕМЕНЕМ.
 *
 * Порог откалиброван на скорости `advectSpeed=26` (текущий дефолт `MEDIUM_DEFAULTS`) — гейт
 * обязан ловить регресс СХЕМЫ на скорости, на которой она реально едет, а не на гипотетической.
 * ВАЖНАЯ ОГОВОРКА (см. отчёт при добавлении гейта): на ЭТОЙ скорости за 90с обе схемы уходят в
 * глубоко хаотичный режим — домен 42×92 успевает провернуться под потоком десятки раз, — и
 * старая схема (один бэктрейс) там держит БОЛЬШЕ этой конкретной меры (~48% от старта), чем
 * MacCormack (~26-28%): на такой дистанции путаницы обе кривые меряют скорее шум финального
 * хаотичного состояния, чем скорость диффузии. На вчетверо меньшей скорости (`--advect-speed=`,
 * контрольный прогон) ранжирование ожидаемо переворачивается: MacCormack держит 54%, старая — 44%
 * — там, где накопленный путь умеренный, менее диффузионная схема выигрывает, как и должна.
 * Порог здесь поэтому НЕ «между старой и новой» (на этой скорости между ними нет честного
 * зазора) — он ниже наблюдённого пола новой схемы (~26-28%, три прогона) с запасом: гейт защищает
 * от ГРУБОГО регресса (обвал контраста заметно ниже сегодняшнего), а не выбирает лучшую схему.
 * Пересчитать заново — после того, как скорость покоя/движения снизят отдельным срезом (спека
 * «Спокойное состояние»): на медленном течении зазор между схемами честный и широкий.
 *
 *   node scripts/medium-structure-gate.mjs --real-gpu
 *   node scripts/medium-structure-gate.mjs --real-gpu --advect-speed=6.5   # контрольный прогон
 */
import { chromium } from 'playwright';

const BASE = process.env.RND_BASE ?? 'http://127.0.0.1:3000/rnd';
// Состояние меряется отдельно: у покоя своя скорость течения, и деградация схемы на нём другая.
const PLAYBACK_STATES = ['idle', 'playing', 'paused', 'stopped'];
const VIEWPORT = { width: 360, height: 800 };
const SCALE = 3;
const ZONE = 16;
// Короткий прогрев (не 25с гейта равновесия): equilibrium ждёт выхода конденсации на баланс,
// а тут измеряется сама деградация во времени — старт должен быть БЛИЖЕ к раздаче сева, чтобы
// окно 0-90с застало и раннюю, ещё контрастную, и позднюю картину целиком.
const WARMUP_MS = 900;
const SAMPLE_INTERVAL_MS = 5000;
const TOTAL_SAMPLES = 19; // t=0..90с включительно после прогрева, шаг 5с
const END_OVER_START_LIMIT = 0.18;

function speciesContrast(grid) {
  const { data } = grid;
  const cells = data.length / 3;
  let sum = 0;
  for (let i = 0; i < cells; i += 1) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const mean = (r + g + b) / 3;
    sum += (Math.abs(r - mean) + Math.abs(g - mean) + Math.abs(b - mean)) / 3;
  }
  return sum / cells;
}

async function main() {
  const realGpu = process.argv.includes('--real-gpu');
  const advectSpeedArg = process.argv.find((a) => a.startsWith('--advect-speed='));
  const advectSpeed = advectSpeedArg ? advectSpeedArg.split('=')[1] : null;
  const browser = await chromium.launch({
    headless: !realGpu,
    ...(realGpu ? { channel: 'msedge' } : {}),
    args: realGpu
      ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const playbackArg = process.argv.find((a) => a.startsWith('--playback='))?.split('=')[1];
  const playback = PLAYBACK_STATES.includes(playbackArg ?? '') ? playbackArg : 'playing';
  const speedQuery = advectSpeed ? `&advectSpeed=${advectSpeed}` : '';
  await page.goto(`${BASE}?zone=${ZONE}&glass=0&playback=${playback}&bpm=128&amp=0.6&bench=1&ui=0${speedQuery}`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('[data-testid="rnd-state"]', { timeout: 15000 });
  await page.waitForTimeout(WARMUP_MS);
  if (errors.length) {
    await browser.close();
    throw new Error(`стенд упал: ${errors[0]}`);
  }

  const contrasts = [];
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const grid = await page.evaluate(() => window.__vgVaporGrid());
    if (!grid) throw new Error('__vgVaporGrid вернул null — среда ни разу не рендерилась');
    contrasts.push(speciesContrast(grid));
    if (i < TOTAL_SAMPLES - 1) await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  await browser.close();
  if (errors.length) throw new Error(`стенд упал: ${errors[0]}`);

  const start = contrasts[0];
  const end = contrasts.at(-1);
  const ratio = start > 1e-9 ? end / start : 0;

  console.log(`контраст видов пара (${contrasts.length} замеров по ${SAMPLE_INTERVAL_MS}мс, прогрев ${WARMUP_MS}мс): ${contrasts.map((v) => v.toFixed(4)).join(' ')}`);
  console.log(`после прогрева: ${start.toFixed(4)}, к концу (90с): ${end.toFixed(4)}, конец/старт: ${(ratio * 100).toFixed(1)}%`);
  if (!realGpu) {
    console.log(
      'ПРЕДУПРЕЖДЕНИЕ: снято на SwiftShader (headless без --real-gpu) — для окончательного ' +
        'вердикта прогони с --real-gpu.',
    );
  }
  if (ratio < END_OVER_START_LIMIT) {
    console.error(`ГЕЙТ ПРОВАЛЕН: контраст видов пара упал до ${(ratio * 100).toFixed(1)}% от значения после прогрева < ${(END_OVER_START_LIMIT * 100).toFixed(0)}% — структура выцветает.`);
    process.exitCode = 1;
    return;
  }
  console.log(`ГЕЙТ ПРОЙДЕН: контраст видов пара к концу — ${(ratio * 100).toFixed(1)}% от значения после прогрева ≥ ${(END_OVER_START_LIMIT * 100).toFixed(0)}%.`);
}

await main();
