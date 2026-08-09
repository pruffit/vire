import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LegalDoc } from '@/components/content-kit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy.meta');
  return { title: t('title'), description: t('description') };
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

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  const s = t.raw('privacy.sections') as Record<string, { title: string }>;

  return (
    <LegalDoc
      eyebrow={t('eyebrow')}
      draftNotice={t('draftNotice')}
      tocAriaLabel={t('toc.ariaLabel')}
      title={t('privacy.title')}
      revision={t('privacy.revision')}
      sections={[
        {
          title: s.dataCollected.title,
          body: (
            <>
              <p>{t('privacy.sections.dataCollected.oauthIntro')}</p>
              <BulletList items={t.raw('privacy.sections.dataCollected.oauthItems') as string[]} />
              <p>{t('privacy.sections.dataCollected.emailAuth')}</p>
              <p>{t('privacy.sections.dataCollected.ownAvatar')}</p>
              <p>{t('privacy.sections.dataCollected.presaveGuest')}</p>
              <p>{t('privacy.sections.dataCollected.usageIntro')}</p>
              <BulletList items={t.raw('privacy.sections.dataCollected.usageItems') as string[]} />
            </>
          ),
        },
        {
          title: s.dataUse.title,
          body: <BulletList items={t.raw('privacy.sections.dataUse.items') as string[]} />,
        },
        {
          title: s.dataSharing.title,
          body: (
            <>
              <p>{t('privacy.sections.dataSharing.intro')}</p>
              <p>{t('privacy.sections.dataSharing.listIntro')}</p>
              <BulletList items={t.raw('privacy.sections.dataSharing.items') as string[]} />
            </>
          ),
        },
        {
          title: s.cookies.title,
          body: (
            <>
              <p>{t('privacy.sections.cookies.necessary')}</p>
              <p>
                {t.rich('privacy.sections.cookies.metricaIntro', {
                  strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                })}
              </p>
              <BulletList items={t.raw('privacy.sections.cookies.metricaItems') as string[]} />
              <p>
                {t.rich('privacy.sections.cookies.metricaPolicy', {
                  link: (chunks) => (
                    <a href="https://yandex.ru/legal/confidential/" target="_blank" rel="noopener noreferrer">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
              <p>{t('privacy.sections.cookies.localStorage')}</p>
            </>
          ),
        },
        {
          title: s.storage.title,
          body: (
            <>
              <p>{t('privacy.sections.storage.location')}</p>
              <p>
                {t.rich('privacy.sections.storage.deletion', {
                  link: (chunks) => <Link href="/feedback">{chunks}</Link>,
                })}
              </p>
              <p>{t('privacy.sections.storage.afterDeletion')}</p>
            </>
          ),
        },
        {
          title: s.security.title,
          body: <p>{(t.raw('privacy.sections.security.paragraphs') as string[])[0]}</p>,
        },
        {
          title: s.policyChanges.title,
          body: <p>{(t.raw('privacy.sections.policyChanges.paragraphs') as string[])[0]}</p>,
        },
        {
          title: s.contact.title,
          body: (
            <p>
              {t.rich('privacy.sections.contact.body', {
                link: (chunks) => <Link href="/feedback">{chunks}</Link>,
              })}
            </p>
          ),
        },
      ]}
    />
  );
}
