import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { WORKER_LOCK_MS } from './worker-options.js';

const dir = new URL('../workers/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.worker.ts'));

// Инцидент 06.09: очереди с дефолтным 30с-локом теряли лок, пока соседний воркер
// того же процесса блокировал event loop. Общий lockDuration защищает только пока
// его берут все — отсюда инвариант.
describe('опции воркеров', () => {
  it('находит файлы воркеров', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('WORKER_LOCK_MS заметно выше дефолтных 30с bullmq', () => {
    expect(WORKER_LOCK_MS).toBeGreaterThanOrEqual(60_000);
  });

  it.each(files)('%s строит Worker из baseWorkerOptions', (file) => {
    const src = readFileSync(new URL(file, dir), 'utf8');
    const blocks = src.split('new Worker').slice(1);

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.slice(0, block.indexOf('});') + 1)).toContain('...baseWorkerOptions');
    }
  });
});
