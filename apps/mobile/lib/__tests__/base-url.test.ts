import { describe, it, expect } from 'vitest';
import { resolveBaseUrl } from '../base-url';

describe('resolveBaseUrl', () => {
  it('явный EXPO_PUBLIC_* побеждает всё остальное в обоих режимах', () => {
    const explicit = 'http://192.168.1.42:3000';
    expect(resolveBaseUrl({ explicit, isDev: true, hostUri: '10.0.0.1:8081', production: 'https://viremusic.ru' })).toBe(explicit);
    expect(resolveBaseUrl({ explicit, isDev: false, production: 'https://viremusic.ru' })).toBe(explicit);
  });

  it('пустой и пробельный explicit игнорируется', () => {
    expect(resolveBaseUrl({ explicit: '', isDev: false, production: 'https://viremusic.ru' })).toBe('https://viremusic.ru');
    expect(resolveBaseUrl({ explicit: '   ', isDev: false, production: 'https://viremusic.ru' })).toBe('https://viremusic.ru');
  });

  it('в dev выводит LAN-хост Metro на порту API', () => {
    expect(resolveBaseUrl({ isDev: true, hostUri: '192.168.1.5:8081', production: 'https://viremusic.ru' })).toBe(
      'http://192.168.1.5:3000',
    );
  });

  it('в dev без hostUri падает на localhost', () => {
    expect(resolveBaseUrl({ isDev: true, production: 'https://viremusic.ru' })).toBe('http://localhost:3000');
  });

  // Ради этого теста существует модуль: до P0 release-сборка получала localhost из .env,
  // а release-манифест блокирует cleartext — приложение не доходило до бэкенда вообще.
  it('в release НИКОГДА не отдаёт localhost или LAN, даже когда hostUri есть', () => {
    const url = resolveBaseUrl({ isDev: false, hostUri: '192.168.1.5:8081', production: 'https://viremusic.ru' });
    expect(url).toBe('https://viremusic.ru');
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('192.168');
  });

  it('срезает хвостовой слэш — вызывающий код клеит путь через `${base}/api/v1/...`', () => {
    expect(resolveBaseUrl({ isDev: false, production: 'https://viremusic.ru/' })).toBe('https://viremusic.ru');
    expect(resolveBaseUrl({ explicit: 'http://127.0.0.1:3000/', isDev: true })).toBe('http://127.0.0.1:3000');
  });

  // Тихий фолбэк — ровно тот механизм, которым в проект и заехал localhost. Ошибка
  // конфигурации обязана быть громкой; от неё же страхуют preflight и тест app.json ниже.
  it('в release без сконфигурированного URL бросает, а не подставляет догадку', () => {
    expect(() => resolveBaseUrl({ isDev: false })).toThrow(/базовый URL/i);
    expect(() => resolveBaseUrl({ isDev: false, production: '  ' })).toThrow(/базовый URL/i);
  });
});
