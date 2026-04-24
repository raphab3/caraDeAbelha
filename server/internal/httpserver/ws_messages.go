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

type upgradeSkillAction struct {
	Type    string `json:"type"`
	SkillID string `json:"skillId"`
}

type useSkillAction struct {
	Type string `json:"type"`
	Slot int    `json:"slot"`
}

type playerState struct {
	ID             string             `json:"id"`
	Username       string             `json:"username"`
	StageID        string             `json:"stageId,omitempty"`
	X              float64            `json:"x"`
	Y              float64            `json:"y"`
	TargetX        *float64           `json:"targetX,omitempty"`
	TargetY        *float64           `json:"targetY,omitempty"`
	DestinationX   *float64           `json:"destinationX,omitempty"`
	DestinationY   *float64           `json:"destinationY,omitempty"`
	Speed          float64            `json:"speed"`
	CurrentLife    int                `json:"currentLife"`
	MaxLife        int                `json:"maxLife"`
	IsDead         bool               `json:"isDead"`
	CombatTagUntil int64              `json:"combatTagUntil,omitempty"`
	FacingX        float64            `json:"-"`
	FacingY        float64            `json:"-"`
	Route          []movementWaypoint `json:"-"`
	UpdatedAt      time.Time          `json:"-"`
	LastSeenAt     time.Time          `json:"-"`
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
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Role             string  `json:"role"`
	Summary          string  `json:"summary"`
	CostHoney        int     `json:"costHoney"`
	EnergyCostPollen int     `json:"energyCostPollen"`
	BaseCooldownMs   int     `json:"baseCooldownMs"`
	BasePower        float64 `json:"basePower"`
	BaseDistance     float64 `json:"baseDistance"`
	MaxUpgradeLevel  int     `json:"maxUpgradeLevel"`
}

type skillUpgradeMessage struct {
	SkillID           string  `json:"skillId"`
	Level             int     `json:"level"`
	MaxLevel          int     `json:"maxLevel"`
	CurrentCooldownMs int     `json:"currentCooldownMs"`
	CurrentPower      float64 `json:"currentPower"`
	CurrentDistance   float64 `json:"currentDistance"`
	NextCooldownMs    int     `json:"nextCooldownMs"`
	NextPower         float64 `json:"nextPower"`
	NextDistance      float64 `json:"nextDistance"`
	NextUpgradeCost   int     `json:"nextUpgradeCost"`
	CanUpgrade        bool    `json:"canUpgrade"`
}

type skillRuntimeMessage struct {
	Slot           int    `json:"slot"`
	SkillID        string `json:"skillId"`
	State          string `json:"state"`
	CooldownEndsAt int64  `json:"cooldownEndsAt"`
}

type skillEffectMessage struct {
	ID            string  `json:"id"`
	OwnerPlayerID string  `json:"ownerPlayerId"`
	SkillID       string  `json:"skillId"`
	Slot          int     `json:"slot"`
	StageID       string  `json:"stageId"`
	Kind          string  `json:"kind"`
	State         string  `json:"state"`
	FromX         float64 `json:"fromX"`
	FromY         float64 `json:"fromY"`
	ToX           float64 `json:"toX"`
	ToY           float64 `json:"toY"`
	DirectionX    float64 `json:"directionX"`
	DirectionY    float64 `json:"directionY"`
	Radius        float64 `json:"radius"`
	Power         float64 `json:"power"`
	DurationMs    int     `json:"durationMs"`
	StartedAt     int64   `json:"startedAt"`
	ExpiresAt     int64   `json:"expiresAt"`
}

type skillEffectsMessage struct {
	Type    string               `json:"type"`
	Effects []skillEffectMessage `json:"effects"`
}

type combatEventMessage struct {
	Type           string `json:"type"`
	EventID        string `json:"eventId"`
	EventKind      string `json:"eventKind"`
	SourcePlayerID string `json:"sourcePlayerId,omitempty"`
	TargetPlayerID string `json:"targetPlayerId"`
	SkillID        string `json:"skillId,omitempty"`
	Amount         int    `json:"amount"`
	Reason         string `json:"reason,omitempty"`
	Timestamp      int64  `json:"timestamp"`
}

