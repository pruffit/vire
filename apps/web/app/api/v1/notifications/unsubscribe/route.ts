import { NextResponse } from 'next/server';
import { updateUserNotifyEmail } from '@vire/db';
import { verifyNotifyUnsub } from '@/lib/notify-unsubscribe';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  if (!uid || !token || !verifyNotifyUnsub(uid, token)) {
    return new NextResponse('Неверная ссылка отписки', { status: 400 });
  }
  await updateUserNotifyEmail(uid, false);
  return new NextResponse('Вы отписаны от email-уведомлений Vire.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
