'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Badge lives in the server layout; only router.refresh() after the write
// clears it — a server-side effect here would race the layout's own render.
export function MarkRequestsSeen() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/friends/seen', { method: 'POST' })
      .then(() => router.refresh())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  return null;
}
