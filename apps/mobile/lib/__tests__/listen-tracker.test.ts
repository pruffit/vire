import { describe, it, expect } from 'vitest';
import { ListenTracker } from '../playback/listen-tracker';

const T0 = Date.parse('2026-08-29T12:00:00.000Z');
const sec = (n: number) => T0 + n * 1000;

describe('ListenTracker', () => {
  it('считает только реально проигранное время', () => {
    const t = new ListenTracker();
    t.start('track-1', 'release', T0);
    t.resume(T0);

    const span = t.finish(sec(42));

    expect(span).toMatchObject({ trackId: 'track-1', source: 'release', durationPlayedSec: 42 });
    expect(span!.startedAt).toBe('2026-08-29T12:00:00.000Z');
  });

  // Главный инвариант: пауза не идёт в зачёт. Завышенная длительность искажает качество
  // дослушивания, по которому Волна ранжирует треки для ВСЕЙ платформы.
  it('пауза НЕ засчитывается', () => {
    const t = new ListenTracker();
    t.start('track-1', 'home', T0);
    t.resume(T0);
    t.pause(sec(10));
    t.resume(sec(70)); // минуту простояли на паузе
    const span = t.finish(sec(80));

    expect(span!.durationPlayedSec).toBe(20);
  });

  it('несколько пауз подряд складываются корректно', () => {
    const t = new ListenTracker();
    t.start('t', 'playlist', T0);
    t.resume(T0);
    t.pause(sec(5));
    t.resume(sec(10));
    t.pause(sec(15));
    t.resume(sec(30));
    const span = t.finish(sec(35));

    expect(span!.durationPlayedSec).toBe(15);
  });

  it('повторный resume без паузы не удваивает счёт', () => {
    const t = new ListenTracker();
    t.start('t', 'search', T0);
    t.resume(T0);
    t.resume(sec(5));
    t.resume(sec(8));

    expect(t.finish(sec(10))!.durationPlayedSec).toBe(10);
  });

  it('повторная пауза без resume ничего не добавляет', () => {
    const t = new ListenTracker();
    t.start('t', 'search', T0);
    t.resume(T0);
    t.pause(sec(10));
    t.pause(sec(20));

    expect(t.finish(sec(30))!.durationPlayedSec).toBe(10);
  });

  // Перелистывание — не прослушивание.
  it('меньше секунды — события нет', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);

    expect(t.finish(T0 + 400)).toBeNull();
  });

  it('трек, который так и не заиграл, события не даёт', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);

    expect(t.finish(sec(60))).toBeNull();
  });

  it('finish без start — null, а не исключение', () => {
    expect(new ListenTracker().finish(T0)).toBeNull();
  });

  it('после finish учёт закрыт', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);
    t.finish(sec(5));

    expect(t.currentTrackId).toBeNull();
    expect(t.finish(sec(10))).toBeNull();
  });

  it('новый start начинает счёт с нуля', () => {
    const t = new ListenTracker();
    t.start('a', 'home', T0);
    t.resume(T0);
    t.finish(sec(30));

    t.start('b', 'artist', sec(30));
    t.resume(sec(30));

    expect(t.finish(sec(45))).toMatchObject({ trackId: 'b', source: 'artist', durationPlayedSec: 15 });
  });

  // Уход в фон: отчитаться надо, но трек не закончился и продолжает играть.
  it('snapshot отдаёт накопленное и НЕ закрывает учёт', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);

    const partial = t.snapshot(sec(20));

    expect(partial!.durationPlayedSec).toBe(20);
    expect(t.currentTrackId).toBe('t');
  });

  // Иначе следующий флаш посчитал бы то же время второй раз и завысил бы дослушивание.
  it('snapshot обнуляет счётчик — двойного учёта нет', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);
    t.snapshot(sec(20));

    expect(t.finish(sec(30))!.durationPlayedSec).toBe(10);
  });

  it('после snapshot воспроизведение продолжает считаться', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);
    t.snapshot(sec(10));
    t.pause(sec(25));

    expect(t.finish(sec(40))!.durationPlayedSec).toBe(15);
  });

  it('snapshot на паузе не возобновляет учёт', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);
    t.pause(sec(10));
    t.snapshot(sec(20));

    expect(t.finish(sec(60))).toBeNull();
  });

  it('два snapshot подряд без прослушивания — второй пустой', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);
    expect(t.snapshot(sec(5))!.durationPlayedSec).toBe(5);
    expect(t.snapshot(sec(5))).toBeNull();
  });

  it('snapshot без учёта — null', () => {
    expect(new ListenTracker().snapshot(T0)).toBeNull();
  });

  it('время округляется вниз — не завышаем', () => {
    const t = new ListenTracker();
    t.start('t', 'home', T0);
    t.resume(T0);

    expect(t.finish(T0 + 9999)!.durationPlayedSec).toBe(9);
  });
});
