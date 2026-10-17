-- USERS & PLAYERS
CREATE TABLE IF NOT EXISTS players (
  id           BIGSERIAL PRIMARY KEY,
  tg_id        BIGINT UNIQUE NOT NULL,
  username     TEXT,
  hp           INT NOT NULL DEFAULT 100,
  max_hp       INT NOT NULL DEFAULT 100,
  stars        NUMERIC(12,5) NOT NULL DEFAULT 0,
  clan_id      BIGINT,
  island_size  INT NOT NULL DEFAULT 5,      -- 5,8,12
  isle_x       INT NOT NULL DEFAULT 0,
  isle_y       INT NOT NULL DEFAULT 0,
  pk_kills     INT NOT NULL DEFAULT 0,
  red_until    TIMESTAMPTZ,
  last_food_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id        BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL,
  qty       INT  NOT NULL DEFAULT 1,
  durability INT,                 -- NULL = вечный
  equipped  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_inv_player ON inventory(player_id);

CREATE TABLE IF NOT EXISTS islands (
  id        BIGSERIAL PRIMARY KEY,
  owner_id  BIGINT NOT NULL REFERENCES players(id),
  name      TEXT NOT NULL,
  size      INT NOT NULL DEFAULT 5,
  likes     INT NOT NULL DEFAULT 0,
  week_likes INT NOT NULL DEFAULT 0,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb   -- клетки, объекты
);
CREATE INDEX IF NOT EXISTS ix_isl_owner ON islands(owner_id);

CREATE TABLE IF NOT EXISTS clans (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT UNIQUE NOT NULL,
  owner_id BIGINT NOT NULL REFERENCES players(id),
  members  BIGINT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_listings (
  id        BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES players(id),
  item_id   TEXT NOT NULL,
  qty       INT NOT NULL,
  price     NUMERIC(12,5) NOT NULL CHECK (price BETWEEN 0.00001 AND 1000),
  durability INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id        BIGSERIAL PRIMARY KEY,
  channel   TEXT NOT NULL,   -- local | island | trade
  player_id BIGINT NOT NULL,
  username  TEXT,
  message   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_chat_created ON chats(created_at DESC);