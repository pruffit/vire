// Отклик детали на палец — ЧАСТЬ МАТЕРИАЛА, а не приложения: пружины здесь описывают, какова
// среда на ощупь, ровно так же, как ior описывает, какова она на просвет. Держать их у
// потребителя значит получить на вебе и на Android два разных стекла с одним именем.
//
// Деформируется ПОЛЕ вокруг точки касания (vgTouchWarp в sdf.ts),
// поэтому здесь считаются четыре величины: где тронули, куда тянут, насколько вдавили и
// какая сейчас волна.
//
// Ключевое: тяга привязана к ПЯТНУ касания. Тянешь правый край — уходит правый край, левый
// стоит; палец при этом имеет площадь, а не остриё — плато внутри `vgTouchWarp`.
// Масштабировать габарит формы нельзя: тогда тяга вправо раздувает и левую сторону, чего
// у жидкости не бывает.
//
//   НАЖАТИЕ вязкое: вдавливается неглубоко и отпускает медленно.
//   ТЯГА густая: тело заметно отстаёт от пальца, ход короткий, на отпускании возвращается
//   быстро и почти без отскока. Размашистый перелёт — это жидкое желе, а не густое стекло.
//   ВОЛНА: касание и отрыв бросают короткое кольцо, которое гаснет за четверть секунды.

export type DeformSample = {
  /** Точка касания относительно центра детали, CSS-пиксели. */
  touchX: number;
  touchY: number;
  pullX: number;
  pullY: number;
  press: number;
  active: number;
  /** Амплитуда волны в CSS-пикселях и её фаза в оборотах. */
  waveAmp: number;
  wavePhase: number;
};

const HOLD_STIFFNESS = 260;
const HOLD_DAMPING = 46;
/** Возврат жёстче удержания, но демпфирование высокое: плотная среда возвращается быстро и
 *  почти без отскока. Заметный перелёт — это про жидкое желе, а не про густое стекло. */
const RELEASE_STIFFNESS = 420;
const RELEASE_DAMPING = 34;

const PRESS_ATTACK = 0.07;
const PRESS_RELEASE = 0.16;

/** Волна короткая и слабая: в вязкой среде рябь гаснет за четверть секунды, а не качается. */
const WAVE_DECAY = 0.22;
const WAVE_TURNS_PER_SECOND = 3.0;

export function createDeform() {
  let touchX = 0;
  let touchY = 0;
  let targetTouchX = 0;
  let targetTouchY = 0;
  let pullX = 0;
  let pullY = 0;
  let vx = 0;
  let vy = 0;
  let targetX = 0;
  let targetY = 0;
  let held = false;
  let press = 0;
  let active = 0;
  let waveAmp = 0;
  let wavePhase = 0;

  /** `x`, `y` — точка касания относительно центра детали, CSS-пиксели. */
  function grab(x: number, y: number, waveStart: number): void {
    // Покой проверяется ДО захвата: idle() смотрит на !held, и после `held = true` он всегда
    // ложь — точка тогда переезжала бы даже при первом касании по спокойной детали.
    const atRest = idle();
    held = true;
    targetTouchX = x;
    targetTouchY = y;
    // По спокойной детали палец ставится сразу; если она ещё не успокоилась после прошлого
    // касания — точка переезжает за пару кадров. Мгновенный перенос рвёт деформацию, и при
    // частых нажатиях это читается как дёрганье.
    if (atRest) {
      touchX = x;
      touchY = y;
    }
    targetX = 0;
    targetY = 0;
    // Импульсы СКЛАДЫВАЮТСЯ, а не перезапускаются, и фаза не сбрасывается: сброс обрывает
    // идущую волну на середине периода, что и даёт рывок при частых кликах.
    waveAmp = Math.min(waveAmp + waveStart, waveStart * 1.6);
  }

  function drag(dx: number, dy: number, limit: number): void {
    if (!held) return;
    const len = Math.hypot(dx, dy);
    // Ход насыщается, а не обрезается: у предела палец продолжает идти, а поле почти нет —
    // так ведёт себя густая жидкость, упёршаяся в свой предел.
    const scale = len > 1e-3 ? (limit * Math.tanh(len / limit)) / len : 0;
    targetX = dx * scale;
    targetY = dy * scale;
  }

  /** Отрыв пальца бросает вторую волну — послабее той, что от касания. */
  function release(waveStart: number): void {
    held = false;
    targetX = 0;
    targetY = 0;
    waveAmp = Math.min(waveAmp + waveStart, waveStart * 2);
  }

  function integrate(dt: number): void {
    const k = held ? HOLD_STIFFNESS : RELEASE_STIFFNESS;
    const c = held ? HOLD_DAMPING : RELEASE_DAMPING;
    vx += (k * (targetX - pullX) - c * vx) * dt;
    vy += (k * (targetY - pullY) - c * vy) * dt;
    pullX += vx * dt;
    pullY += vy * dt;

    const pressTarget = held ? 1 : 0;
    const tau = held ? PRESS_ATTACK : PRESS_RELEASE;
    press += (pressTarget - press) * (1 - Math.exp(-dt / tau));
    active += (pressTarget - active) * (1 - Math.exp(-dt / 0.09));

    // Точка касания догоняет палец быстро, но не мгновенно — см. grab().
    const follow = 1 - Math.exp(-dt / 0.045);
    touchX += (targetTouchX - touchX) * follow;
    touchY += (targetTouchY - touchY) * follow;

    wavePhase += dt * WAVE_TURNS_PER_SECOND;
    waveAmp *= Math.exp(-dt / WAVE_DECAY);
    if (waveAmp < 0.01) waveAmp = 0;
  }

  /**
   * Шаг фиксирован, а кадр — нет: на софтверном рендерере кадров бывает десяток в секунду,
   * и если интегрировать «сколько прошло», отклик идёт медленнее реального времени (пружина
   * при большом шаге ещё и расходится). Поэтому время добирается подшагами.
   */
  function step(dt: number): void {
    let rest = Math.min(Math.max(dt, 0), 0.25);
    const h = 1 / 120;
    while (rest > 1e-6) {
      const slice = Math.min(h, rest);
      integrate(slice);
      rest -= slice;
    }
    // Успокоилась — значит ровно в покое. Порог `idle()` останавливает рендер, но сами
    // величины к нулю асимптотичны, и деталь навсегда оставалась чуть деформированной:
    // на глаз незаметно, а сравнение кадров с эталоном ловит расхождение вечно.
    if (idle()) {
      pullX = 0;
      pullY = 0;
      vx = 0;
      vy = 0;
      press = 0;
      active = 0;
      wavePhase = 0;
    }
  }

  /** Успокоилась ли деталь — по этому стенд решает, продолжать ли рисовать кадры. */
  function idle(): boolean {
    return (
      !held &&
      Math.abs(pullX) < 0.05 &&
      Math.abs(pullY) < 0.05 &&
      Math.hypot(vx, vy) < 0.5 &&
      press < 0.004 &&
      active < 0.004 &&
      waveAmp === 0
    );
  }

  function sample(): DeformSample {
    return { touchX, touchY, pullX, pullY, press, active, waveAmp, wavePhase };
  }

  return { grab, drag, release, step, idle, sample };
}
