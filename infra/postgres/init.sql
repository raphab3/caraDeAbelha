CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    honey BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_bees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    rarity VARCHAR(16) NOT NULL,
    speed FLOAT NOT NULL,
    capacity INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_tiles (
    player_id UUID REFERENCES players(id),
    x INT NOT NULL,
    y INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (player_id, x, y)
);