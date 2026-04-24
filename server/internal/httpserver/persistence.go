package httpserver

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"

	"github.com/lib/pq"
	"github.com/raphab33/cara-de-abelha/server/internal/dbmigrate"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

const persistenceSaveInterval = 5 * time.Second
const persistenceConnectTimeout = 800 * time.Millisecond
const persistenceSaveTimeout = time.Second

type persistedPlayerRecord struct {
	ProfileKey string
	Username   string
	Player     *playerState
	Progress   *loopbase.PlayerProgress
}

type persistenceSnapshot struct {
	ProfileKey string
	Username   string
	Player     playerState
	Progress   loopbase.PlayerProgress
}

type playerStore interface {
	Load(ctx context.Context, profileKey string) (*persistedPlayerRecord, error)
	Save(ctx context.Context, snapshot persistenceSnapshot) error
	Close() error
}

type sqlPlayerStore struct {
	db *sql.DB
}

func newPlayerStoreFromEnv() playerStore {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Printf("player persistence disabled: open database: %v", err)
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), persistenceConnectTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		log.Printf("player persistence disabled: ping database: %v", err)
		return nil
	}

	if err := dbmigrate.Apply(ctx, db); err != nil {
		_ = db.Close()
		log.Printf("player persistence disabled: apply migrations: %v", err)
		return nil
	}

	return &sqlPlayerStore{db: db}
}

func (store *sqlPlayerStore) Load(ctx context.Context, profileKey string) (*persistedPlayerRecord, error) {
	if store == nil || store.db == nil {
		return nil, nil
	}

	row := store.db.QueryRowContext(
		ctx,
		`SELECT player_id, username, COALESCE(current_stage_id, ''), position_x, position_y, speed, pollen_carried, pollen_capacity,
		        honey, level, xp, skill_points, current_zone_id, unlocked_zone_ids, owned_skill_ids, equipped_skills, skill_upgrade_levels,
		        current_energy, max_energy, last_seen_at
		   FROM game_player_profiles
		  WHERE profile_key = $1`,
		profileKey,
	)

	var (
		playerID               string
		username               string
		currentStageID         string
		positionX              float64
		positionY              float64
		speed                  float64
		pollenCarried          int
		pollenCapacity         int
		honey                  int
		level                  int
		xp                     int
		skillPoints            int
		currentZoneID          string
		currentEnergy          int
		maxEnergy              int
		unlockedZoneIDs        pq.StringArray
		ownedSkillIDs          pq.StringArray
		equippedSkills         pq.StringArray
		skillUpgradeLevelsJSON []byte
		lastSeenAt             time.Time
	)

	if err := row.Scan(
		&playerID,
		&username,
		&currentStageID,
		&positionX,
		&positionY,
		&speed,
		&pollenCarried,
		&pollenCapacity,
		&honey,
		&level,
		&xp,
		&skillPoints,
		&currentZoneID,
		&unlockedZoneIDs,
		&ownedSkillIDs,
		&equippedSkills,
		&skillUpgradeLevelsJSON,
		&currentEnergy,
		&maxEnergy,
		&lastSeenAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	skillUpgradeLevels := map[string]int{}
	if len(skillUpgradeLevelsJSON) > 0 {
		if err := json.Unmarshal(skillUpgradeLevelsJSON, &skillUpgradeLevels); err != nil {
			return nil, err
		}
	}

	return &persistedPlayerRecord{
		ProfileKey: profileKey,
		Username:   username,
		Player: &playerState{
			ID:         playerID,
			Username:   username,
			StageID:    currentStageID,
			X:          positionX,
			Y:          positionY,
			Speed:      speed,
			UpdatedAt:  lastSeenAt,
			LastSeenAt: lastSeenAt,
		},
		Progress: &loopbase.PlayerProgress{
			PlayerID:           playerID,
			PollenCarried:      pollenCarried,
			PollenCapacity:     pollenCapacity,
			Honey:              honey,
			Level:              level,
			XP:                 xp,
			SkillPoints:        skillPoints,
			CurrentZoneID:      currentZoneID,
			UnlockedZoneIDs:    append([]string{}, unlockedZoneIDs...),
			OwnedSkillIDs:      normalizeOwnedSkillIDs(append([]string{}, ownedSkillIDs...)),
			EquippedSkills:     normalizeEquippedSkills(append([]string{}, equippedSkills...), append([]string{}, ownedSkillIDs...)),
			SkillUpgradeLevels: normalizeSkillUpgradeLevels(skillUpgradeLevels, append([]string{}, ownedSkillIDs...)),
			CurrentEnergy:      currentEnergy,
			MaxEnergy:          maxEnergy,
			UpdatedAt:          lastSeenAt,
		},
	}, nil
}

func (store *sqlPlayerStore) Save(ctx context.Context, snapshot persistenceSnapshot) error {
	if store == nil || store.db == nil {
		return nil
	}

	skillUpgradeLevelsJSON, err := json.Marshal(normalizeSkillUpgradeLevels(snapshot.Progress.SkillUpgradeLevels, snapshot.Progress.OwnedSkillIDs))
	if err != nil {
		return err
	}

	_, err = store.db.ExecContext(
		ctx,
		`INSERT INTO game_player_profiles (
		    profile_key, player_id, username, position_x, position_y, speed,
		    pollen_carried, pollen_capacity, honey, level, xp, skill_points,
		    current_zone_id, unlocked_zone_ids, owned_skill_ids, equipped_skills, skill_upgrade_levels,
		    current_energy, max_energy, current_stage_id, last_seen_at, updated_at
		) VALUES (
		    $1, $2, $3, $4, $5, $6,
		    $7, $8, $9, $10, $11, $12,
		    $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW()
		)
		ON CONFLICT (profile_key) DO UPDATE SET
		    player_id = EXCLUDED.player_id,
		    username = EXCLUDED.username,
		    position_x = EXCLUDED.position_x,
		    position_y = EXCLUDED.position_y,
		    speed = EXCLUDED.speed,
		    pollen_carried = EXCLUDED.pollen_carried,
		    pollen_capacity = EXCLUDED.pollen_capacity,
		    honey = EXCLUDED.honey,
		    level = EXCLUDED.level,
		    xp = EXCLUDED.xp,
		    skill_points = EXCLUDED.skill_points,
		    current_zone_id = EXCLUDED.current_zone_id,
		    unlocked_zone_ids = EXCLUDED.unlocked_zone_ids,
		    owned_skill_ids = EXCLUDED.owned_skill_ids,
		    equipped_skills = EXCLUDED.equipped_skills,
		    skill_upgrade_levels = EXCLUDED.skill_upgrade_levels,
		    current_energy = EXCLUDED.current_energy,
		    max_energy = EXCLUDED.max_energy,
		    current_stage_id = EXCLUDED.current_stage_id,
		    last_seen_at = EXCLUDED.last_seen_at,
		    updated_at = NOW()`,
		snapshot.ProfileKey,
		snapshot.Player.ID,
		snapshot.Username,
		snapshot.Player.X,
		snapshot.Player.Y,
		snapshot.Player.Speed,
		snapshot.Progress.PollenCarried,
		snapshot.Progress.PollenCapacity,
		snapshot.Progress.Honey,
		snapshot.Progress.Level,
		snapshot.Progress.XP,
		snapshot.Progress.SkillPoints,
		snapshot.Progress.CurrentZoneID,
		pq.Array(snapshot.Progress.UnlockedZoneIDs),
		pq.Array(normalizeOwnedSkillIDs(snapshot.Progress.OwnedSkillIDs)),
		pq.Array(normalizeEquippedSkills(snapshot.Progress.EquippedSkills, snapshot.Progress.OwnedSkillIDs)),
		skillUpgradeLevelsJSON,
		snapshot.Progress.CurrentEnergy,
		snapshot.Progress.MaxEnergy,
		snapshot.Player.StageID,
		snapshot.Player.LastSeenAt,
	)

	return err
}

func (store *sqlPlayerStore) Close() error {
	if store == nil || store.db == nil {
		return nil
	}

	return store.db.Close()
}

func (hub *gameHub) loadPersistedPlayer(profileKey string) *persistedPlayerRecord {
	if hub == nil || hub.playerStore == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), persistenceSaveTimeout)
	defer cancel()

	record, err := hub.playerStore.Load(ctx, profileKey)
	if err != nil {
		log.Printf("player persistence load failed for %s: %v", profileKey, err)
		return nil
	}

	return record
}

