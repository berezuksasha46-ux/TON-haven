import { tx } from '../db.js';
import { ITEMS } from './world.js';

const MARKET_FEE = 0.05;
const P2P_FEE = 0.10;

export async function listOnMarket(sellerId, itemId, qty, price, durability = null) {
  if (price < 0.00001 || price > 1000) throw new Error('price-out-of-range');
  return tx(async c => {
    // атомарное списание предмета
    const r = await c.query(
      `UPDATE inventory SET qty = qty - $1
       WHERE id = (SELECT id FROM inventory
                   WHERE player_id=$2 AND item_id=$3 AND qty>=$1 LIMIT 1)
       RETURNING id`,
      [qty, sellerId, itemId]
    );
    if (!r.rowCount) throw new Error('no-items');
    await c.query(
      `INSERT INTO market_listings(seller_id,item_id,qty,price,durability)
       VALUES ($1,$2,$3,$4,$5)`,
      [sellerId, itemId, qty, price, durability]
    );
  });
}

export async function buyFromMarket(buyerId, listingId) {
  return tx(async c => {
    const l = await c.query(
      `SELECT * FROM market_listings WHERE id=$1 FOR UPDATE`, [listingId]
    );
    if (!l.rowCount) throw new Error('listing-gone');
    const L = l.rows[0];
    const buyer = await c.query(`SELECT stars FROM players WHERE id=$1 FOR UPDATE`, [buyerId]);
    if (Number(buyer.rows[0].stars) < Number(L.price)) throw new Error('no-funds');

    const fee = Number(L.price) * MARKET_FEE;
    const payout = Number(L.price) - fee; // fee сгорает
    await c.query(`UPDATE players SET stars = stars - $1 WHERE id=$2`, [L.price, buyerId]);
    await c.query(`UPDATE players SET stars = stars + $1 WHERE id=$2`, [payout, L.seller_id]);
    await c.query(
      `INSERT INTO inventory(player_id,item_id,qty,durability) VALUES ($1,$2,$3,$4)`,
      [buyerId, L.item_id, L.qty, L.durability]
    );
    await c.query(`DELETE FROM market_listings WHERE id=$1`, [listingId]);
    return { paid: L.price, fee_burned: fee };
  });
}

/**
 * P2P трейд: комиссия 10% с перевода звёзд.
 * Окно фиксации (3 сек) на клиенте. Здесь — финальный обмен.
 */
export async function p2pTrade(senderId, receiverId, stars = 0, items = []) {
  const fee = Number(stars) * P2P_FEE;
  const toReceiver = Number(stars) - fee;
  return tx(async c => {
    if (stars > 0) {
      const s = await c.query(`SELECT stars FROM players WHERE id=$1 FOR UPDATE`, [senderId]);
      if (Number(s.rows[0].stars) < stars) throw new Error('no-funds');
      await c.query(`UPDATE players SET stars=stars-$1 WHERE id=$2`, [stars, senderId]);
      await c.query(`UPDATE players SET stars=stars+$1 WHERE id=$2`, [toReceiver, receiverId]);
    }
    for (const it of items) {
      await c.query(
        `UPDATE inventory SET qty=qty-$1 WHERE id=(SELECT id FROM inventory WHERE player_id=$2 AND item_id=$3 AND qty>=$1 LIMIT 1)`,
        [it.qty, senderId, it.item_id]
      );
      await c.query(
        `INSERT INTO inventory(player_id,item_id,qty,durability) VALUES ($1,$2,$3,$4)`,
        [receiverId, it.item_id, it.qty, it.durability ?? null]
      );
    }
    return { sent: stars, fee_burned: fee, received: toReceiver };
  });
}

/**
 * NPC-скупщик: мгновенная скупка «хлама». Возвращает сумму звёзд.
 */
export function scavengerPrice(itemId, qty) {
  const it = ITEMS[itemId];
  if (!it || it.sell == null) return 0;
  return it.sell * qty;
}