import { describe, it, expect } from 'vitest';
import { baseUrlFromHostUri } from '../lan-host';

describe('baseUrlFromHostUri', () => {
  it('строит http-URL из host:port на порту сервера', () => {
    expect(baseUrlFromHostUri('192.168.1.5:8081', 3000, 'http://localhost:3000')).toBe(
      'http://192.168.1.5:3000',
    );
  });

  it('hostUri отсутствует (expo start --web) — фолбэк', () => {
    expect(baseUrlFromHostUri(undefined, 3000, 'http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
  });

  it('пустая строка — фолбэк', () => {
    expect(baseUrlFromHostUri('', 3000, 'http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('отбрасывает схему, если она вдруг есть', () => {
    expect(baseUrlFromHostUri('exp://192.168.1.5:8081', 3000, 'http://localhost:3000')).toBe(
      'http://192.168.1.5:3000',
    );
  });

  it('отбрасывает путь после хоста, если он есть', () => {
    expect(baseUrlFromHostUri('192.168.1.5:8081/--/client', 3000, 'http://localhost:3000')).toBe(
      'http://192.168.1.5:3000',
    );
  });

  it('hostname без порта — берёт как есть', () => {
    expect(baseUrlFromHostUri('192.168.1.5', 3000, 'http://localhost:3000')).toBe(
      'http://192.168.1.5:3000',
    );
  });
});
