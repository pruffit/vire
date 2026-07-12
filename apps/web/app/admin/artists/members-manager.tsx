'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  actionListArtistMembers,
  actionAddArtistMember,
  actionRemoveArtistMember,
} from '../actions';
import type { ArtistMemberRow } from '@vire/db';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';

// поповер в портале с position:fixed — иначе его обрезает таблица-родитель с overflow:auto
export function MembersManager({ artistProfileId }: { artistProfileId: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [members, setMembers] = useState<ArtistMemberRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Правый край поповера выровнен по правому краю кнопки, открывается вниз.
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function reflow() {
      place();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reflow);
    // capture: ловим скролл внутри любого контейнера (таблица, main), не только окна
    window.addEventListener('scroll', reflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
  }, [open]);

  function load() {
    actionListArtistMembers(artistProfileId)
      .then(setMembers)
      .catch(() => toast.error('Не удалось загрузить участников'));
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      place();
      if (members === null) load();
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !email.trim()) return;
    startTransition(async () => {
      const res = await actionAddArtistMember(artistProfileId, email.trim());
      if (res.error) return toast.error(res.error);
      setEmail('');
      toast('Участник добавлен');
      load();
    });
  }

  function remove(userId: string) {
    if (pending) return;
    startTransition(async () => {
      const res = await actionRemoveArtistMember(artistProfileId, userId);
      if (res.error) return toast.error(res.error);
      toast('Участник снят');
      load();
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="px-2.5 py-1 rounded-md bg-foreground/[0.08] hover:bg-foreground/[0.12] text-xs transition-colors active:scale-[0.98]"
      >
        Участники
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="z-50 w-72 rounded-lg border border-foreground/10 bg-popover shadow-xl p-3 flex flex-col gap-2.5 text-left"
        >
          <p className="text-xs text-foreground/45">Аккаунты с доступом к дашборду артиста.</p>

          {members === null ? (
            <p className="text-xs text-foreground/30 py-2">Загрузка…</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-foreground/30 py-2">Нет участников.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 min-w-0 truncate" title={m.email ?? undefined}>
                    {m.email ?? m.userId}
                    {m.name && <span className="text-foreground/30"> · {m.name}</span>}
                  </span>
                  {m.role === 'OWNER' ? (
                    <span className="shrink-0 text-[10px] font-mono uppercase text-foreground/30">owner</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => remove(m.userId)}
                      disabled={pending}
                      className="inline-flex shrink-0 text-foreground/30 hover:text-red-400 transition-colors disabled:opacity-40"
                      aria-label="Снять участника"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="flex gap-1.5 pt-1 border-t border-foreground/10">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email участника"
              disabled={pending}
              className="flex-1 min-w-0 rounded-md bg-foreground/5 border border-foreground/10 px-2 py-1.5 text-xs transition-colors placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="shrink-0 px-2.5 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 text-xs transition-colors disabled:opacity-40 active:scale-[0.98]"
            >
              +
            </button>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
