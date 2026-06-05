import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const Player = dynamic(() => import('@/components/player').then((m) => ({ default: m.Player })), {
  ssr: false,
});

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
        {children}
        <Player />
      </body>
    </html>
  );
}
