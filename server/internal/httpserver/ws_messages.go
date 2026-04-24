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

type buySkillAction struct {
	Type    string `json:"type"`
	SkillID string `json:"skillId"`
}

type equipSkillAction struct {
	Type    string `json:"type"`
	SkillID string `json:"skillId"`
	Slot    int    `json:"slot"`
}

type playerState struct {
	ID           string             `json:"id"`
	Username     string             `json:"username"`
	StageID      string             `json:"stageId,omitempty"`
	X            float64            `json:"x"`
	Y            float64            `json:"y"`
	TargetX      *float64           `json:"targetX,omitempty"`
	TargetY      *float64           `json:"targetY,omitempty"`
	DestinationX *float64           `json:"destinationX,omitempty"`
	DestinationY *float64           `json:"destinationY,omitempty"`
	Speed        float64            `json:"speed"`
	Route        []movementWaypoint `json:"-"`
	UpdatedAt    time.Time          `json:"-"`
	LastSeenAt   time.Time          `json:"-"`
}

type sessionMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

type worldStateMessage struct {
	Type           string               `json:"type"`
	Tick           uint64               `json:"tick"`
	StageID        string               `json:"stageId,omitempty"`
	StageName      string               `json:"stageName,omitempty"`
	AudioBGM       string               `json:"audioBgm,omitempty"`
	Players        []playerState        `json:"players"`
	Chunks         []worldChunkState    `json:"chunks"`
	Props          []worldPropState     `json:"props,omitempty"`
	Landmarks      []worldLandmarkState `json:"landmarks,omitempty"`
	CenterChunkX   int                  `json:"centerChunkX"`
	CenterChunkY   int                  `json:"centerChunkY"`
	RenderDistance int                  `json:"renderDistance"`
	ChunkSize      float64              `json:"chunkSize"`
}

type worldPropState struct {
	ID        string  `json:"id"`
	PrefabID  string  `json:"prefabId"`
	AssetPath string  `json:"assetPath"`
	Category  string  `json:"category"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Z         float64 `json:"z"`
	Scale     float64 `json:"scale"`
	Yaw       float64 `json:"yaw"`
	ZoneID    string  `json:"zoneId,omitempty"`
	Tag       string  `json:"tag,omitempty"`
}

type worldLandmarkState struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Z           float64 `json:"z"`
	ZoneID      string  `json:"zoneId,omitempty"`
	Tag         string  `json:"tag,omitempty"`
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

type skillCatalogEntryMessage struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	Summary   string `json:"summary"`
	CostHoney int    `json:"costHoney"`
}

// playerStatusMessage contains the player's progression state: pollen, capacity, honey, level, XP, skill points,
// current zone and unlocked zones. Sent to the player whenever their progress changes.
// This is the server-authoritative source of truth for player economy stats on the client.
type playerStatusMessage struct {
	Type            string                     `json:"type"`
	PlayerID        string                     `json:"playerId"`
	PollenCarried   int                        `json:"pollenCarried"`
	PollenCapacity  int                        `json:"pollenCapacity"`
	Honey           int                        `json:"honey"`
	Level           int                        `json:"level"`
	XP              int                        `json:"xp"`
	SkillPoints     int                        `json:"skillPoints"`
	CurrentZoneID   string                     `json:"currentZoneId"`
	UnlockedZoneIDs []string                   `json:"unlockedZoneIds"`
	OwnedSkillIDs   []string                   `json:"ownedSkillIds"`
	EquippedSkills  []string                   `json:"equippedSkills"`
	SkillCatalog    []skillCatalogEntryMessage `json:"skillCatalog"`
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
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	CostHoney     int      `json:"costHoney"`
	IsUnlocked    bool     `json:"isUnlocked"`
	Prerequisites []string `json:"prerequisites"`
	BoundaryX1    float32  `json:"boundaryX1"`
	BoundaryX2    float32  `json:"boundaryX2"`
	BoundaryY1    float32  `json:"boundaryY1"`
	BoundaryY2    float32  `json:"boundaryY2"`
}

// zoneStateMessage exposes the minimal zone state to clients.
// Contains metadata and unlock status for all zones and the player's unlocked zones.
// Sent on login (after sessionMessage) and when a zone is unlocked.
type zoneStateMessage struct {
	Type            string            `json:"type"`
	Zones           []zoneInfoMessage `json:"zones"`
	UnlockedZoneIDs []string          `json:"unlockedZoneIds"`
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
			Type:           "player_status",
			OwnedSkillIDs:  []string{},
			EquippedSkills: make([]string, skillSlotCount),
			SkillCatalog:   buildSkillCatalogMessage(),
		}
	}

	ownedSkillIDs := normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	equippedSkills := normalizeEquippedSkills(progress.EquippedSkills, ownedSkillIDs)

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
		OwnedSkillIDs:   ownedSkillIDs,
		EquippedSkills:  equippedSkills,
		SkillCatalog:    buildSkillCatalogMessage(),
	}
}

func buildSkillCatalogMessage() []skillCatalogEntryMessage {
	catalog := listBeeSkillCatalog()
	message := make([]skillCatalogEntryMessage, 0, len(catalog))
	for _, entry := range catalog {
		message = append(message, skillCatalogEntryMessage{
			ID:        entry.ID,
			Name:      entry.Name,
			Role:      entry.Role,
			Summary:   entry.Summary,
			CostHoney: entry.CostHoney,
		})
	}

	return message
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
	normalizedUnlockedZoneIDs := zones.NormalizeZoneIDs(unlockedZoneIDs)

	for _, zone := range zoneList {
		if zone == nil {
			continue
		}

		isUnlocked := zone.IsUnlockedForPlayer(normalizedUnlockedZoneIDs)

		// Ensure prerequisites is not nil (use empty slice instead)
		prerequisites := zone.RequiredZoneIDs
		if prerequisites == nil {
			prerequisites = []string{}
		}

		zoneInfo := zoneInfoMessage{
			ID:            zone.ZoneID,
			Name:          zone.DisplayName,
			CostHoney:     zone.UnlockHoneyCost,
			IsUnlocked:    isUnlocked,
			Prerequisites: prerequisites,
			BoundaryX1:    zone.Bounds.MinX,
			BoundaryX2:    zone.Bounds.MaxX,
			BoundaryY1:    zone.Bounds.MinY,
			BoundaryY2:    zone.Bounds.MaxY,
		}

		zoneInfos = append(zoneInfos, zoneInfo)
	}

	return zoneStateMessage{
		Type:            "zone_state",
		Zones:           zoneInfos,
		UnlockedZoneIDs: normalizedUnlockedZoneIDs,
	}
}
