package httpserver

import (
	"math"
	"testing"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

func addCombatTestPlayer(hub *gameHub, playerID string, x float64, y float64, now time.Time) *playerState {
	player := &playerState{
		ID:         playerID,
		Username:   playerID,
		StageID:    hub.world.stageID,
		X:          x,
		Y:          y,
		Speed:      defaultPlayerSpeed,
		FacingX:    1,
		FacingY:    0,
		UpdatedAt:  now,
		LastSeenAt: now,
	}
	hub.players[playerID] = player
	progress := hub.ensurePlayerProgressLocked(playerID)
	hub.ensurePlayerCombatLocked(player, progress, now)
	return player
}

func TestCombatProjectileDamageAndEnergyCost(t *testing.T) {
	now := time.Date(2026, time.April, 24, 13, 0, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	caster := addCombatTestPlayer(hub, "player:caster", 0.5, 0.5, now)
	target := addCombatTestPlayer(hub, "player:target", 2.0, 0.5, now)
	progress := hub.ensurePlayerProgressLocked(caster.ID)
	progress.PollenCarried = progress.PollenCapacity
	progress.CurrentEnergy = progress.MaxEnergy
	skill, ok := findBeeSkillDefinition("skill:atirar-ferrao")
	if !ok {
		t.Fatalf("expected Atirar Ferrao definition")
	}

	if !hub.consumeSkillEnergyLocked(nil, progress, skill) {
		t.Fatalf("expected enough energy to cast")
	}
	if progress.CurrentEnergy != progress.MaxEnergy-skill.EnergyCostPollen {
		t.Fatalf("expected energy cost %d, got current=%d", skill.EnergyCostPollen, progress.CurrentEnergy)
	}
	if progress.PollenCarried != progress.PollenCapacity {
		t.Fatalf("expected carried pollen to remain %d, got %d", progress.PollenCapacity, progress.PollenCarried)
	}

	effect, ok := hub.triggerAtirarFerraoLocked(caster, 0, now, 0)
	if !ok {
		t.Fatalf("expected projectile effect")
	}
	hit := hub.resolveProjectileHitLocked(caster, effect)
	if hit == nil || hit.ID != target.ID {
		t.Fatalf("expected projectile to hit target, got %#v", hit)
	}

	if !hub.applyDamageLocked(caster, hit, defaultFerraoDamage, skill.ID, now) {
		t.Fatalf("expected projectile damage to apply")
	}
	targetProgress := hub.ensurePlayerProgressLocked(target.ID)
	if targetProgress.CurrentLife != defaultMaxPlayerLife-defaultFerraoDamage {
		t.Fatalf("expected target life %d, got %d", defaultMaxPlayerLife-defaultFerraoDamage, targetProgress.CurrentLife)
	}
}

func TestCombatEnergyRegeneratesOverTime(t *testing.T) {
	now := time.Date(2026, time.April, 24, 13, 1, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	player := addCombatTestPlayer(hub, "player:caster", 0.5, 0.5, now)
	progress := hub.ensurePlayerProgressLocked(player.ID)
	progress.CurrentEnergy = 10
	progress.LastEnergyRegenAt = now

	if !hub.processCombatRuntimeLocked(now.Add(2 * time.Second)) {
		t.Fatalf("expected combat runtime to regenerate energy")
	}
	if progress.CurrentEnergy <= 10 {
		t.Fatalf("expected energy to regenerate, got %d", progress.CurrentEnergy)
	}
}

func TestCombatAreaSlowAndNectarHeal(t *testing.T) {
	now := time.Date(2026, time.April, 24, 13, 5, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	owner := addCombatTestPlayer(hub, "player:owner", 1, 1, now)
	target := addCombatTestPlayer(hub, "player:target", 1.4, 1, now)
	ownerProgress := hub.ensurePlayerProgressLocked(owner.ID)
	ownerProgress.CurrentLife = 60
	hub.syncPlayerCombatStateLocked(owner, ownerProgress)

	hub.activeCombatAreas["slime:test"] = skillEffectMessage{
		ID:            "slime:test",
		OwnerPlayerID: owner.ID,
		SkillID:       "skill:slime-de-mel",
		StageID:       owner.StageID,
		Kind:          "ground-area",
		ToX:           1,
		ToY:           1,
		Radius:        1,
		Power:         1,
		ExpiresAt:     now.Add(time.Second).UnixMilli(),
	}
	hub.activeCombatAreas["flor:test"] = skillEffectMessage{
		ID:            "flor:test",
		OwnerPlayerID: owner.ID,
		SkillID:       "skill:flor-de-nectar",
		StageID:       owner.StageID,
		Kind:          "support-area",
		ToX:           1,
		ToY:           1,
		Radius:        1,
		Power:         1,
		ExpiresAt:     now.Add(time.Second).UnixMilli(),
	}

	if !hub.processCombatRuntimeLocked(now.Add(worldTickInterval)) {
		t.Fatalf("expected combat areas to mutate player combat state")
	}
	targetProgress := hub.ensurePlayerProgressLocked(target.ID)
	if !targetProgress.SlowUntil.After(now) {
		t.Fatalf("expected target slow to be applied")
	}
	if math.Abs(target.Speed-defaultPlayerSpeed*slimeSlowMultiplier) > 0.001 {
		t.Fatalf("expected slowed speed, got %f", target.Speed)
	}
	if ownerProgress.CurrentLife <= 60 {
		t.Fatalf("expected nectar to heal owner, got %d", ownerProgress.CurrentLife)
	}
}

func TestCombatDeathAndAutomaticRespawn(t *testing.T) {
	now := time.Date(2026, time.April, 24, 13, 10, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	attacker := addCombatTestPlayer(hub, "player:attacker", 0.5, 0.5, now)
	target := addCombatTestPlayer(hub, "player:target", 1.5, 0.5, now)
	progress := hub.ensurePlayerProgressLocked(target.ID)
	progress.CurrentLife = 1

	if !hub.applyDamageLocked(attacker, target, 10, "skill:atirar-ferrao", now) {
		t.Fatalf("expected lethal damage to apply")
	}
	if !progress.IsDead || progress.RespawnAt.IsZero() {
		t.Fatalf("expected target to be dead with respawn scheduled")
	}
	if progress.PollenCarried != 0 {
		t.Fatalf("expected death to clear carried pollen")
	}

	if !hub.respawnDeadPlayerLocked(target, progress, progress.RespawnAt) {
		t.Fatalf("expected scheduled respawn to complete")
	}
	if progress.IsDead || progress.CurrentLife != progress.MaxLife {
		t.Fatalf("expected respawn with full life, dead=%v life=%d", progress.IsDead, progress.CurrentLife)
	}
	if !progress.SpawnProtectionUntil.After(progress.RespawnAt) {
		t.Fatalf("expected spawn protection after respawn")
	}
}

func TestCombatReconnectPreservesRespawnWindow(t *testing.T) {
	now := time.Date(2026, time.April, 24, 13, 20, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	player := &playerState{
		ID:         buildPlayerID("beekeeper"),
		Username:   "beekeeper",
		StageID:    hub.world.stageID,
		X:          1,
		Y:          1,
		Speed:      defaultPlayerSpeed,
		FacingX:    1,
		FacingY:    0,
		UpdatedAt:  now,
		LastSeenAt: now,
	}
	hub.profiles["beekeeper"] = player
	hub.players[player.ID] = player
	hub.clients[player.ID] = &clientSession{id: player.ID, profileKey: "beekeeper"}
	hub.playerProgress[player.ID] = &loopbase.PlayerProgress{
		PlayerID:        player.ID,
		PollenCapacity:  40,
		CurrentZoneID:   zones.DefaultCurrentZoneID(),
		UnlockedZoneIDs: zones.DefaultUnlockedZoneIDs(),
		CurrentLife:     0,
		MaxLife:         defaultMaxPlayerLife,
		IsDead:          true,
		RespawnAt:       now.Add(2 * time.Second),
	}

	if ok := hub.unregister(hub.clients[player.ID]); !ok {
		t.Fatalf("expected unregister to succeed before reconnect")
	}

	client, _, err := hub.register(nil, "beekeeper", "beekeeper")
	if err != nil {
		t.Fatalf("expected reconnect register to succeed: %v", err)
	}
	if client == nil {
		t.Fatalf("expected client session on reconnect")
	}

	progress := hub.ensurePlayerProgressLocked(player.ID)
	if !progress.IsDead {
		t.Fatalf("expected death state to persist across reconnect")
	}
	if progress.RespawnAt.IsZero() || !progress.RespawnAt.After(now) {
		t.Fatalf("expected respawn window to remain scheduled after reconnect")
	}
	if !hub.players[player.ID].IsDead {
		t.Fatalf("expected public player state to reflect reconnecting dead player")
	}
	if newPlayerStatusMessage(progress).RespawnEndsAt == 0 {
		t.Fatalf("expected player_status to expose respawn countdown after reconnect")
	}
}
