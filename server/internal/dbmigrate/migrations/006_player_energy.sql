ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS current_energy INT NOT NULL DEFAULT 100;

ALTER TABLE game_player_profiles
    ADD COLUMN IF NOT EXISTS max_energy INT NOT NULL DEFAULT 100;