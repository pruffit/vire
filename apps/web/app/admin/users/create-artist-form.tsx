'use client';

import { useState, useTransition } from 'react';
import { actionCreateArtist } from '../actions';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
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
        className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm transition-colors"
      >
        + Создать артиста
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3 w-full max-w-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Новый артист</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setResult(null); }}
          className="text-white/30 hover:text-white/60 text-lg leading-none transition-colors"
        >
          ×
        </button>
      </div>

      <input
        required
        type="email"
        placeholder="Email пользователя"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
      />
      <input
        required
        type="text"
        placeholder="Имя артиста"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
      />
      <div className="flex items-center gap-2">
        <span className="text-white/30 text-sm shrink-0">@</span>
        <input
          required
          type="text"
          placeholder="slug (латиница, цифры, дефис)"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="flex-1 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {result?.error && (
        <p className="text-red-400 text-xs">{result.error}</p>
      )}
      {result?.slug && (
        <p className="text-green-400 text-xs">
          Артист создан:{' '}
          <a href={`/artists/${result.slug}`} target="_blank" className="underline">
            @{result.slug}
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !email || !name || !slug}
        className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm transition-colors disabled:opacity-40"
      >
        {pending ? 'Создаём…' : 'Создать'}
      </button>
    </form>
  );
}
