ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS skill_upgrade_levels JSONB NOT NULL DEFAULT '{}'::JSONB;