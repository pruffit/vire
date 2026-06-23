'use client';

import { useState, useTransition } from 'react';
import { actionCreateArtist } from '../actions';
import { fieldClass } from '@/components/admin/ui';
import { Icon } from '@/components/icon';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateArtistForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [result, setResult] = useState<{ error?: string; slug?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  function handleSlugChange(v: string) {
    setSlugTouched(true);
    setSlug(toSlug(v));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await actionCreateArtist(email.trim(), name.trim(), slug.trim());
      setResult(res);
      if (!res.error) {
        setEmail('');
        setName('');
        setSlug('');
        setSlugTouched(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-foreground/10 hover:bg-foreground/15 text-sm transition-colors active:scale-[0.98]"
      >
        <Icon name="plus" size={16} /> Создать артиста
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-4 flex flex-col gap-3 w-full max-w-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Новый артист</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setResult(null); }}
          aria-label="Закрыть"
          className="text-foreground/30 hover:text-foreground/60 transition-colors"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="text-xs text-foreground/45 -mt-1 leading-relaxed">
        Один аккаунт может управлять несколькими артистами — можно создать ещё одного
        на тот же email (slug должен быть уникальным).
      </p>

      <input
        required
        type="email"
        placeholder="Email пользователя"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`w-full ${fieldClass}`}
      />
      <input
        required
        type="text"
        placeholder="Имя артиста"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        className={`w-full ${fieldClass}`}
      />
      <div className="flex items-center gap-2">
        <span className="text-foreground/30 text-sm shrink-0">@</span>
        <input
          required
          type="text"
          placeholder="slug (латиница, цифры, дефис)"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className={`flex-1 ${fieldClass}`}
        />
      </div>

      {result?.error && (
        <p className="text-red-400 text-xs">{result.error}</p>
      )}
      {result?.slug && (
        <p className="text-emerald-400 text-xs">
          Артист создан:{' '}
          <a href={`/artists/${result.slug}`} target="_blank" className="underline">
            @{result.slug}
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !email || !name || !slug}
        className="px-4 py-2 rounded-md bg-foreground/10 hover:bg-foreground/15 text-sm transition-colors disabled:opacity-40 active:scale-[0.98]"
      >
        {pending ? 'Создаём…' : 'Создать'}
      </button>
    </form>
  );
}
