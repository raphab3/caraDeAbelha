CREATE TABLE IF NOT EXISTS stages (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    active_version_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stage_versions (
    id TEXT PRIMARY KEY,
    stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    version INT NOT NULL,
    source_json JSONB NOT NULL,
    checksum TEXT NOT NULL,
    validation_status TEXT NOT NULL DEFAULT 'valid',
    validation_errors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP,
    activated_at TIMESTAMP,
    UNIQUE(stage_id, version),
    UNIQUE(stage_id, checksum)
);

ALTER TABLE stages
    ADD CONSTRAINT stages_active_version_fk
    FOREIGN KEY (active_version_id)
    REFERENCES stage_versions(id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS game_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stage_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    stage_id TEXT,
    version_id TEXT,
    actor TEXT NOT NULL DEFAULT 'system',
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS current_stage_id TEXT NOT NULL DEFAULT 'stage:starter-basin';
