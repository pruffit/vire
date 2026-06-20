'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';
import { Icon } from '@/components/icon';

/**
 * Пресейв релиза. Залогиненный сохраняет в один клик (оптимистично, при выходе
 * треки авто-лайкаются и приходит письмо). Гость оставляет email и получает
 * письмо при выходе. Цвета берёт из темы артиста (--artist-accent/text).
 */
export function PresaveButton({
  releaseId,
  initialPresaved,
  isAuthed,
}: {
  releaseId: string;
  initialPresaved: boolean;
  isAuthed: boolean;
}) {
  const [presaved, setPresaved] = useState(initialPresaved);
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [guestDone, setGuestDone] = useState(false);

  async function toggleUser() {
    if (busy) return;
    const next = !presaved;
    setPresaved(next); // оптимистично
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/releases/${releaseId}/presave`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error();
    } catch {
      setPresaved(!next); // откат
      toast.error('Не удалось сохранить. Попробуй ещё раз');
    } finally {
      setBusy(false);
    }
  }

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/releases/${releaseId}/presave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? 'Ошибка');
      }
      setGuestDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  // ─── Залогинен ─────────────────────────────────────────────────────────────
  if (isAuthed) {
    return (
      <motion.button
        type="button"
        onClick={toggleUser}
        disabled={busy}
        whileTap={{ scale: 0.96 }}
        transition={spring.snappy}
        aria-pressed={presaved}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
        style={
          presaved
            ? { background: 'color-mix(in oklch, var(--artist-accent) 18%, transparent)', color: 'var(--artist-accent)' }
            : { background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }
        }
      >
        <Icon name={presaved ? 'check' : 'bell'} size={15} />
        {presaved ? 'Сохранено заранее' : 'Сохранить заранее'}
      </motion.button>
    );
  }

  // ─── Гость: оставил email ──────────────────────────────────────────────────
  if (guestDone) {
    return (
      <p className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--artist-accent)' }}>
        <Icon name="check" size={15} />
        Напомним на email, когда выйдет
      </p>
    );
  }

  // ─── Гость ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait" initial={false}>
      {emailMode ? (
        <motion.form
          key="form"
          onSubmit={submitGuest}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={spring.snappy}
          className="flex items-center gap-2"
        >
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            disabled={busy}
            className="rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm w-52 focus:outline-none focus:ring-1 focus:ring-[var(--artist-accent)] disabled:opacity-60"
            style={{ color: 'var(--artist-text)' }}
          />
          <motion.button
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.96 }}
            transition={spring.snappy}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }}
          >
            {busy ? 'Сохраняю…' : 'Напомнить'}
          </motion.button>
        </motion.form>
      ) : (
        <motion.button
          key="cta"
          type="button"
          onClick={() => setEmailMode(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }}
        >
          <Icon name="bell" size={15} />
          Напомнить о выходе
        </motion.button>
      )}
    </AnimatePresence>
  );
}
