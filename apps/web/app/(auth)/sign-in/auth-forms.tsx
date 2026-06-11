'use client';

import { useActionState, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import {
  loginAction,
  registerAction,
  signInMagicLinkAction,
  signInYandexAction,
} from './auth-actions';

type Tab = 'login' | 'register' | 'magic';

export function AuthForms({ callbackUrl }: { callbackUrl: string }) {
  const [tab, setTab] = useState<Tab>('login');

  return (
    <div className="space-y-5">
      {/* Переключатель Войти / Зарегистрироваться */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        <TabButton active={tab === 'login'} onClick={() => setTab('login')}>Войти</TabButton>
        <TabButton active={tab === 'register'} onClick={() => setTab('register')}>Регистрация</TabButton>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={spring.snappy}
          >
            <LoginForm callbackUrl={callbackUrl} onMagicLink={() => setTab('magic')} />
          </motion.div>
        )}
        {tab === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={spring.snappy}
          >
            <RegisterForm callbackUrl={callbackUrl} />
          </motion.div>
        )}
        {tab === 'magic' && (
          <motion.div
            key="magic"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring.snappy}
          >
            <MagicLinkForm callbackUrl={callbackUrl} onBack={() => setTab('login')} />
          </motion.div>
        )}
      </AnimatePresence>

      <Divider />

      {/* Яндекс — всегда виден */}
      <YandexButton callbackUrl={callbackUrl} />
    </div>
  );
}

// ─── Войти ────────────────────────────────────────────────────────────────────

function LoginForm({
  callbackUrl,
  onMagicLink,
}: {
  callbackUrl: string;
  onMagicLink: () => void;
}) {
  const [error, action, pending] = useActionState(loginAction, null);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <FormField label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.ru"
          className={inputCn}
        />
      </FormField>

      <FormField label="Пароль">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${inputCn} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
            aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {showPw ? 'скрыть' : 'показать'}
          </button>
        </div>
      </FormField>

      <ErrorMessage error={error} />

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Входим…' : 'Войти'}
      </button>

      <button
        type="button"
        onClick={onMagicLink}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
      >
        Забыл пароль? Войти по ссылке на email →
      </button>
    </form>
  );
}

// ─── Регистрация ──────────────────────────────────────────────────────────────

function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, action, pending] = useActionState(registerAction, null);
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState('');

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <FormField label="Имя">
        <input
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          placeholder="Как тебя зовут"
          className={inputCn}
        />
      </FormField>

      <FormField label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.ru"
          className={inputCn}
        />
      </FormField>

      <FormField label="Пароль">
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
            className={`${inputCn} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
            aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {showPw ? 'скрыть' : 'показать'}
          </button>
        </div>
        {password.length > 0 && <PasswordStrength password={password} />}
      </FormField>

      <ErrorMessage error={error} />

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Создавая аккаунт, ты соглашаешься с{' '}
        <a href="/terms" className="underline underline-offset-2 hover:opacity-70">условиями</a>{' '}
        и{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:opacity-70">
          политикой конфиденциальности
        </a>
        .
      </p>
    </form>
  );
}

// ─── Magic link ───────────────────────────────────────────────────────────────

function MagicLinkForm({
  callbackUrl,
  onBack,
}: {
  callbackUrl: string;
  onBack: () => void;
}) {
  const [error, action, pending] = useActionState(signInMagicLinkAction, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <p className="text-sm text-muted-foreground">Пришлём ссылку для входа без пароля.</p>

      <FormField label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.ru"
          className={inputCn}
        />
      </FormField>

      <ErrorMessage error={error} />

      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Отправляем…' : 'Отправить ссылку'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
      >
        ← Назад
      </button>
    </form>
  );
}

// ─── Яндекс ───────────────────────────────────────────────────────────────────

function YandexButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <form action={signInYandexAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors py-2.5 text-sm font-medium"
      >
        <YandexIcon />
        Войти с Яндексом
      </button>
    </form>
  );
}

// ─── Strength indicator ───────────────────────────────────────────────────────

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
  const width = `${Math.max(20, (score / 5) * 100)}%`;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 rounded-md py-1.5 text-sm font-medium transition-all',
        active
          ? 'bg-card shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={spring.snappy}
          className="text-sm text-red-400 text-center"
          role="alert"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function Divider() {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-2 text-muted-foreground">или</span>
      </div>
    </div>
  );
}

function YandexIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.582 11.977L19.832 2h-3.09l-4.008 6.58L8.75 2H5.66l6.023 9.832L5.09 22h3.09l4.372-7.174L16.914 22H20l-6.418-10.023z" />
    </svg>
  );
}

const inputCn =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

const primaryBtn =
  'w-full rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
