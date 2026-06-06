'use client';

import { useState } from 'react';

interface Props {
  trackId: string;
  trackTitle: string;
  initialOwned: boolean;
}

export function DownloadButton({ trackId, trackTitle, initialOwned }: Props) {
  const [owned, setOwned] = useState(initialOwned);
  const [buying, setBuying] = useState(false);

  async function handleBuy() {
    setBuying(true);
    try {
      const res = await fetch(`/api/v1/tracks/${trackId}/purchase`, { method: 'POST' });
      if (res.ok) setOwned(true);
    } finally {
      setBuying(false);
    }
  }

  if (owned) {
    return (
      <a
        href={`/api/v1/tracks/${trackId}/download?filename=${encodeURIComponent(trackTitle)}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/15 transition-colors border border-white/10"
      >
        <DownloadIcon />
        FLAC
      </a>
    );
  }

  return (
    <button
      onClick={handleBuy}
      disabled={buying}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/15 transition-colors border border-white/10 disabled:opacity-40"
    >
      {buying ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <DownloadIcon />
      )}
      {buying ? 'Оформление…' : 'Купить FLAC · 99 ₽'}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
