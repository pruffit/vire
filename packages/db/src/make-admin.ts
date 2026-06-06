import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Grant a role to an existing user by email — bootstraps the first admin
// without hand-editing the DB.
//   pnpm --filter @vire/db db:make-admin <email> [role]
type Role = 'LISTENER' | 'ARTIST' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';
const ROLES: Role[] = ['LISTENER', 'ARTIST', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'SUPERADMIN') as Role;

  if (!email) {
    console.error('Usage: pnpm --filter @vire/db db:make-admin <email> [role]');
    console.error(`  role: ${ROLES.join(' | ')} (default: SUPERADMIN)`);
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Use one of: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  const rows = await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.email, email))
    .returning({ email: schema.users.email, role: schema.users.role });

  await client.end();

  if (rows.length === 0) {
    console.error(`No user with email "${email}". They must sign in at least once first.`);
    process.exit(1);
  }

  console.log(`✓ ${rows[0].email} → ${rows[0].role}`);
  console.log('Note: the user must sign out and back in — the JWT role is set at login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
