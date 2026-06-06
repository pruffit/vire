import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PlayerWrapper } from '@/components/player/player-wrapper';
import { Nav } from '@/components/nav';
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans pb-16">
        <Nav />
        {children}
        <PlayerWrapper />
      </body>
    </html>
  );
}
