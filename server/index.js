import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { pool } from './db.js';
import { verifyTelegramInitData, signToken, authMiddleware } from './auth.js';
import { initSockets } from './sockets.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('client'));

app.post('/api/auth', async (req, res) => {
  const { initData, devTgId } = req.body;
  const tgUser = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  const tgId = tgUser?.id || Number(devTgId);
  if (!tgId) return res.status(400).json({ error: 'no user' });

  try {
    const r = await pool.query(
      `INSERT INTO players(tg_id, username) VALUES($1,$2)
       ON CONFLICT(tg_id) DO UPDATE SET username=EXCLUDED.username RETURNING *`,
      [tgId, tgUser?.username || 'player'+tgId]
    );
    res.json({ token: signToken({ id: r.rows[0].id }), player: r.rows[0] });
  } catch (e) {
    console.error('DB Error:', e.message);
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/inventory', authMiddleware, async (req, res) => {
  const r = await pool.query(`SELECT * FROM inventory WHERE player_id=$1`, [req.player.id]);
  res.json(r.rows);
});

app.get('/health', (_, res) => res.send('ok'));

const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 TON Haven on :${PORT}`));