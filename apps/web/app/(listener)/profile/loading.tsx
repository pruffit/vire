function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-secondary animate-pulse ${className ?? ''}`} />;
}

function SkRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Sk className="w-9 h-9 shrink-0 rounded-sm" />
      <div className="flex-1 space-y-1.5">
        <Sk className="h-4 w-1/2" />
        <Sk className="h-3 w-1/3" />
      </div>
      <Sk className="h-3 w-8 shrink-0" />
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-14">
      {/* Profile card skeleton */}
      <div className="space-y-8">
        <div className="flex items-start gap-5">
          <Sk className="w-[72px] h-[72px] rounded-full shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Sk className="h-6 w-40" />
            <Sk className="h-4 w-52" />
            <Sk className="h-3 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Sk className="h-8 w-20" />
          <div className="w-px h-6 bg-border" />
          <Sk className="h-8 w-20" />
          <div className="w-px h-6 bg-border" />
          <Sk className="h-8 w-24" />
        </div>
        <div className="pt-2 border-t border-border">
          <Sk className="h-4 w-36" />
        </div>
      </div>

      {/* Playlists skeleton */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Sk className="h-5 w-28" />
          <Sk className="h-3 w-6" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Sk className="w-full aspect-square rounded-lg" />
              <Sk className="h-4 w-3/4" />
              <Sk className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* Tracks skeleton */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Sk className="h-5 w-24" />
          <Sk className="h-3 w-6" />
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => <SkRow key={i} />)}
        </div>
      </div>
    </main>
  );
}
