import { PageContainer } from '@/components/page-container';

function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-foreground/6 animate-pulse ${className ?? ''}`} />;
}

export default function ArtistsLoading() {
  return (
    <PageContainer spaceY="10">
      <div className="flex items-baseline justify-between">
        <Sk className="h-7 w-24" />
        <Sk className="h-4 w-6" />
      </div>
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Sk className="h-8 flex-1 rounded-md" />
        <Sk className="h-8 w-48 rounded-md" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-3 text-center">
            <Sk className="w-full aspect-square rounded-full" />
            <Sk className="h-4 w-2/3 mx-auto" />
            <Sk className="h-3 w-1/3 mx-auto" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
