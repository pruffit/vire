import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LegalDoc } from '@/components/content-kit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms.meta');
  return { title: t('title'), description: t('description') };
}

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export default async function TermsPage() {
  const t = await getTranslations('legal');
  const s = t.raw('terms.sections') as Record<string, { title: string }>;

  return (
    <LegalDoc
      eyebrow={t('eyebrow')}
      draftNotice={t('draftNotice')}
      tocAriaLabel={t('toc.ariaLabel')}
      title={t('terms.title')}
      revision={t('terms.revision')}
      sections={[
        {
          title: s.general.title,
          body: <Paragraphs items={t.raw('terms.sections.general.paragraphs') as string[]} />,
        },
        {
          title: s.contentRights.title,
          body: <Paragraphs items={t.raw('terms.sections.contentRights.paragraphs') as string[]} />,
        },
        {
          title: s.ugc.title,
          body: (
            <>
              <p>{t('terms.sections.ugc.intro')}</p>
              <BulletList items={t.raw('terms.sections.ugc.items') as string[]} />
              <p>{t('terms.sections.ugc.outro')}</p>
            </>
          ),
        },
        {
          title: s.account.title,
          body: <Paragraphs items={t.raw('terms.sections.account.paragraphs') as string[]} />,
        },
        {
          title: s.streaming.title,
          body: <Paragraphs items={t.raw('terms.sections.streaming.paragraphs') as string[]} />,
        },
        {
          title: s.presave.title,
          body: <Paragraphs items={t.raw('terms.sections.presave.paragraphs') as string[]} />,
        },
        {
          title: s.playlists.title,
          body: <Paragraphs items={t.raw('terms.sections.playlists.paragraphs') as string[]} />,
        },
        {
          title: s.liability.title,
          body: <Paragraphs items={t.raw('terms.sections.liability.paragraphs') as string[]} />,
        },
        {
          title: s.changes.title,
          body: <Paragraphs items={t.raw('terms.sections.changes.paragraphs') as string[]} />,
        },
        {
          title: s.contact.title,
          body: (
            <p>
              {t.rich('terms.sections.contact.body', {
                link: (chunks) => <Link href="/feedback">{chunks}</Link>,
              })}
            </p>
          ),
        },
      ]}
    />
  );
}
