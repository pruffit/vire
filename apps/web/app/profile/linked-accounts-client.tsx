'use client';

import { useActionState, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { setPasswordAction, linkYandexAction } from './account-actions';

interface Props {
  hasPassword: boolean;
  hasYandex: boolean;
}

export function LinkedAccountsClient({ hasPassword, hasYandex }: Props) {
  const [showSetPassword, setShowSetPassword] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card/60 divide-y divide-border">
      {/* Email / пароль */}
      <div className="px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <ProviderIcon type="email" />
            <span className="text-sm font-medium">Email и пароль</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasPassword ? (
              <StatusBadge ok>Настроен</StatusBadge>
            ) : (
              <>
                <StatusBadge ok={false}>Не задан</StatusBadge>
                <button
                  type="button"
                  onClick={() => setShowSetPassword((s) => !s)}
                  className="text-xs text-primary underline-offset-2 hover:underline cursor-pointer"
                >
                  {showSetPassword ? 'Отмена' : 'Задать пароль'}
                </button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showSetPassword && !hasPassword && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.snappy}
              className="overflow-hidden"
            >
              <SetPasswordForm onDone={() => setShowSetPassword(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Яндекс */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderIcon type="yandex" />
          <span className="text-sm font-medium">Яндекс</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasYandex ? (
            <StatusBadge ok>Привязан</StatusBadge>
          ) : (
            <>
              <StatusBadge ok={false}>Не привязан</StatusBadge>
              <form action={linkYandexAction}>
                <button
                  type="submit"
                  className="text-xs text-primary underline-offset-2 hover:underline cursor-pointer"
                >
                  Привязать
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Set password form ─────────────────────────────────────────────────────────

function SetPasswordForm({ onDone }: { onDone: () => void }) {
  const [result, action, pending] = useActionState(setPasswordAction, null);
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState('');

  if (result === 'ok') {
    return (
      <p className="text-xs text-green-500 py-1">
        Пароль задан. Теперь можешь входить по email и паролю.
      </p>
    );
  }

  return (
    <form action={action} className="pt-2 flex flex-col gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Новый пароль</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCn} pr-16`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs cursor-pointer"
          >
            {showPw ? 'скрыть' : 'показать'}
          </button>
        </div>
        {password.length > 0 && <PasswordStrength password={password} />}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Повтори пароль</label>
        <input
          type={showPw ? 'text' : 'password'}
          name="confirmPassword"
          required
          autoComplete="new-password"
          placeholder="Повтори пароль"
          className={inputCn}
        />
      </div>

      <AnimatePresence>
        {result && result !== 'ok' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="text-sm text-red-400"
            role="alert"
          >
            {result}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-full text-xs text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={[
        'text-[10px] font-medium px-2 py-0.5 rounded-full',
        ok
          ? 'bg-green-500/12 text-green-500'
          : 'bg-muted text-muted-foreground',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function ProviderIcon({ type }: { type: 'email' | 'yandex' }) {
  if (type === 'yandex') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-foreground/70">
        <path d="M13.582 11.977L19.832 2h-3.09l-4.008 6.58L8.75 2H5.66l6.023 9.832L5.09 22h3.09l4.372-7.174L16.914 22H20l-6.418-10.023z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="text-foreground/70">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) || /[а-яА-Я]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9а-яА-Я]/.test(password)) score++;

  const levels = [
    { label: 'слабый', color: 'bg-red-500' },
    { label: 'слабый', color: 'bg-red-500' },
    { label: 'средний', color: 'bg-yellow-500' },
    { label: 'хороший', color: 'bg-green-500' },
    { label: 'надёжный', color: 'bg-green-500' },
    { label: 'надёжный', color: 'bg-green-500' },
  ];
  const { label, color } = levels[Math.min(score, 5)];

  return (
    <div className="mt-1 space-y-0.5">
      <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.max(20, (score / 5) * 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

const inputCn =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

const primaryBtn =
  'rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:bg-primary/90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
