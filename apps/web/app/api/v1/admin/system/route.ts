import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/require-access';
import { getSystemMetrics } from '@/lib/system-metrics';
import { getAdminHealth } from '@/lib/admin-health';
import { countSiteOnline } from '@/lib/presence';

/** Живой снимок состояния платформы для админ-панели «Система». Поллится клиентом. */
export async function GET() {
  const access = await requireAccess('admin.read');
  if (!access.ok) return access.response;

  const [system, health, siteOnline] = await Promise.all([
    getSystemMetrics(),
    getAdminHealth(),
    countSiteOnline(),
  ]);

  return NextResponse.json({ system, health, siteOnline, ts: Date.now() });
}
