import { PageContainer } from '@/components/page-container';

function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

export default function ArtistProfileLoading() {
  return (
    <div className="min-h-full bg-background overflow-x-clip">
      <div className="w-full bg-white/6 animate-pulse" style={{ height: 'clamp(180px, 26vh, 320px)' }} />

      <PageContainer as="div" variant="overlap">
        <div className="grid grid-cols-1 lg:grid-cols-[clamp(280px,26%,360px)_1fr] gap-8 lg:gap-12">
          <div className="space-y-5">
            <Sk className="w-28 h-28 sm:w-36 sm:h-36 rounded-full" />
            <Sk className="h-9 w-44" />
            <div className="flex items-center gap-3 flex-wrap">
              <Sk className="h-9 w-24 rounded-full" />
              {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-8 w-8 rounded-full" />)}
            </div>
          </div>

          <div className="space-y-4 pt-2 lg:pt-8">
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
      </PageContainer>
    </div>
  );
}
