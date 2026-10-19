import pg from 'pg';
const { Pool } = pg;

/**
 * Настройка подключения к базе данных Supabase.
 * Используем Transaction Pooler (порт 6543), чтобы избежать исчерпания соединений.
 * Параметр pgbouncer=true обязателен для правильной работы.
 */
const connectionString = process.env.DATABASE_URL?.includes('pooler.supabase.com:6543')
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL?.replace(':5432/', ':6543/') + '?pgbouncer=true&connection_limit=1';

export const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }, // Обязательно для Supabase
  max: 5, // Ограничение пула для бесплатного тарифа Render
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Проверка подключения при старте
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
  } else {
    console.log('✅ База данных Supabase успешно подключена (порт 6543)');
    release();
  }
});