function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

export default function ArtistProfileLoading() {
  return (
    <div className="min-h-full bg-background">
      {/* Hero */}
      <div className="relative">
        <Sk className="w-full h-56 sm:h-72 rounded-none" />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        {/* Profile info */}
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end -mt-16 sm:-mt-20">
          <Sk className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background shrink-0" />
          <div className="space-y-2 pb-1">
            <Sk className="h-7 w-44" />
            <Sk className="h-4 w-64" />
          </div>
        </div>

        {/* Follow + links */}
        <div className="flex items-center gap-3 flex-wrap">
          <Sk className="h-9 w-24 rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-8 w-8 rounded-full" />)}
        </div>

        {/* Releases grid */}
        <div className="space-y-4">
          <Sk className="h-5 w-20" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Sk className="aspect-square rounded-lg" />
                <Sk className="h-4 w-4/5" />
                <Sk className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
