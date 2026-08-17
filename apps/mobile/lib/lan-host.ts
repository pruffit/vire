/**
 * Чистое преобразование `Constants.expoConfig?.hostUri` (вида `192.168.1.5:8081` — адрес,
 * на котором Metro раздаёт бандл телефону) в базовый URL API на том же хосте. Metro и
 * Next dev-сервер обычно поднимаются на одной машине, поэтому LAN-хост Metro почти
 * наверняка совпадает с LAN-хостом веб-дева — это спасает от ручного ввода IP на
 * физическом устройстве, где `localhost` резолвится в сам телефон.
 */
export function baseUrlFromHostUri(
  hostUri: string | undefined,
  port: number,
  fallback: string,
): string {
  if (!hostUri) return fallback;
  const host = hostUri.replace(/^[a-z]+:\/\//i, '').split(':')[0].split('/')[0].trim();
  if (!host) return fallback;
  return `http://${host}:${port}`;
}
