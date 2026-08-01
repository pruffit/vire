function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

function SkReleaseCard() {
  return (
    <div className="space-y-2">
      <Sk className="aspect-square rounded-lg" />
      <Sk className="h-4 w-4/5" />
      <Sk className="h-3 w-1/2" />
    </div>
  );
}

function SkArtistCircle() {
  return (
    <div className="space-y-2 text-center">
      <Sk className="w-full aspect-square rounded-full" />
      <Sk className="h-3.5 w-2/3 mx-auto" />
    </div>
  );
}

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      {/* Featured release */}
      <div className="rounded-2xl overflow-hidden flex flex-col sm:flex-row gap-6 p-6 bg-white/[0.03] border border-white/5">
        <Sk className="w-full sm:w-52 aspect-square rounded-xl shrink-0" />
        <div className="flex flex-col gap-3 pt-1 flex-1">
          <Sk className="h-3.5 w-20" />
          <Sk className="h-9 w-3/4" />
          <Sk className="h-4 w-full max-w-sm" />
          <Sk className="h-4 w-2/3" />
          <div className="flex gap-3 pt-2">
            <Sk className="h-9 w-28 rounded-full" />
            <Sk className="h-9 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Wave button */}
      <div className="flex justify-center">
        <Sk className="h-12 w-48 rounded-full" />
      </div>

      {/* Releases grid */}
      <div className="space-y-4">
        <Sk className="h-5 w-28" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkReleaseCard key={i} />)}
        </div>
      </div>

      {/* Artists */}
      <div className="space-y-4">
        <Sk className="h-5 w-20" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkArtistCircle key={i} />)}
        </div>
      </div>
    </main>
  );
}