// playerStatusMessage contains the player's progression state: pollen, capacity, honey, level, XP, skill points,
// current zone and unlocked zones. Sent to the player whenever their progress changes.
// This is the server-authoritative source of truth for player economy stats on the client.
type playerStatusMessage struct {
	Type                  string                     `json:"type"`
	PlayerID              string                     `json:"playerId"`
	PollenCarried         int                        `json:"pollenCarried"`
	PollenCapacity        int                        `json:"pollenCapacity"`
	Honey                 int                        `json:"honey"`
	Level                 int                        `json:"level"`
	XP                    int                        `json:"xp"`
	SkillPoints           int                        `json:"skillPoints"`
	CurrentZoneID         string                     `json:"currentZoneId"`
	UnlockedZoneIDs       []string                   `json:"unlockedZoneIds"`
	OwnedSkillIDs         []string                   `json:"ownedSkillIds"`
	EquippedSkills        []string                   `json:"equippedSkills"`
	SkillUpgrades         []skillUpgradeMessage      `json:"skillUpgrades"`
	SkillRuntime          []skillRuntimeMessage      `json:"skillRuntime"`
	SkillCatalog          []skillCatalogEntryMessage `json:"skillCatalog"`
	CurrentLife           int                        `json:"currentLife"`
	MaxLife               int                        `json:"maxLife"`
	IsDead                bool                       `json:"isDead"`
	RespawnEndsAt         int64                      `json:"respawnEndsAt,omitempty"`
	SpawnProtectionEndsAt int64                      `json:"spawnProtectionEndsAt,omitempty"`
}

// interactionResultMessage provides feedback on player actions like collecting flowers or depositing pollen.
// Used to communicate immediate results and errors to the client without inflating the main state snapshot.
// Actions include "collect_flower", "deposit_pollen" and other interaction types.
type interactionResultMessage struct {
	Type       string `json:"type"`
	Action     string `json:"action"`
	Success    bool   `json:"success"`
	Amount     int    `json:"amount"`
	Reason     string `json:"reason"`
	ReasonCode string `json:"reasonCode,omitempty"`
	Timestamp  int64  `json:"timestamp"`
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
			SkillUpgrades:  []skillUpgradeMessage{},
			SkillRuntime:   buildSkillRuntimeMessage(nil),
			SkillCatalog:   buildSkillCatalogMessage(),
			CurrentLife:    defaultMaxPlayerLife,
			MaxLife:        defaultMaxPlayerLife,
		}
	}

	ownedSkillIDs := normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	equippedSkills := normalizeEquippedSkills(progress.EquippedSkills, ownedSkillIDs)
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, ownedSkillIDs)
	progress.SkillRuntime = normalizeSkillRuntime(progress.SkillRuntime, equippedSkills, time.Now())

	return playerStatusMessage{
		Type:                  "player_status",
		PlayerID:              progress.PlayerID,
		PollenCarried:         progress.PollenCarried,
		PollenCapacity:        progress.PollenCapacity,
		Honey:                 progress.Honey,
		Level:                 progress.Level,
		XP:                    progress.XP,
		SkillPoints:           progress.SkillPoints,
		CurrentZoneID:         progress.CurrentZoneID,
		UnlockedZoneIDs:       progress.UnlockedZoneIDs,
		OwnedSkillIDs:         ownedSkillIDs,
		EquippedSkills:        equippedSkills,
		SkillUpgrades:         buildSkillUpgradeMessage(progress.SkillUpgradeLevels, ownedSkillIDs),
		SkillRuntime:          buildSkillRuntimeMessage(progress.SkillRuntime),
		SkillCatalog:          buildSkillCatalogMessage(),
		CurrentLife:           progress.CurrentLife,
		MaxLife:               progress.MaxLife,
		IsDead:                progress.IsDead,
		RespawnEndsAt:         combatTimeMillis(progress.RespawnAt),
		SpawnProtectionEndsAt: combatTimeMillis(progress.SpawnProtectionUntil),
	}
}

