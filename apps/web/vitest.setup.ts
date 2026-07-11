// Dummy DATABASE_URL — иначе packages/db/src/client.ts бросает на импорте @vire/db;
// реальное соединение в юнит-тестах не открывается (vi.mock('@vire/db')).
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test_vitest';
