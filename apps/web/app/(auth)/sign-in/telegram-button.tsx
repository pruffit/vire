'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { TelegramIcon } from './provider-icons';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';

export function TelegramButton({ callbackUrl }: { callbackUrl: string }) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BOT_USERNAME) return;
    const el = widgetRef.current;
    if (!el) return;

    // Telegram виджет ищет window.onTelegramAuth глобально
    (window as unknown as Record<string, unknown>).onTelegramAuth = async (
      user: Record<string, unknown>,
    ) => {
      setLoading(true);
      setError(null);
      const data = Object.fromEntries(
        Object.entries(user).map(([k, v]) => [k, String(v)]),
      );
      const result = await signIn('telegram', { ...data, redirect: false });
      if (result?.error) {
        setError('Не удалось войти через Telegram. Попробуй ещё раз.');
        setLoading(false);
      } else {
        window.location.href = callbackUrl;
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    el.appendChild(script);

    return () => {
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
      if (el.contains(script)) el.removeChild(script);
    };
  }, [callbackUrl]);

  if (!BOT_USERNAME) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {loading ? (
        <div className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-border bg-card py-2.5 text-sm font-medium opacity-60">
          <TelegramIcon />
          Входим…
        </div>
      ) : (
        <div ref={widgetRef} className="[&_iframe]:!rounded-lg [&_iframe]:!border-0" />
      )}
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}