func buildSkillUpgradeMessage(skillUpgradeLevels map[string]int, ownedSkillIDs []string) []skillUpgradeMessage {
	message := make([]skillUpgradeMessage, 0, len(ownedSkillIDs))
	for _, skillID := range normalizeOwnedSkillIDs(ownedSkillIDs) {
		definition, ok := findBeeSkillDefinition(skillID)
		if !ok {
			continue
		}
		level := skillUpgradeLevel(skillUpgradeLevels, skillID)
		nextCost, canUpgrade := nextSkillUpgradeCost(skillID, level)
		nextLevel := level
		if canUpgrade {
			nextLevel = level + 1
		}
		message = append(message, skillUpgradeMessage{
			SkillID:           skillID,
			Level:             level,
			MaxLevel:          definition.MaxUpgradeLevel,
			CurrentCooldownMs: int(skillCooldownForSkillLevel(skillID, level) / time.Millisecond),
			CurrentPower:      skillPowerForLevel(skillID, level),
			CurrentDistance:   skillDistanceForLevel(skillID, level),
			NextCooldownMs:    int(skillCooldownForSkillLevel(skillID, nextLevel) / time.Millisecond),
			NextPower:         skillPowerForLevel(skillID, nextLevel),
			NextDistance:      skillDistanceForLevel(skillID, nextLevel),
			NextUpgradeCost:   nextCost,
			CanUpgrade:        canUpgrade,
		})
	}
	return message
}

func buildSkillRuntimeMessage(skillRuntime []loopbase.PlayerSkillRuntime) []skillRuntimeMessage {
	if len(skillRuntime) == 0 {
		message := make([]skillRuntimeMessage, 0, skillSlotCount)
		for slot := 0; slot < skillSlotCount; slot++ {
			message = append(message, skillRuntimeMessage{Slot: slot, State: skillStateReady})
		}
		return message
	}

	message := make([]skillRuntimeMessage, 0, len(skillRuntime))
	for _, entry := range skillRuntime {
		cooldownEndsAt := int64(0)
		if !entry.CooldownEndsAt.IsZero() {
			cooldownEndsAt = entry.CooldownEndsAt.UnixMilli()
		}
		message = append(message, skillRuntimeMessage{
			Slot:           entry.Slot,
			SkillID:        entry.SkillID,
			State:          entry.State,
			CooldownEndsAt: cooldownEndsAt,
		})
	}

	return message
}

func buildSkillCatalogMessage() []skillCatalogEntryMessage {
	catalog := listBeeSkillCatalog()
	message := make([]skillCatalogEntryMessage, 0, len(catalog))
	for _, entry := range catalog {
		message = append(message, skillCatalogEntryMessage{
			ID:               entry.ID,
			Name:             entry.Name,
			Role:             entry.Role,
			Summary:          entry.Summary,
			CostHoney:        entry.CostHoney,
			EnergyCostPollen: entry.EnergyCostPollen,
			BaseCooldownMs:   entry.BaseCooldownMs,
			BasePower:        entry.BasePower,
			BaseDistance:     entry.BaseDistance,
			MaxUpgradeLevel:  entry.MaxUpgradeLevel,
		})
	}

	return message
}

func combatTimeMillis(value time.Time) int64 {
	if value.IsZero() {
		return 0
	}
	return value.UnixMilli()
}

// newInteractionResultMessage creates an interactionResultMessage for feedback.
// Called when a player action completes, either successfully or with an error.
// action: e.g., "collect_flower", "deposit_pollen"
// success: whether the action succeeded
// amount: pollen/honey collected or deposited (0 if failed)
// reason: error message if !success, empty if success
// timestamp: Unix milliseconds
func newInteractionResultMessage(action string, success bool, amount int, reason string, timestamp int64) interactionResultMessage {
	return newInteractionResultMessageWithCode(action, success, amount, reason, "", timestamp)
}

func newInteractionResultMessageWithCode(action string, success bool, amount int, reason string, reasonCode string, timestamp int64) interactionResultMessage {
	return interactionResultMessage{
		Type:       "interaction_result",
		Action:     action,
		Success:    success,
		Amount:     amount,
		Reason:     reason,
		ReasonCode: reasonCode,
		Timestamp:  timestamp,
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
