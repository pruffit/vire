// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerLocalFile, getLocalFile, hasFileSystemAccess } from './local-files';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local-files registry', () => {
  it('registerLocalFile сохраняет файл и возвращает читаемый id', () => {
    const file = new File(['a'], 'track.mp3');
    const id = registerLocalFile(file);

    expect(id).toMatch(/^local-/);
    expect(getLocalFile(id)).toBe(file);
  });

  it('getLocalFile для неизвестного id — null, без throw', () => {
    expect(getLocalFile('unknown-id')).toBeNull();
  });

  it('registerLocalFile с явным id перезаписывает запись — восстановленный хэндл не плодит дубль', () => {
    const first = new File(['a'], 'track.mp3');
    const second = new File(['b'], 'track.mp3');
    const id = registerLocalFile(first, 'local-fixed');
    registerLocalFile(second, 'local-fixed');

    expect(id).toBe('local-fixed');
    expect(getLocalFile('local-fixed')).toBe(second);
  });

  it('hasFileSystemAccess отражает наличие showOpenFilePicker в window', () => {
    expect(hasFileSystemAccess()).toBe(false);

    (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = vi.fn();
    expect(hasFileSystemAccess()).toBe(true);
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
});
