import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './logo';
import { AnnouncementReopenLink } from './widget-triggers';
import { PartyTrigger } from './party-trigger';
import { SITE_VERSION } from '@/lib/site';

const reopenCls =
  'text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer text-left';

export async function Footer() {
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');
  const year = new Date().getFullYear();

  return (
    <footer data-site-footer className="mt-auto border-t border-border bg-background">
      <div className="px-6 lg:px-10 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs space-y-3">
            <Logo className="h-4 w-auto text-foreground/80" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {tCommon('tagline')}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
            <FooterCol title={t('footer.platform')}>
              <FooterLink href="/artists">{t('footer.artists')}</FooterLink>
              <FooterLink href="/releases">{t('footer.releases')}</FooterLink>
              <FooterLink href="/about">{t('footer.about')}</FooterLink>
              <FooterLink href="/design">{t('footer.design')}</FooterLink>
              <li>
                <AnnouncementReopenLink id="stage1" className={reopenCls}>
                  {t('footer.whatsNew')}
                </AnnouncementReopenLink>
              </li>
            </FooterCol>
            <FooterCol title={t('footer.support')}>
              <FooterLink href="/feedback?type=artist">{t('footer.becomeArtist')}</FooterLink>
              <FooterLink href="/feedback">{t('footer.feedback')}</FooterLink>
            </FooterCol>
            <FooterCol title={t('footer.legal')}>
              <FooterLink href="/terms">{t('footer.terms')}</FooterLink>
              <FooterLink href="/privacy">{t('footer.privacy')}</FooterLink>
              <li>
                <AnnouncementReopenLink id="auth" className={reopenCls}>
                  {t('footer.authChanges')}
                </AnnouncementReopenLink>
              </li>
            </FooterCol>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 border-t border-border/60 pt-6">
          <PartyTrigger className="font-mono text-xs text-muted-foreground select-none">© {year} VireMusic</PartyTrigger>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono text-xs text-muted-foreground/60">v{SITE_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-foreground/40">
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('mailto:');
  const cn = 'text-xs text-muted-foreground transition-colors hover:text-foreground';
  return (
    <li>
      {external ? (
        <a href={href} className={cn}>{children}</a>
      ) : (
        <Link href={href} className={cn}>{children}</Link>
      )}
    </li>
  );
}
