import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chat.layout');
  return { title: t('title') };
}

export default async function MessagesIndexPage() {
  const t = await getTranslations('chat.index');
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Icon name="message-square" size={32} className="text-foreground/25" />
      <p className="text-sm font-medium text-foreground/70">{t('empty')}</p>
      <p className="max-w-xs text-xs text-foreground/40">
        {t('emptyHint')}
      </p>
    </div>
  );
}
