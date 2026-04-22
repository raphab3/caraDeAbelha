package httpserver

import (
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

type playerAction struct {
	Type string  `json:"type"`
	Dir  string  `json:"dir,omitempty"`
	X    float64 `json:"x,omitempty"`
	Z    float64 `json:"z,omitempty"`
}

type collectFlowerAction struct {
	Type     string `json:"type"`
	FlowerID string `json:"flowerId"`
}

type depositAction struct {
	Type   string `json:"type"`
	HiveID string `json:"hiveId"`
}

type unlockZoneAction struct {
	Type   string `json:"type"`
	ZoneID string `json:"zoneId"`
}

type playerState struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	X          float64   `json:"x"`
	Y          float64   `json:"y"`
	TargetX    *float64  `json:"targetX,omitempty"`
	TargetY    *float64  `json:"targetY,omitempty"`
	Speed      float64   `json:"speed"`
	UpdatedAt  time.Time `json:"-"`
	LastSeenAt time.Time `json:"-"`
}

type sessionMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

type worldStateMessage struct {
	Type           string            `json:"type"`
	Tick           uint64            `json:"tick"`
	Players        []playerState     `json:"players"`
	Chunks         []worldChunkState `json:"chunks"`
	CenterChunkX   int               `json:"centerChunkX"`
	CenterChunkY   int               `json:"centerChunkY"`
	RenderDistance int               `json:"renderDistance"`
	ChunkSize      float64           `json:"chunkSize"`
}

type worldFlowerState struct {
	ID         string  `json:"id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	GroundY    float64 `json:"groundY"`
	Scale      float64 `json:"scale"`
	PetalColor string  `json:"petalColor"`
	CoreColor  string  `json:"coreColor"`
}

type worldHiveState struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	GroundY   float64 `json:"groundY"`
	Scale     float64 `json:"scale"`
	ToneColor string  `json:"toneColor"`
	GlowColor string  `json:"glowColor"`
}

type worldTileState struct {
	ID   string  `json:"id"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Z    float64 `json:"z"`
	Type string  `json:"type"`
}

