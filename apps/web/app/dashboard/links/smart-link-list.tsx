'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/lib/toast';
import { Badge, Panel, EmptyState, btnPrimary } from '@/components/ui-kit';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';
import { plural } from '@/lib/format';

const iconBtnBase =
  'inline-flex items-center justify-center rounded-md p-1.5 text-foreground/40 transition-colors active:scale-[0.98] disabled:opacity-40';
const iconBtnHover = 'hover:bg-foreground/10 hover:text-foreground';

export interface SmartLinkRow {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  isPublished: boolean;
  linkCount: number;
}

function IconButton({
  onClick,
  label,
  icon,
  danger,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: 'copy' | 'edit-2' | 'trash';
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(iconBtnBase, danger ? 'hover:bg-red-500/10 hover:text-red-400' : iconBtnHover)}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

export function SmartLinkList({ items, artistSlug }: { items: SmartLinkRow[]; artistSlug: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(id: string, title: string) {
    if (!confirm(`Удалить «${title}»? Действие необратимо.`)) return;
    setPendingId(id);
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
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
      <Link href="/dashboard/links/new" className={cn(btnPrimary, 'gap-1.5 self-start')}>
        <Icon name="plus" size={16} /> Создать лендинг
      </Link>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Пока нет лендингов"
            hint="Создай первый — собери ссылки на стриминги и соцсети в одну страницу."
          />
        </Panel>
      ) : (
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              transition={spring.snappy}
              className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.025] p-3 transition-colors hover:border-foreground/20 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-foreground/10 bg-foreground/5 text-foreground/25">
                  {row.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="image" size={18} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="truncate font-mono text-xs text-foreground/40">/{row.slug}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden font-mono text-xs text-foreground/35 sm:inline">
                    {row.linkCount} {plural(row.linkCount, ['ссылка', 'ссылки', 'ссылок'])}
                  </span>
                  <Badge tone={row.isPublished ? 'success' : 'neutral'}>
                    {row.isPublished ? 'опубликован' : 'черновик'}
                  </Badge>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-1">
                {row.isPublished && (
                  <>
                    <a
                      href={`/smartlink/${artistSlug}/${row.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Открыть страницу"
                      title="Открыть страницу"
                      className={cn(iconBtnBase, iconBtnHover)}
                    >
                      <Icon name="external-link" size={15} />
                    </a>
                    <IconButton onClick={() => copyLink(row.slug)} label="Скопировать ссылку" icon="copy" />
                  </>
                )}
                <Link
                  href={`/dashboard/links/${row.id}`}
                  aria-label="Изменить"
                  title="Изменить"
                  className={cn(iconBtnBase, iconBtnHover)}
                >
                  <Icon name="edit-2" size={15} />
                </Link>
                <IconButton
                  onClick={() => remove(row.id, row.title)}
                  label="Удалить"
                  icon="trash"
                  danger
                  disabled={pendingId === row.id}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
