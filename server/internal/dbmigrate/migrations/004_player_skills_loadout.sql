ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS owned_skill_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS equipped_skills TEXT[] NOT NULL DEFAULT ARRAY['', '', '', ''];

ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS skill_upgrade_levels JSONB NOT NULL DEFAULT '{}'::JSONB;