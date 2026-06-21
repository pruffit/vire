import os from 'node:os';
import { statfs } from 'node:fs/promises';

/**
 * Метрики хоста для админ-панели «Система». Берутся из Node (`os`, `fs.statfs`)
 * — это процесс web-контейнера на VPS. В Docker `os.totalmem/freemem` обычно
 * отражают ХОСТ (а не лимит контейнера), что для выделенного VPS как раз и нужно.
 * Любой сбой деградирует до null — панель не падает.
 */
export interface SystemMetrics {
  memTotalMb: number;
  memUsedMb: number;
  memUsedPct: number;
  processRssMb: number;
  loadAvg1: number;
  cores: number;
  loadPct: number;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  diskUsedPct: number | null;
  uptimeSec: number;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const cores = os.cpus().length || 1;
  const load1 = os.loadavg()[0] ?? 0;

  let diskTotalGb: number | null = null;
  let diskFreeGb: number | null = null;
  let diskUsedPct: number | null = null;
  try {
    const s = await statfs('/');
    const totalB = s.blocks * s.bsize;
    const freeB = s.bavail * s.bsize;
    if (totalB > 0) {
      diskTotalGb = Math.round((totalB / 1e9) * 10) / 10;
      diskFreeGb = Math.round((freeB / 1e9) * 10) / 10;
      diskUsedPct = Math.round((1 - freeB / totalB) * 100);
    }
  } catch {
    // statfs недоступен (старый Node / песочница) — диск null.
  }

  return {
    memTotalMb: Math.round(total / 1048576),
    memUsedMb: Math.round(used / 1048576),
    memUsedPct: total > 0 ? Math.round((used / total) * 100) : 0,
    processRssMb: Math.round(process.memoryUsage().rss / 1048576),
    loadAvg1: Math.round(load1 * 100) / 100,
    cores,
    loadPct: Math.round((load1 / cores) * 100),
    diskTotalGb,
    diskFreeGb,
    diskUsedPct,
    uptimeSec: Math.round(os.uptime()),
  };
}
