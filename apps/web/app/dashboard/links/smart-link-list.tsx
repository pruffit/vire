'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';

export interface SmartLinkRow {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  isPublished: boolean;
  linkCount: number;
}

export function SmartLinkList({ items, artistSlug }: { items: SmartLinkRow[]; artistSlug: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(id: string, title: string) {
    if (!confirm(`Удалить «${title}»? Действие необратимо.`)) return;
    setPendingId(id);
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id)); // оптимистично
    const res = await fetch(`/api/v1/dashboard/smart-links/${id}`, { method: 'DELETE' }).catch(() => null);
    setPendingId(null);
    if (!res?.ok) {
      setRows(prev);
      toast.error('Не удалось удалить');
    } else {
      router.refresh();
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/smartlink/${artistSlug}/${slug}`;
    navigator.clipboard.writeText(url).then(() => toast('Ссылка скопирована')).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/dashboard/links/new"
        className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Создать лендинг
      </Link>

      {rows.length === 0 ? (
        <p className="text-sm text-foreground/40 py-8 text-center">
          Пока нет лендингов. Создай первый — собери ссылки на стриминги и соцсети в одну красивую страницу.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              transition={spring.snappy}
              className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-foreground/5 border border-foreground/10">
                  {row.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.coverUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.title}</p>
                  <p className="text-xs text-foreground/40 font-mono truncate">/smartlink/{artistSlug}/{row.slug}</p>
                </div>

                <span className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  row.isPublished ? 'bg-emerald-500/15 text-emerald-300' : 'bg-foreground/10 text-foreground/40'
                }`}>
                  {row.isPublished ? 'опубликован' : 'черновик'}
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-1 text-xs justify-end">
                {row.isPublished && (
                  <button onClick={() => copyLink(row.slug)} className="px-2 py-1 rounded text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors">
                    Копировать
                  </button>
                )}
                <Link href={`/dashboard/links/${row.id}`} className="px-2 py-1 rounded text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors">
                  Изменить
                </Link>
                <button onClick={() => remove(row.id, row.title)} disabled={pendingId === row.id}
                  className="px-2 py-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition-colors disabled:opacity-50">
                  Удалить
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
