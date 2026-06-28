function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

export default function TrackLoading() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14 space-y-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-2 w-2 rounded-full" />
          <Sk className="h-3 w-24" />
        </div>

        {/* Track header */}
        <div className="flex flex-col sm:flex-row gap-7 sm:gap-9 items-start sm:items-end">
          <Sk className="w-44 h-44 sm:w-56 sm:h-56 rounded-xl shrink-0" />
          <div className="space-y-4 flex-1">
            <Sk className="h-3.5 w-32" />
            <Sk className="h-11 w-3/4" />
            <Sk className="h-3.5 w-40" />
            <div className="flex gap-3 pt-1">
              <Sk className="h-8 w-8 rounded-full" />
              <Sk className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>

        {/* Waveform player */}
        <Sk className="h-32 rounded-2xl" />

        {/* Track list context */}
        <div className="space-y-2">
          <Sk className="h-3.5 w-36" />
          <div className="rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-white/5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Sk className="w-5 h-3 shrink-0" />
                <Sk className="flex-1 h-4" />
                <Sk className="w-10 h-3 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
