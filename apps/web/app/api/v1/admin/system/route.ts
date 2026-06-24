import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSystemMetrics } from '@/lib/system-metrics';
import { getAdminHealth } from '@/lib/admin-health';
import { countSiteOnline } from '@/lib/presence';

const ADMIN_ROLES = new Set<string>(['VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN']);

/** Живой снимок состояния платформы для админ-панели «Система». Поллится клиентом. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.role || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [system, health, siteOnline] = await Promise.all([
    getSystemMetrics(),
    getAdminHealth(),
    countSiteOnline(),
  ]);

  return NextResponse.json({ system, health, siteOnline, ts: Date.now() });
}
