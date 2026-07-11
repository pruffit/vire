import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding...');

  // User
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'kotlaevdanilcontact@gmail.com', role: 'ARTIST' })
    .onConflictDoUpdate({ target: schema.users.email, set: { role: 'ARTIST' } })
    .returning();

  console.log('User:', user.id);

  // Rights holder
  const [rh] = await db
    .insert(schema.rightsHolders)
    .values({ userId: user.id, displayName: 'Kotlaev Danil' })
    .returning();

  // Artist profile
  const [artist] = await db
    .insert(schema.artistProfiles)
    .values({
      userId: user.id,
      slug: 'kotlaev',
      name: 'Kotlaev Danil',
      bio: 'Независимый музыкант из Москвы. Атмосферная электроника, постпанк, эксперимент.',
      themeTokens: {
        bg: '#0e0d0c',
        text: '#f0ece3',
        accent: '#8b7355',
        grain: true,
        fontSans: 'Inter',
        fontMono: 'JetBrains Mono',
      },
      isActive: true,
      verified: true,
    })
    .onConflictDoUpdate({
      target: schema.artistProfiles.slug,
      set: { name: 'Kotlaev Danil', isActive: true },
    })
    .returning();

  console.log('Artist:', artist.slug);

  // Release 1: альбом
  const [album] = await db
    .insert(schema.releases)
    .values({
      artistProfileId: artist.id,
      title: 'Тёмная материя',
      type: 'ALBUM',
      status: 'PUBLISHED',
      releaseDate: new Date('2024-03-15'),
      description: 'Дебютный альбом. Восемь треков о пространстве между словами.',
      linerNotes: 'Записано дома зимой 2023–2024. Мастеринг — Студия 404, Москва.',
    })
    .returning();

  // Tracks for album
  const albumTracks = [
    { title: 'Пролог', trackNumber: 1, durationSec: 183, status: 'READY' as const },
    { title: 'Статика', trackNumber: 2, durationSec: 247, status: 'READY' as const },
    { title: 'Нулевая точка', trackNumber: 3, durationSec: 312, status: 'READY' as const },
    { title: 'Фрикция', trackNumber: 4, durationSec: 198, isExclusive: true, status: 'READY' as const },
    { title: 'Тёмная материя', trackNumber: 5, durationSec: 421, status: 'READY' as const },
    { title: 'Дрейф', trackNumber: 6, durationSec: 276, status: 'READY' as const },
    { title: 'Остаток', trackNumber: 7, durationSec: 203, isWip: true, status: 'READY' as const },
    { title: 'Эпилог', trackNumber: 8, durationSec: 157, status: 'READY' as const },
  ];

  for (const t of albumTracks) {
    const [track] = await db
      .insert(schema.tracks)
      .values({ releaseId: album.id, ...t })
      .returning();

    await db.insert(schema.trackContributors).values({
      trackId: track.id,
      rightsHolderId: rh.id,
      role: 'PERFORMER',
      payoutShare: '100.00',
    });
  }

  console.log('Album tracks:', albumTracks.length);

  // Release 2: EP
  const [ep] = await db
    .insert(schema.releases)
    .values({
      artistProfileId: artist.id,
      title: 'Сигналы',
      type: 'EP',
      status: 'PUBLISHED',
      releaseDate: new Date('2023-09-01'),
      description: 'Три этюда для синтезатора и голоса.',
    })
    .returning();

  const epTracks = [
    { title: 'Сигнал I', trackNumber: 1, durationSec: 142, status: 'READY' as const },
    { title: 'Сигнал II', trackNumber: 2, durationSec: 198, status: 'READY' as const },
    { title: 'Сигнал III', trackNumber: 3, durationSec: 231, status: 'READY' as const },
  ];

  for (const t of epTracks) {
    const [track] = await db
      .insert(schema.tracks)
      .values({ releaseId: ep.id, ...t })
      .returning();

    await db.insert(schema.trackContributors).values({
      trackId: track.id,
      rightsHolderId: rh.id,
      role: 'PERFORMER',
      payoutShare: '100.00',
    });
  }

  console.log('EP tracks:', epTracks.length);
  console.log('Done. Visit /artists/kotlaev');

  await client.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
