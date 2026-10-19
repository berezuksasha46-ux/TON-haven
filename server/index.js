import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { initSockets } from './sockets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Раздаем статику из папки client
app.use(express.static(path.join(__dirname, '../client')));

// Авторизация
app.post('/api/auth', async (req, res) => {
  const { devTgId } = req.body;
  const tgId = devTgId || Math.floor(Math.random() * 1000000); // Fallback для тестов

  try {
    // Ищем игрока или создаем нового
    let result = await pool.query('SELECT * FROM players WHERE tg_id = $1', [tgId]);
    let player;

    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO players (tg_id, username) VALUES ($1, $2) RETURNING *',
        [tgId, 'Player_' + tgId]
      );
      player = result.rows[0];
      // Выдаем стартовый инвентарь
      await pool.query(
        'INSERT INTO inventory (player_id, item_id, qty) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7)',
        [player.id, 'apple', 3, 'shield_wood', 1, 'wood', 5]
      );
    } else {
      player = result.rows[0];
    }

    // Возвращаем ID игрока (в реальном проекте здесь был бы JWT токен)
    res.json({ playerId: player.id, player });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

app.get('/health', (_, res) => res.send('OK'));

const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));