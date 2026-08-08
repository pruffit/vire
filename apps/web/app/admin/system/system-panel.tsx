'use client';

import { useEffect, useRef, useState } from 'react';
import type { SystemMetrics } from '@/lib/system-metrics';
import type { AdminHealth } from '@/lib/admin-health';

export interface SystemData {
  system: SystemMetrics;
  health: AdminHealth;
  siteOnline: number;
}

const POLL_MS = 4000;

export function SystemPanel({ initial }: { initial: SystemData }) {
  const [data, setData] = useState<SystemData>(initial);
  const [age, setAge] = useState(0);
  // Отметку «когда обновлено» ведём по часам клиента (Date.now в рендере нельзя).
  const lastTs = useRef(0);

  useEffect(() => {
    lastTs.current = Date.now(); // серверный снимок отрисован примерно сейчас
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/admin/system', { cache: 'no-store' });
        if (!stopped && res.ok) {
          const d = (await res.json()) as SystemData;
          setData(d);
          lastTs.current = Date.now();
        }
      } catch { /* keep */ }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAge(Math.round((Date.now() - lastTs.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const { system: s, health: h, siteOnline } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Система</h1>
        <span className="flex items-center gap-2 text-xs text-foreground/45 font-mono">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          обновлено {age}с назад
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Онлайн на сайте" value={siteOnline} accent />
        <Stat label="Слушают сейчас" value={h.liveListeners} />
        <Stat label="Аптайм хоста" value={formatUptime(s.uptimeSec)} small />
        <Stat label="Ядра CPU" value={s.cores} />
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-5 flex flex-col gap-4">
        <Subhead>Нагрузка</Subhead>
        <Bar
          label="ОЗУ"
          pct={s.memUsedPct}
          detail={`${fmtMb(s.memUsedMb)} / ${fmtMb(s.memTotalMb)} · процесс web ${fmtMb(s.processRssMb)}`}
        />
        <Bar
          label="CPU"
          pct={s.cpuPct}
          detail={`текущая · load avg ${s.loadAvg1} / ${s.loadAvg5} / ${s.loadAvg15} (1/5/15 мин) на ${s.cores} ядр.`}
        />
        {s.diskUsedPct != null ? (
          <Bar
            label="Диск"
            pct={s.diskUsedPct}
            detail={`свободно ${s.diskFreeGb} ГБ из ${s.diskTotalGb} ГБ`}
          />
        ) : (
          <p className="text-xs text-foreground/30">Диск: метрика недоступна</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-5 flex flex-col gap-3">
          <Subhead>Сервисы</Subhead>
          <Latency label="PostgreSQL" ms={h.dbLatencyMs} />
          <Latency label="Redis" ms={h.redisLatencyMs} />
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-5 flex flex-col gap-3">
          <Subhead>Очереди</Subhead>
          {h.queues.map((q) => (
            <div key={q.name} className="flex items-center justify-between text-sm">
              <span className="text-foreground/70">{q.label}</span>
              <span className="font-mono text-xs tabular-nums flex gap-3">
                <span className="text-foreground/50" title="ожидают">{q.waiting} ⏳</span>
                <span className="text-foreground/50" title="в работе">{q.active} ⚙</span>
                <span className={q.failed > 0 ? 'text-red-400' : 'text-foreground/30'} title="упали">{q.failed} ✕</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-foreground/35 leading-relaxed max-w-prose">
        Метрики — с web-контейнера на VPS (в Docker память отражает хост). Точную
        ёмкость «сколько онлайна держит» даст нагрузочный тест (§9.5 дорожной карты).
      </p>
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="label-mono text-foreground/40">{children}</h2>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string | number; accent?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-primary/40 bg-primary/5' : 'border-foreground/10 bg-foreground/[0.03]'}`}>
      <div className={`tabular-nums font-semibold leading-none ${small ? 'text-lg' : 'text-3xl'} ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-foreground/45">{label}</div>
    </div>
  );
}

function Bar({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground/70">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground/50">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[11px] text-foreground/30 font-mono">{detail}</span>
    </div>
  );
}

function Latency({ label, ms }: { label: string; ms: number | null }) {
  const ok = ms != null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground/70">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${ok ? (ms <= 50 ? 'text-emerald-400' : 'text-amber-400') : 'text-red-400'}`}>
        {ok ? `${ms} мс` : 'недоступен'}
      </span>
    </div>
  );
}

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} ГБ` : `${mb} МБ`;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}д ${hrs}ч`;
  if (hrs > 0) return `${hrs}ч ${m}м`;
  return `${m}м`;
}
