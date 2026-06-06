import { getAdminStats } from '@vire/db';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider font-mono">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value.toLocaleString('ru-RU')}</span>
      {sub && <span className="text-xs text-white/30">{sub}</span>}
    </div>
  );
}

export default async function AdminPage() {
  const stats = await getAdminStats();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Обзор</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono text-white/40 uppercase tracking-wider">Аудитория</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Пользователей" value={stats.totalUsers} />
          <StatCard label="Артистов" value={stats.totalArtists} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono text-white/40 uppercase tracking-wider">Контент</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Релизов" value={stats.totalReleases} />
          <StatCard label="Треков" value={stats.totalTracks} />
          <StatCard label="Обрабатывается" value={stats.tracksProcessing} sub="треков" />
          <StatCard label="Заблокировано" value={stats.tracksBlocked} sub="треков" />
        </div>
      </section>
    </div>
  );
}
