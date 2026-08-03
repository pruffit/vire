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
const LocalFileDrop = dynamic(() => import('./local-file-drop').then((m) => m.LocalFileDrop), {
  ssr: false,
});
const ServiceWorkerRegistrar = dynamic(
  () => import('./service-worker-registrar').then((m) => m.ServiceWorkerRegistrar),
  { ssr: false },
);

export function DeferredWidgets({ userId }: { userId?: string | null }) {
  return (
    <>
      <CommandPalette />
      <CookieBanner />
      <Announcements />
      <EasterEggs />
      <LocalFileDrop />
      <ServiceWorkerRegistrar userId={userId} />
    </>
  );
}
