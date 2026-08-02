// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// motion в jsdom не завершает exit-анимации — рендерим без них, unmount становится синхронным
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition'].includes(k)),
          );
          const Tag = tag as 'div';
          return <Tag {...dom}>{children}</Tag>;
        };
        C.displayName = `motion.${tag}`;
        return C;
      },
    },
  ),
}));

const { enqueueLocalTracksMock } = vi.hoisted(() => ({ enqueueLocalTracksMock: vi.fn() }));
vi.mock('@/lib/player/enqueue-local-files', () => ({ enqueueLocalTracks: enqueueLocalTracksMock }));

const { registerLocalFileMock } = vi.hoisted(() => ({ registerLocalFileMock: vi.fn(() => 'local-1') }));
vi.mock('@/lib/local-files', () => ({ registerLocalFile: registerLocalFileMock }));

import { LocalFileDrop } from './local-file-drop';

function dragInit(files: File[]) {
  return { dataTransfer: { types: ['Files'], files } };
}

const OVERLAY_TEXT = 'Отпустите — добавим в очередь';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LocalFileDrop', () => {
  it('оверлей появляется только во время drag с файлами и гаснет на dragleave', () => {
    render(<LocalFileDrop />);
    expect(screen.queryByText(OVERLAY_TEXT)).toBeNull();

    fireEvent.dragEnter(window, dragInit([new File(['a'], 'song.mp3')]));
    expect(screen.getByText(OVERLAY_TEXT)).not.toBeNull();

    fireEvent.dragLeave(window, dragInit([]));
    expect(screen.queryByText(OVERLAY_TEXT)).toBeNull();
  });

  it('аудиофайл по drop добавляется в очередь', () => {
    render(<LocalFileDrop />);
    const file = new File(['a'], 'song.mp3', { type: 'audio/mpeg' });

    fireEvent.dragEnter(window, dragInit([file]));
    fireEvent.drop(window, dragInit([file]));

    expect(enqueueLocalTracksMock).toHaveBeenCalledTimes(1);
    expect(registerLocalFileMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(OVERLAY_TEXT)).toBeNull();
  });

  it('файл распознаётся по расширению, если type пустой (некоторые ОС не проставляют mime)', () => {
    render(<LocalFileDrop />);
    const file = new File(['a'], 'song.flac', { type: '' });

    fireEvent.dragEnter(window, dragInit([file]));
    fireEvent.drop(window, dragInit([file]));

    expect(enqueueLocalTracksMock).toHaveBeenCalledTimes(1);
  });

  it('чужой файл (не аудио) игнорируется, очередь не трогается', () => {
    render(<LocalFileDrop />);
    const file = new File(['a'], 'document.pdf', { type: 'application/pdf' });

    fireEvent.dragEnter(window, dragInit([file]));
    fireEvent.drop(window, dragInit([file]));

    expect(enqueueLocalTracksMock).not.toHaveBeenCalled();
  });
});
