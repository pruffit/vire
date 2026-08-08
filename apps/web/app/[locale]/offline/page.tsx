import type { Metadata } from 'next';
import { PageContainer } from '@/components/page-container';
import { OfflineScreen } from './offline-screen';

export const metadata: Metadata = {
  title: 'Скачанное',
  robots: { index: false, follow: false },
};

// Прекэшируется в install-хендлере sw.js и служит фолбэком навигации без сети —
// никаких auth()/БД/серверных данных, иначе офлайн не отдастся вовсе. Вся логика
// (IndexedDB, Cache Storage, navigator.onLine) — в клиентском OfflineScreen.
export default function OfflinePage() {
  return (
    <PageContainer variant="compact">
      <OfflineScreen />
    </PageContainer>
  );
}
