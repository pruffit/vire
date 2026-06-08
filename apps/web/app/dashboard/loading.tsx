function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

function SkRelease() {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2 flex-1">
          <Sk className="h-5 w-48" />
          <Sk className="h-4 w-36" />
        </div>
        <Sk className="w-12 h-12 rounded-md shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="w-5 h-3" />
            <Sk className="h-3 flex-1" />
            <Sk className="w-12 h-3 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="min-h-full bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Sk className="h-8 w-40" />
            <Sk className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-8 w-36 rounded-md" />
            <Sk className="h-8 w-24 rounded-md" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="flex flex-col gap-4">
          <Sk className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <Sk className="h-24 rounded-xl" />
            <Sk className="h-24 rounded-xl" />
          </div>
        </div>

        {/* Releases skeleton */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Sk className="h-6 w-24" />
            <Sk className="h-8 w-24 rounded-md" />
          </div>
          <SkRelease />
          <SkRelease />
        </div>
      </div>
    </div>
  );
}
