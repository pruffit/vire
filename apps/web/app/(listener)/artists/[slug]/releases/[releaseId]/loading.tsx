function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

function SkTrackRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Sk className="w-5 h-3 shrink-0" />
      <Sk className="flex-1 h-4" />
      <Sk className="w-10 h-3 shrink-0" />
    </div>
  );
}

export default function ReleaseLoading() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-12 space-y-10">
        {/* Back link */}
        <Sk className="h-3.5 w-20" />

        {/* Hero */}
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <Sk className="w-56 h-56 sm:w-[300px] sm:h-[300px] rounded-xl shrink-0 mx-auto sm:mx-0" />
          <div className="space-y-4 pt-1 flex-1">
            <Sk className="h-3.5 w-24" />
            <Sk className="h-11 w-3/4" />
            <Sk className="h-4 w-full max-w-xs" />
            <Sk className="h-4 w-2/3" />
            <Sk className="h-3 w-32" />
            <div className="flex gap-3 pt-2">
              <Sk className="h-9 w-28 rounded-full" />
              <Sk className="h-9 w-9 rounded-full" />
            </div>
          </div>
        </div>

        {/* Track list */}
        <div className="rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-white/5">
          {Array.from({ length: 5 }).map((_, i) => <SkTrackRow key={i} />)}
        </div>
      </div>
    </div>
  );
}
