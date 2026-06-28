// Dummy DATABASE_URL so packages/db/src/client.ts doesn't throw at module load
// time when tests import from @vire/db. The actual connection is never opened
// for unit tests — those that need DB functions mock them via vi.mock('@vire/db').
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test_vitest';
