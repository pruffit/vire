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
  loadAvg5: number;
  loadAvg15: number;
  cores: number;
  loadPct: number;
  /** Мгновенная загрузка CPU (%) — замер delta /proc/stat за короткий интервал. */
  cpuPct: number;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  diskUsedPct: number | null;
  uptimeSec: number;
}

/** Суммарные idle/total тики по всем ядрам (для мгновенного CPU). */
function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

/** Текущая загрузка CPU за короткий интервал (по умолчанию 150мс). */
async function currentCpuPct(ms = 150): Promise<number> {
  const a = cpuTimes();
  await new Promise((r) => setTimeout(r, ms));
  const b = cpuTimes();
  const dTotal = b.total - a.total;
  const dIdle = b.idle - a.idle;
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const cores = os.cpus().length || 1;
  const [load1, load5, load15] = os.loadavg();
  const cpuPct = await currentCpuPct();

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
    loadAvg1: Math.round((load1 ?? 0) * 100) / 100,
    loadAvg5: Math.round((load5 ?? 0) * 100) / 100,
    loadAvg15: Math.round((load15 ?? 0) * 100) / 100,
    cores,
    loadPct: Math.round(((load1 ?? 0) / cores) * 100),
    cpuPct,
    diskTotalGb,
    diskFreeGb,
    diskUsedPct,
    uptimeSec: Math.round(os.uptime()),
  };
}
