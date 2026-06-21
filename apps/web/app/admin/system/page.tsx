import { getSystemMetrics } from '@/lib/system-metrics';
import { getAdminHealth } from '@/lib/admin-health';
import { countSiteOnline } from '@/lib/presence';
import { SystemPanel } from './system-panel';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage() {
  const [system, health, siteOnline] = await Promise.all([
    getSystemMetrics(),
    getAdminHealth(),
    countSiteOnline(),
  ]);

  return <SystemPanel initial={{ system, health, siteOnline }} />;
}
