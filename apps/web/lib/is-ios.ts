/**
 * iOS-детект (клиент). На iOS `HTMLMediaElement.volume` доступен только для
 * чтения — присваивание игнорируется, громкостью рулят только хардварные кнопки.
 * Поэтому ползунок громкости там бессмысленен (двигается, но звук не меняется) и
 * его прячут. iPadOS 13+ маскируется под Mac — ловим по тач-поинтам.
 */
export function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}
