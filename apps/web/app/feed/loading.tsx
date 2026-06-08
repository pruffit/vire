function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

export default function FeedLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div className="flex items-baseline justify-between">
        <Sk className="h-7 w-24" />
        <Sk className="h-4 w-6" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Sk className="aspect-square rounded-md" />
            <Sk className="h-4 w-3/4" />
            <Sk className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}
