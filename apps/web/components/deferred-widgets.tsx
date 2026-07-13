'use client';

import dynamic from 'next/dynamic';

const CommandPalette = dynamic(() => import('./command-palette').then((m) => m.CommandPalette), {
  ssr: false,
});
const CookieBanner = dynamic(() => import('./cookie-banner').then((m) => m.CookieBanner), {
  ssr: false,
});
const Announcements = dynamic(() => import('./announcements').then((m) => m.Announcements), {
  ssr: false,
});
const EasterEggs = dynamic(() => import('./easter-eggs').then((m) => m.EasterEggs), {
  ssr: false,
});

export function DeferredWidgets() {
  return (
    <>
      <CommandPalette />
      <CookieBanner />
      <Announcements />
      <EasterEggs />
    </>
  );
}
