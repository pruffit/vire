'use client';

import { useState } from 'react';
import { Button } from '@vire/ui';
import { ReleaseQuickLook, type QuickLookRelease } from '@/components/release-quick-look';

const PAGE_SIZE = 24;

/** Прогрессивный показ каталога — сервер уже отдал (лимит 60), тут только клиентский слайс. */
export function ReleasesGrid({ releases }: { releases: QuickLookRelease[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = releases.slice(0, visible);
  const remaining = releases.length - shown.length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
        {shown.map((r) => (
          <ReleaseQuickLook key={r.id} release={r} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Показать ещё ({remaining})
          </Button>
        </div>
      )}
    </div>
  );
}
