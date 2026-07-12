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
import { YandexIcon } from '@/components/provider-icons';
import { Icon } from '@/components/icon';
import { PasswordStrength } from '@/components/password-strength';

type Tab = 'login' | 'register' | 'magic';

export function AuthForms({ callbackUrl }: { callbackUrl: string }) {
  const [tab, setTab] = useState<Tab>('login');

  return (
    <div className="space-y-5">
      {/* Переключатель */}
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

      {/* Вход через Яндекс ID: росс. система, допустимо по 406-ФЗ. */}
      <SocialProviders callbackUrl={callbackUrl} />
    </div>
  );
}

// ─── Войти ────────────────────────────────────────────────────────────────────

function LoginForm({ callbackUrl, onMagicLink }: { callbackUrl: string; onMagicLink: () => void }) {
  const [error, action, pending] = useActionState(loginAction, null);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <FormField label="Email">
        <input
          type="email" name="email" required autoComplete="email"
          placeholder="you@example.ru" className={inputCn}
        />
      </FormField>
      <FormField label="Пароль">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'} name="password" required
            autoComplete="current-password" placeholder="••••••••"
            className={`${inputCn} pr-10`}
          />
          <button
            type="button" onClick={() => setShowPw((s) => !s)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs cursor-pointer"
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
      <button type="button" onClick={onMagicLink}
        className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-center cursor-pointer"
      >
        Забыл пароль? Войти по ссылке на email <Icon name="arrow-right" size={13} />
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
        <input type="text" name="name" required minLength={2} maxLength={60}
          autoComplete="name" placeholder="Как тебя зовут" className={inputCn}
        />
      </FormField>
      <FormField label="Email">
        <input type="email" name="email" required autoComplete="email"
          placeholder="you@example.ru" className={inputCn}
        />
      </FormField>
      <FormField label="Пароль">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'} name="password" required minLength={8}
            autoComplete="new-password" placeholder="Минимум 8 символов"
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCn} pr-10`}
          />
          <button type="button" onClick={() => setShowPw((s) => !s)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs cursor-pointer"
            aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {showPw ? 'скрыть' : 'показать'}
          </button>
        </div>
        {password.length > 0 && <PasswordStrength password={password} />}
      </FormField>
      <ErrorMessage error={error} />
      {/* Явное согласие (152-ФЗ): отдельный обязательный чекбокс, не предотмечен. */}
      <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed cursor-pointer">
        <input
          type="checkbox" name="consent" value="on" required
          className="mt-0.5 size-3.5 shrink-0 accent-primary cursor-pointer"
        />
        <span>
          Принимаю{' '}
          <a href="/terms" className="underline underline-offset-2 hover:opacity-70" target="_blank" rel="noopener">условия</a>{' '}
          и{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:opacity-70" target="_blank" rel="noopener">политику конфиденциальности</a>{' '}
          и даю согласие на обработку персональных данных.
        </span>
      </label>
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </button>
    </form>
  );
}

// ─── Magic link ───────────────────────────────────────────────────────────────

function MagicLinkForm({ callbackUrl, onBack }: { callbackUrl: string; onBack: () => void }) {
  const [error, action, pending] = useActionState(signInMagicLinkAction, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <p className="text-sm text-muted-foreground">Пришлём ссылку для входа без пароля.</p>
      <FormField label="Email">
        <input type="email" name="email" required autoComplete="email"
          placeholder="you@example.ru" className={inputCn}
        />
      </FormField>
      <ErrorMessage error={error} />
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Отправляем…' : 'Отправить ссылку'}
      </button>
      <button type="button" onClick={onBack}
        className="inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-center cursor-pointer"
      >
        <Icon name="arrow-left" size={13} /> Назад
      </button>
    </form>
  );
}

// ─── Социальные провайдеры ────────────────────────────────────────────────────

function SocialProviders({ callbackUrl }: { callbackUrl: string }) {
  return (
    <OAuthButton action={signInYandexAction} callbackUrl={callbackUrl} label="Войти через Яндекс">
      <YandexIcon size={17} />
    </OAuthButton>
  );
}

function OAuthButton({
  action,
  callbackUrl,
  label,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  callbackUrl: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button
        type="submit"
        title={label}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors py-2.5 text-xs font-medium cursor-pointer"
      >
        {children}
        <span className="hidden sm:inline">{label}</span>
      </button>
    </form>
  );
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={[
        'flex-1 rounded-md py-1.5 text-sm font-medium transition-all cursor-pointer',
        active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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

const inputCn =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

const primaryBtn =
  'w-full rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
