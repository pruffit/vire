// Разбивка длительности джоба по этапам. Нужна, чтобы решать по замеру, а не по
// догадке: доля чистого JS-DSP (BPM/тональность) против нативных ffmpeg и ONNX
// определяет, оправдан ли нативный модуль (docs/architecture/audit-2026-08.md §6).

export interface StageTimer {
  /** Выполняет этап, замеряя его длительность. Ошибку не глотает — время пишется и при падении. */
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** `download=1200ms analyze=8400ms` в порядке выполнения. */
  summary(): string;
  totalMs(): number;
}

export function createStageTimer(now: () => number = () => performance.now()): StageTimer {
  const stages: Array<[string, number]> = [];

  return {
    async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const started = now();
      try {
        return await fn();
      } finally {
        stages.push([name, Math.round(now() - started)]);
      }
    },
    summary() {
      return stages.map(([name, ms]) => `${name}=${ms}ms`).join(' ');
    },
    totalMs() {
      return stages.reduce((sum, [, ms]) => sum + ms, 0);
    },
  };
}

/** Длительность джоба целиком по отметкам BullMQ. `null`, если джоб не успел их проставить. */
export function jobDurationMs(job: { processedOn?: number | null; finishedOn?: number | null } | undefined): number | null {
  if (!job?.processedOn || !job.finishedOn) return null;
  return job.finishedOn - job.processedOn;
}
