/**
 * Можно ли реально управлять громкостью из JS. На iOS `HTMLMediaElement.volume`
 * только для чтения: присваивание игнорируется, звук рулят хардварные кнопки.
 * Поэтому ползунок громкости там бессмысленен (двигался бы вхолостую) и его прячут.
 *
 * Фича-детект, а НЕ UA-сниффинг (был `detectIOS` по строке userAgent): ловит iOS
 * в ЛЮБОМ браузере — Safari, Chrome, Yandex, in-app WKWebView. Все они на WebKit
 * с тем же ограничением, но UA у webview'ов может не содержать `iPhone`/`iPad`
 * (кастомный applicationName) и обманывать проверку по строке — из-за этого
 * ползунок вылезал в части iOS-браузеров. Проверка поведения от UA не зависит.
 *
 * Результат кэшируется: для сессии он не меняется, а getSnapshot
 * useSyncExternalStore должен возвращать стабильное значение.
 */
let cached: boolean | undefined;

export function canControlVolume(): boolean {
  if (cached !== undefined) return cached;
  // SSR: document нет — по умолчанию показываем, на клиенте перепроверим.
  if (typeof document === 'undefined') return true;
  try {
    const probe = document.createElement('audio');
    probe.volume = 0.5; // на iOS присваивание игнорируется → останется 1
    cached = probe.volume === 0.5;
  } catch {
    cached = false;
  }
  return cached;
}
