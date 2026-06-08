function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
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
      <div className="space-y-2">
        <Sk className="h-7 w-40" />
        <Sk className="h-4 w-56" />
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Sk className="h-5 w-28" />
          <Sk className="h-3 w-6" />
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => <SkRow key={i} />)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Sk className="h-5 w-24" />
          <Sk className="h-3 w-6" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 text-center">
              <Sk className="w-full aspect-square rounded-full" />
              <Sk className="h-3 w-3/4 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