type worldTreeState struct {
	ID      string  `json:"id"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	GroundY float64 `json:"groundY"`
	Scale   float64 `json:"scale"`
}

type worldChunkState struct {
	Key     string             `json:"key"`
	X       int                `json:"x"`
	Y       int                `json:"y"`
	Tiles   []worldTileState   `json:"tiles"`
	Flowers []worldFlowerState `json:"flowers"`
	Trees   []worldTreeState   `json:"trees"`
	Hives   []worldHiveState   `json:"hives"`
}

// playerStatusMessage contains the player's progression state: pollen, capacity, honey, level, XP, skill points,
// current zone and unlocked zones. Sent to the player whenever their progress changes.
// This is the server-authoritative source of truth for player economy stats on the client.
type playerStatusMessage struct {
	Type            string   `json:"type"`
	PlayerID        string   `json:"playerId"`
	PollenCarried   int      `json:"pollenCarried"`
	PollenCapacity  int      `json:"pollenCapacity"`
	Honey           int      `json:"honey"`
	Level           int      `json:"level"`
	XP              int      `json:"xp"`
	SkillPoints     int      `json:"skillPoints"`
	CurrentZoneID   string   `json:"currentZoneId"`
	UnlockedZoneIDs []string `json:"unlockedZoneIds"`
}

// interactionResultMessage provides feedback on player actions like collecting flowers or depositing pollen.
// Used to communicate immediate results and errors to the client without inflating the main state snapshot.
// Actions include "collect_flower", "deposit_pollen" and other interaction types.
type interactionResultMessage struct {
	Type      string `json:"type"`
	Action    string `json:"action"`
	Success   bool   `json:"success"`
	Amount    int    `json:"amount"`
	Reason    string `json:"reason"`
	Timestamp int64  `json:"timestamp"`
}

// zoneInfoMessage represents metadata and unlock status for a single zone.
// Included in zoneStateMessage to provide zone details to the client.
type zoneInfoMessage struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	CostHoney      int    `json:"costHoney"`
	IsUnlocked     bool   `json:"isUnlocked"`
	Prerequisites  []string `json:"prerequisites"`
	BoundaryX1     float32 `json:"boundaryX1"`
	BoundaryX2     float32 `json:"boundaryX2"`
	BoundaryY1     float32 `json:"boundaryY1"`
	BoundaryY2     float32 `json:"boundaryY2"`
}

// zoneStateMessage exposes the minimal zone state to clients.
// Contains metadata and unlock status for all zones and the player's unlocked zones.
// Sent on login (after sessionMessage) and when a zone is unlocked.
type zoneStateMessage struct {
	Type           string              `json:"type"`
	Zones          []zoneInfoMessage   `json:"zones"`
	UnlockedZoneIDs []string           `json:"unlockedZoneIds"`
}

type clientSnapshot struct {
	client  *clientSession
	message worldStateMessage
}

// newPlayerStatusMessage creates a playerStatusMessage from a PlayerProgress.
// Called whenever player progress changes (e.g., pollen collection, deposit, level up).
func newPlayerStatusMessage(progress *loopbase.PlayerProgress) playerStatusMessage {
	if progress == nil {
		return playerStatusMessage{
			Type: "player_status",
		}
	}

	return playerStatusMessage{
		Type:            "player_status",
		PlayerID:        progress.PlayerID,
		PollenCarried:   progress.PollenCarried,
		PollenCapacity:  progress.PollenCapacity,
		Honey:           progress.Honey,
		Level:           progress.Level,
		XP:              progress.XP,
		SkillPoints:     progress.SkillPoints,
		CurrentZoneID:   progress.CurrentZoneID,
		UnlockedZoneIDs: progress.UnlockedZoneIDs,
	}
}

// newInteractionResultMessage creates an interactionResultMessage for feedback.
// Called when a player action completes, either successfully or with an error.
// action: e.g., "collect_flower", "deposit_pollen"
// success: whether the action succeeded
// amount: pollen/honey collected or deposited (0 if failed)
// reason: error message if !success, empty if success
// timestamp: Unix milliseconds
func newInteractionResultMessage(action string, success bool, amount int, reason string, timestamp int64) interactionResultMessage {
	return interactionResultMessage{
		Type:      "interaction_result",
		Action:    action,
		Success:   success,
		Amount:    amount,
		Reason:    reason,
		Timestamp: timestamp,
	}
}

// newZoneStateMessage creates a zoneStateMessage containing all zone metadata and unlock status.
// Called on player login and when a zone is unlocked.
// zones: slice of zone definitions from ZoneRegistry
// unlockedZoneIDs: list of zone IDs unlocked by the player
// now: current time for checking zone unlock status
func newZoneStateMessage(zoneList []*zones.ZoneState, unlockedZoneIDs []string, now time.Time) zoneStateMessage {
	zoneInfos := make([]zoneInfoMessage, 0, len(zoneList))

	for _, zone := range zoneList {
		if zone == nil {
			continue
		}

		// Check if this zone is unlocked for the player
		isUnlocked := zone.IsUnlocked(now)

		// Ensure prerequisites is not nil (use empty slice instead)
		prerequisites := zone.Prerequisites
		if prerequisites == nil {
			prerequisites = []string{}
		}

		zoneInfo := zoneInfoMessage{
			ID:            zone.ID,
			Name:          zone.Name,
			CostHoney:     zone.CostHoney,
			IsUnlocked:    isUnlocked,
			Prerequisites: prerequisites,
			BoundaryX1:    zone.BoundaryX1,
			BoundaryX2:    zone.BoundaryX2,
			BoundaryY1:    zone.BoundaryY1,
			BoundaryY2:    zone.BoundaryY2,
		}

		zoneInfos = append(zoneInfos, zoneInfo)
	}

	// Ensure unlockedZoneIDs is not nil
	if unlockedZoneIDs == nil {
		unlockedZoneIDs = []string{}
	}

	return zoneStateMessage{
		Type:            "zone_state",
		Zones:           zoneInfos,
		UnlockedZoneIDs: unlockedZoneIDs,
	}
}
