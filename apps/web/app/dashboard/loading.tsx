function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-foreground/[0.06] animate-pulse ${className ?? ''}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Sk className="h-8 w-40" />
          <Sk className="h-4 w-56" />
        </div>
        <Sk className="h-9 w-36 rounded-md" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>

      {/* Releases grid */}
      <div className="flex flex-col gap-4">
        <Sk className="h-4 w-24" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-4">
        <Sk className="h-4 w-28" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Sk className="h-44 rounded-xl" />
          <Sk className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
