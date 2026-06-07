'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  trackId: string;
  trackTitle: string;
  initialOwned: boolean;
  initialPending: boolean;
}

export function DownloadButton({ trackId, trackTitle, initialOwned, initialPending }: Props) {
  const router = useRouter();
  const [owned, setOwned] = useState(initialOwned);
  const [pending] = useState(initialPending);
  const [busy, setBusy] = useState(false);

  async function handleBuy() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tracks/${trackId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });

      if (!res.ok) return;

      const data = await res.json() as { ok?: boolean; alreadyOwned?: boolean; confirmationUrl?: string };

      if (data.alreadyOwned) {
        setOwned(true);
        return;
      }

      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckPayment() {
    setBusy(true);
    router.refresh();
    // After refresh, server re-checks hasPurchasedTrack; page re-renders with updated initialOwned
    setBusy(false);
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

  if (pending) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-xs opacity-50">Оплата обрабатывается</span>
        <button
          onClick={handleCheckPayment}
          disabled={busy}
          className="text-xs underline underline-offset-2 opacity-50 hover:opacity-80 transition-opacity disabled:opacity-30"
        >
          Проверить
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleBuy}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/15 transition-colors border border-white/10 disabled:opacity-40"
    >
      {busy ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <DownloadIcon />
      )}
      {busy ? 'Перехожу к оплате…' : 'Купить FLAC · 99 ₽'}
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
