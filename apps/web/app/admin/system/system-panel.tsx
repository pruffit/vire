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

  // Поллинг живого снимка.
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
      } catch { /* оставляем прошлые данные */ }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // Счётчик «обновлено N с назад».
  useEffect(() => {
    const t = setInterval(() => setAge(Math.round((Date.now() - lastTs.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const { system: s, health: h, siteOnline } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Система</h1>
        <span className="flex items-center gap-2 text-xs text-white/40 font-mono">
          <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
          обновлено {age}с назад
        </span>
      </div>

      {/* Живые счётчики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Онлайн на сайте" value={siteOnline} accent />
        <Stat label="Слушают сейчас" value={h.liveListeners} />
        <Stat label="Аптайм хоста" value={formatUptime(s.uptimeSec)} small />
        <Stat label="Ядра CPU" value={s.cores} />
      </div>

      {/* Нагрузка ресурсов */}
      <div className="rounded-xl border border-white/10 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-white/40">Нагрузка</h2>
        <Bar
          label="ОЗУ"
          pct={s.memUsedPct}
          detail={`${fmtMb(s.memUsedMb)} / ${fmtMb(s.memTotalMb)} · процесс web ${fmtMb(s.processRssMb)}`}
        />
        <Bar
          label="CPU"
          pct={s.loadPct}
          detail={`load avg ${s.loadAvg1} на ${s.cores} ядр.`}
        />
        {s.diskUsedPct != null ? (
          <Bar
            label="Диск"
            pct={s.diskUsedPct}
            detail={`свободно ${s.diskFreeGb} ГБ из ${s.diskTotalGb} ГБ`}
          />
        ) : (
          <p className="text-xs text-white/30">Диск: метрика недоступна</p>
        )}
      </div>

      {/* Сервисы и очереди */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40">Сервисы</h2>
          <Latency label="PostgreSQL" ms={h.dbLatencyMs} />
          <Latency label="Redis" ms={h.redisLatencyMs} />
        </div>
        <div className="rounded-xl border border-white/10 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40">Очереди</h2>
          {h.queues.map((q) => (
            <div key={q.name} className="flex items-center justify-between text-sm">
              <span className="text-white/70">{q.label}</span>
              <span className="font-mono text-xs tabular-nums flex gap-3">
                <span className="text-white/50" title="ожидают">{q.waiting} ⏳</span>
                <span className="text-white/50" title="в работе">{q.active} ⚙</span>
                <span className={q.failed > 0 ? 'text-red-400' : 'text-white/30'} title="упали">{q.failed} ✕</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-white/30 leading-relaxed">
        Метрики — с web-контейнера на VPS (в Docker память отражает хост). Точную
        ёмкость «сколько онлайна держит» даст нагрузочный тест (§9.5 дорожной карты).
      </p>
    </div>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string | number; accent?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-primary/40 bg-primary/5' : 'border-white/10'}`}>
      <div className={`tabular-nums font-semibold ${small ? 'text-lg' : 'text-3xl'} ${accent ? 'text-primary' : 'text-white'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-white/40">{label}</div>
    </div>
  );
}

function Bar({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 70 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-mono text-xs tabular-nums text-white/50">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[11px] text-white/30 font-mono">{detail}</span>
    </div>
  );
}

function Latency({ label, ms }: { label: string; ms: number | null }) {
  const ok = ms != null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/70">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${ok ? (ms <= 50 ? 'text-green-400' : 'text-yellow-400') : 'text-red-400'}`}>
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
