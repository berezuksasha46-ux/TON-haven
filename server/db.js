import pg from 'pg';
const { Pool } = pg;

// Пул соединений с базой данных (Supabase)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Обязательно для Supabase
});

// Проверка подключения при старте
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
  } else {
    console.log('✅ База данных Supabase подключена успешно');
    release();
  }
});