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

CREATE TABLE IF NOT EXISTS game_player_profiles (
    profile_key TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    username VARCHAR(32) NOT NULL,
    position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed DOUBLE PRECISION NOT NULL DEFAULT 3,
    pollen_carried INT NOT NULL DEFAULT 0,
    pollen_capacity INT NOT NULL DEFAULT 40,
    honey INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    xp INT NOT NULL DEFAULT 0,
    skill_points INT NOT NULL DEFAULT 1,
    current_zone_id TEXT NOT NULL DEFAULT 'zone:starter_meadow',
    unlocked_zone_ids TEXT[] NOT NULL DEFAULT ARRAY['zone:starter_meadow'],
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);