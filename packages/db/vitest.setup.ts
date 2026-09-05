// Клиент читает DATABASE_URL в момент импорта, поэтому подменять адрес надо здесь —
// setup-файл выполняется раньше, чем тест затянет query-модуль и через него client.ts.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://vire:vire@127.0.0.1:5432/vire_test';