func (hub *gameHub) persistPlayerSnapshots(snapshots []persistenceSnapshot) {
	if hub == nil || hub.playerStore == nil || len(snapshots) == 0 {
		return
	}

	for _, snapshot := range snapshots {
		ctx, cancel := context.WithTimeout(context.Background(), persistenceSaveTimeout)
		err := hub.playerStore.Save(ctx, snapshot)
		cancel()
		if err != nil {
			log.Printf("player persistence save failed for %s: %v", snapshot.ProfileKey, err)
		}
	}
}

func (hub *gameHub) collectPersistenceSnapshots() []persistenceSnapshot {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if len(hub.profiles) == 0 {
		return nil
	}

	snapshots := make([]persistenceSnapshot, 0, len(hub.profiles))
	for profileKey, profile := range hub.profiles {
		if profile == nil {
			continue
		}

		progress := hub.playerProgress[profile.ID]
		if progress == nil {
			progress = hub.ensurePlayerProgressLocked(profile.ID)
		}

		snapshots = append(snapshots, persistenceSnapshot{
			ProfileKey: profileKey,
			Username:   profile.Username,
			Player:     *profile,
			Progress:   *progress,
		})
	}

	return snapshots
}

func (hub *gameHub) collectPersistenceSnapshotsByKey(profileKey string) []persistenceSnapshot {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	profile := hub.profiles[profileKey]
	if profile == nil {
		return nil
	}

	progress := hub.playerProgress[profile.ID]
	if progress == nil {
		progress = hub.ensurePlayerProgressLocked(profile.ID)
	}

	return []persistenceSnapshot{{
		ProfileKey: profileKey,
		Username:   profile.Username,
		Player:     *profile,
		Progress:   *progress,
	}}
}

func (hub *gameHub) persistPlayerState(profileKey string) {
	if hub == nil || profileKey == "" {
		return
	}

	hub.persistPlayerSnapshots(hub.collectPersistenceSnapshotsByKey(profileKey))
}

func (hub *gameHub) runPersistenceLoop(interval time.Duration) {
	if hub == nil || hub.playerStore == nil || interval <= 0 {
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		hub.persistPlayerSnapshots(hub.collectPersistenceSnapshots())
	}
}
