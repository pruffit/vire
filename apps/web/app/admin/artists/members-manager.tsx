'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import {
  actionListArtistMembers,
  actionAddArtistMember,
  actionRemoveArtistMember,
} from '../actions';
import type { ArtistMemberRow } from '@vire/db';
import { toast } from '@/components/toast';

/**
 * Управление участниками артист-профиля (несколько аккаунтов на одну карточку).
 * Поповер по кнопке: лениво грузит список участников через server action, даёт
 * добавить по email и снять (кроме OWNER). Только бэкоффис (страница под requireAdmin).
 */
export function MembersManager({ artistProfileId }: { artistProfileId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ArtistMemberRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
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
    if (next && members === null) load();
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="px-2.5 py-1 rounded-md bg-white/8 hover:bg-white/12 text-xs transition-colors"
      >
        Участники
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-white/10 bg-[#16151a] shadow-xl p-3 flex flex-col gap-2.5 text-left">
          <p className="text-xs text-white/40">Аккаунты с доступом к дашборду артиста.</p>

          {members === null ? (
            <p className="text-xs text-white/30 py-2">Загрузка…</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-white/30 py-2">Нет участников.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 min-w-0 truncate" title={m.email ?? undefined}>
                    {m.email ?? m.userId}
                    {m.name && <span className="text-white/30"> · {m.name}</span>}
                  </span>
                  {m.role === 'OWNER' ? (
                    <span className="shrink-0 text-[10px] font-mono uppercase text-white/30">owner</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => remove(m.userId)}
                      disabled={pending}
                      className="shrink-0 text-white/30 hover:text-red-400 transition-colors disabled:opacity-40"
                      aria-label="Снять участника"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="flex gap-1.5 pt-1 border-t border-white/10">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email участника"
              disabled={pending}
              className="flex-1 min-w-0 rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="shrink-0 px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-xs transition-colors disabled:opacity-40"
            >
              +
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
