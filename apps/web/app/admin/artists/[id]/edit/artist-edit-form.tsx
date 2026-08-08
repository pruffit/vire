'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateArtist } from '../../../actions';
import { fieldClass, SectionLabel } from '@/components/admin/ui';
import { Textarea } from '@/components/ui-kit';
import { ThemeEditor, type ThemeValue } from '@/components/theme-editor';

interface Initial {
  name: string;
  slug: string;
  bio: string;
  avatarUrl: string;
}

const inputCls = `w-full ${fieldClass}`;

export function ArtistEditForm({
  artistProfileId,
  initial,
  initialTheme,
}: {
  artistProfileId: string;
  initial: Initial;
  initialTheme: ThemeValue;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [f, setF] = useState(initial);
  const [theme, setTheme] = useState<ThemeValue>(initialTheme);

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdateArtist(artistProfileId, {
        name: f.name,
        slug: f.slug,
        bio: f.bio || null,
        avatarUrl: f.avatarUrl || null,
        theme,
      });
      if (res.error) setMsg({ text: res.error, ok: false });
      else {
        setMsg({ text: 'Сохранено', ok: true });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Имя">
            <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
          </Field>

          <Field label="Slug (URL: /artists/slug — менять осторожно, ломает старые ссылки)">
            <input className={`${inputCls} font-mono`} value={f.slug} onChange={(e) => set('slug', e.target.value)} maxLength={60} />
          </Field>

          <Field label="Bio">
            <Textarea className={`${inputCls} min-h-28`} value={f.bio} onChange={(e) => set('bio', e.target.value)} maxLength={2000} />
          </Field>

          <Field label="Avatar URL">
            <input className={`${inputCls} font-mono text-xs`} value={f.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder="https://…" />
          </Field>

          <p className="text-xs text-foreground/35 leading-relaxed">
            Ссылки, видео, аватар-загрузка (файлом) — в дашборде артиста. Здесь — базовые поля и тема.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionLabel>Тема страницы</SectionLabel>
          <ThemeEditor value={theme} onChange={setTheme} artistName={f.name} avatarUrl={f.avatarUrl || null} disabled={pending} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-opacity"
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono text-foreground/45">{label}</span>
      {children}
    </label>
  );
}
