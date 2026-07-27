import { PageContainer } from '@/components/page-container';

function Sk({ className }: { className?: string }) {
  return <div className={`rounded-md bg-white/6 animate-pulse ${className ?? ''}`} />;
}

export default function TrackLoading() {
  return (
    <div className="relative min-h-full bg-background overflow-x-clip">
      <PageContainer as="div" variant="detail" className="py-10 sm:py-14">
        <div className="flex items-center gap-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-2 w-2 rounded-full" />
          <Sk className="h-3 w-24" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[clamp(300px,24%,380px)_1fr] gap-10 lg:gap-12 lg:items-start mt-10 sm:mt-12">
          <div className="flex flex-col sm:flex-row lg:flex-col gap-7 sm:gap-9 lg:gap-5 items-start sm:items-end lg:items-start">
            <Sk className="w-56 h-56 sm:w-72 sm:h-72 lg:h-80 lg:w-80 shrink-0 rounded-xl" />
            <div className="space-y-4 min-w-0 flex-1 lg:flex-none lg:w-full">
              <Sk className="h-3.5 w-32" />
              <Sk className="h-11 w-3/4" />
              <Sk className="h-3.5 w-40" />
              <div className="flex gap-3 pt-1">
                <Sk className="h-8 w-8 rounded-full" />
                <Sk className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-10 sm:space-y-12">
            <Sk className="h-32 rounded-2xl" />
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
      </PageContainer>
    </div>
  );
}
