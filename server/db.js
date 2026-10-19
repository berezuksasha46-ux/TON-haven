import pg from 'pg';
const { Pool } = pg;

// КРИТИЧЕСКИ ВАЖНО: Transaction Pooler (порт 6543) + pgbouncer=true
// Это предотвращает исчерпание соединений Supabase из Node.js [citation:2][citation:29]
const connectionString = process.env.DATABASE_URL?.includes('pooler.supabase.com:6543')
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL?.replace(':5432/', ':6543/') + '?pgbouncer=true&connection_limit=1';

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5, // Маленький пул для Render Free
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.connect((err, client, release) => {
  if (err) console.error('❌ DB Error:', err.message);
  else { console.log('✅ DB Connected (Supavisor:6543)'); release(); }
});