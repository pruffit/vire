import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PlayerWrapper } from '@/components/player/player-wrapper';
import { Nav } from '@/components/nav';
import { fontVariables } from '@/lib/fonts';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Vire',
  description: 'Независимая музыкальная площадка для артистов и слушателей СНГ',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      {/*
        App-shell: окно фиксированной высоты (h-full + overflow-hidden), скролла
        на уровне документа нет. Nav закреплён сверху, контент скроллится внутри
        единой области ниже. pb-16 резервирует место под фиксированный плеер,
        поэтому контент не уезжает под него. Страницы заполняют область через
        min-h-full (не min-h-screen — иначе высота Nav давала бы лишний скролл).
      */}
      <body className="h-full flex flex-col bg-background text-foreground font-sans overflow-hidden">
        <Nav />
        <div className="flex-1 min-h-0 overflow-y-auto pb-16 flex flex-col">
          {children}
        </div>
        <PlayerWrapper />
      </body>
    </html>
  );
}
