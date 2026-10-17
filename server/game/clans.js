import { tx } from '../db.js';

const CREATE_COST = 10;
const MAX_MEMBERS = 15;
const MIN_MEMBERS = 10;

export async function createClan(playerId, name) {
  return tx(async c => {
    const p = await c.query(`SELECT stars FROM players WHERE id=$1 FOR UPDATE`, [playerId]);
    if (Number(p.rows[0].stars) < CREATE_COST) throw new Error('no-stars');
    await c.query(`UPDATE players SET stars=stars-$1 WHERE id=$2`, [CREATE_COST, playerId]);
    const r = await c.query(
      `INSERT INTO clans(name, owner_id, members) VALUES ($1,$2,ARRAY[$2]::bigint[]) RETURNING id`,
      [name, playerId]
    );
    const clanId = r.rows[0].id;
    await c.query(`UPDATE players SET clan_id=$1 WHERE id=$2`, [clanId, playerId]);
    return clanId;
  });
}

export async function inviteToClan(clanId, playerId) {
  return tx(async c => {
    const cl = await c.query(`SELECT * FROM clans WHERE id=$1 FOR UPDATE`, [clanId]);
    if (!cl.rowCount) throw new Error('no-clan');
    const members = cl.rows[0].members;
    if (members.length >= MAX_MEMBERS) throw new Error('full');
    if (members.includes(playerId)) return;
    await c.query(`UPDATE clans SET members = array_append(members,$1) WHERE id=$2`, [playerId, clanId]);
    await c.query(`UPDATE players SET clan_id=$1 WHERE id=$2`, [clanId, playerId]);
  });
}

export function canParticipateInWars(clan) {
  return clan.members.length >= MIN_MEMBERS;
}