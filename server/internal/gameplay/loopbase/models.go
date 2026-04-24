package loopbase

import "time"

type PlayerSkillRuntime struct {
	Slot           int       `json:"slot"`
	SkillID        string    `json:"skillId"`
	State          string    `json:"state"`
	CooldownEndsAt time.Time `json:"cooldownEndsAt"`
}

// PlayerProgress tracks the player's economy state: pollen carried, capacity, honey accumulated,
// level, XP, skill points, and zone access.
// This model is authoritative on the server and sent to the client as player_status.
type PlayerProgress struct {
	PlayerID        string    `json:"playerId"`
	PollenCarried   int       `json:"pollenCarried"`
	PollenCapacity  int       `json:"pollenCapacity"`
	Honey           int       `json:"honey"`
	Level           int       `json:"level"`
	XP              int       `json:"xp"`
	SkillPoints     int       `json:"skillPoints"`
	CurrentZoneID   string    `json:"currentZoneId"`
	UnlockedZoneIDs []string  `json:"unlockedZoneIds"`
	OwnedSkillIDs   []string  `json:"ownedSkillIds"`
	EquippedSkills  []string  `json:"equippedSkills"`
	SkillUpgradeLevels map[string]int `json:"skillUpgradeLevels"`
	SkillRuntime    []PlayerSkillRuntime `json:"skillRuntime"`
	UpdatedAt       time.Time `json:"-"`
}

// FlowerNode represents a world flower that players can collect pollen from.
// Flowers have limited pollen availability, regeneration mechanics, and an interaction radius.
// Server-authoritative: respawning, pollen depletion, and collection validation happen here.
type FlowerNode struct {
	ID              string    `json:"id"`
	X               float64   `json:"x"`
	Y               float64   `json:"y"`
	GroundY         float64   `json:"groundY"`
	ZoneID          string    `json:"zoneId"`
	PollenAvailable int       `json:"pollenAvailable"`
	PollenCapacity  int       `json:"pollenCapacity"`
	CollectRadius   float64   `json:"collectRadius"`
	RegenPerSecond  float64   `json:"regenPerSecond"`
	YieldPerClick   int       `json:"yieldPerClick"`
	LastRegenAt     time.Time `json:"-"`
	UpdatedAt       time.Time `json:"-"`
}

// HiveNode represents a player's collection point with automatic pollen-to-honey conversion.
// When a player enters the DepositRadius, pollen is converted to honey using ConversionRate.
// Server-authoritative: conversions happen here, not on the client.
type HiveNode struct {
	ID             string    `json:"id"`
	X              float64   `json:"x"`
	Y              float64   `json:"y"`
	GroundY        float64   `json:"groundY"`
	ZoneID         string    `json:"zoneId"`
	DepositRadius  float64   `json:"depositRadius"`
	ConversionRate int       `json:"conversionRate"`
	UpdatedAt      time.Time `json:"-"`
}
