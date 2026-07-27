'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { Textarea } from '@/components/ui-kit';

export type FeedbackType = 'bug' | 'idea' | 'artist' | 'other';

const TYPES: { value: FeedbackType; label: string; emoji: string; hint: string }[] = [
  { value: 'bug', label: 'Баг', emoji: '🐛', hint: 'Что-то сломалось или работает неожиданно' },
  { value: 'idea', label: 'Идея', emoji: '💡', hint: 'Предложение по улучшению платформы' },
  { value: 'artist', label: 'Стать артистом', emoji: '🎤', hint: 'Хочу публиковать музыку на VireMusic' },
  { value: 'other', label: 'Другое', emoji: '💬', hint: 'Что угодно ещё' },
];

type Status = 'idle' | 'sending' | 'done' | 'error';

export function FeedbackForm({ initialType = 'bug' }: { initialType?: FeedbackType }) {
  const [type, setType] = useState<FeedbackType>(initialType);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const formRef = useRef<HTMLFormElement>(null);

  const currentPage = typeof window !== 'undefined' ? window.location.href : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending' || !consent) return;
    setStatus('sending');

    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: message.trim(), page: currentPage, email: email.trim() || undefined }),
      });

      if (!res.ok) throw new Error('Server error');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.smooth}
        className="rounded-xl bg-card border border-border px-6 py-10 text-center space-y-4"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-primary/20 bg-primary/10">
          <Icon name="check" size={24} className="text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold">Спасибо!</p>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground leading-relaxed">
            Сообщение отправлено. Мы прочитаем и постараемся ответить.
          </p>
        </div>
        <div className="border-t border-border/50 pt-4">
          <button
            type="button"
            onClick={() => { setStatus('idle'); setMessage(''); setEmail(''); setConsent(false); }}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Отправить ещё одно
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      {/* Тип */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Тип</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={[
                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                type === t.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/20 hover:bg-foreground/[0.02] hover:text-foreground',
              ].join(' ')}
            >
              <span className="shrink-0 text-base leading-none">{t.emoji}</span>
              <span className="text-xs font-medium leading-snug">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {TYPES.find((t) => t.value === type)?.hint}
        </p>
      </fieldset>

      {/* Сообщение */}
      <div className="space-y-1.5">
        <label htmlFor="fb-message" className="text-sm font-medium">
          Сообщение
          <span className="text-muted-foreground font-normal ml-1">(мин. 10 символов)</span>
        </label>
        <Textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder={
            type === 'bug'
              ? 'Опиши что произошло: что делал, что ожидал увидеть, что увидел на самом деле...'
              : type === 'idea'
              ? 'Расскажи свою идею...'
              : type === 'artist'
              ? 'Расскажи о себе: имя/проект, ссылки на музыку (стриминги, соцсети), пару слов о том, что играешь...'
              : 'Напиши что хочешь...'
          }
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground text-right tabular-nums">
          {message.length} / 2000
        </p>
      </div>

      {/* Email (необязательно) */}
      <div className="space-y-1.5">
        <label htmlFor="fb-email" className="text-sm font-medium">
          Email
          <span className="text-muted-foreground font-normal ml-1">(необязательно — для ответа)</span>
        </label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <AnimatePresence>
        {status === 'error' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="text-sm text-red-400"
          >
            Не удалось отправить. Попробуй ещё раз или напиши напрямую на{' '}
            <a href="mailto:hello@viremusic.ru" className="underline underline-offset-2">
              hello@viremusic.ru
            </a>
          </motion.p>
        )}
      </AnimatePresence>

      {/* Согласие на обработку ПДн (152-ФЗ) — обязательно, не предотмечено. */}
      <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-3.5 shrink-0 accent-primary cursor-pointer"
        />
        <span>
          Даю согласие на обработку персональных данных в соответствии с{' '}
          <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2 hover:opacity-70">
            политикой конфиденциальности
          </a>.
        </span>
      </label>

      <button
        type="submit"
        disabled={status === 'sending' || message.trim().length < 10 || !consent}
        className="w-full rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {status === 'sending'
          ? 'Отправляю…'
          : message.trim().length < 10 && message.length > 0
          ? `Ещё ${10 - message.trim().length} симв.`
          : 'Отправить'}
      </button>
    </form>
  );
}
