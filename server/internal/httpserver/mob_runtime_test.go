package httpserver

import (
	"testing"
	"time"
)

func configureMobTestRuntime(hub *gameHub, config worldMobConfig) {
	hub.world.mobs = config
	hub.initializeWorldMobs()
	hub.syncDefaultStageRuntimeLocked()
}

func firstActiveMob(t *testing.T, hub *gameHub) *activeMobRuntime {
	t.Helper()
	for _, mob := range hub.activeMobs {
		if mob != nil && !mob.State.IsDead {
			return mob
		}
	}

	t.Fatal("expected at least one active mob")
	return nil
}

func TestMobKillRewardsAndRespawn(t *testing.T) {
	now := time.Date(2026, time.April, 24, 15, 0, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	configureMobTestRuntime(hub, worldMobConfig{
		MeleeCount:   1,
		MoveRadius:   3.5,
		PursuitLevel: 3,
		MinLevel:     2,
		MaxLevel:     2,
	})

	mob := firstActiveMob(t, hub)
	player := addCombatTestPlayer(hub, "player:hunter", mob.State.X, mob.State.Y, now)
	progress := hub.ensurePlayerProgressLocked(player.ID)
	progress.Honey = 0
	progress.XP = 0

	if !hub.applyDamageToMobLocked(player, mob, mob.State.MaxLife, "skill:atirar-ferrao", now) {
		t.Fatalf("expected mob damage to apply")
	}
	if !mob.State.IsDead {
		t.Fatalf("expected mob to die")
	}
	if mob.RespawnAt.IsZero() {
		t.Fatalf("expected mob respawn to be scheduled")
	}
	if progress.Honey <= 0 {
		t.Fatalf("expected honey reward after kill, got %d", progress.Honey)
	}
	if progress.XP <= 0 {
		t.Fatalf("expected xp reward after kill, got %d", progress.XP)
	}

	if !hub.processMobRuntimeLocked(mob.RespawnAt) {
		t.Fatalf("expected mob runtime to respawn mob")
	}
	if mob.State.IsDead {
		t.Fatalf("expected mob to respawn alive")
	}
	if mob.State.CurrentLife != mob.State.MaxLife {
		t.Fatalf("expected mob life restored on respawn, got %d/%d", mob.State.CurrentLife, mob.State.MaxLife)
	}
}

func TestRangedMobAttacksNearbyPlayer(t *testing.T) {
	now := time.Date(2026, time.April, 24, 15, 10, 0, 0, time.UTC)
	hub := newRuntimeTestHub(now)
	configureMobTestRuntime(hub, worldMobConfig{
		RangedCount:  1,
		MoveRadius:   4,
		PursuitLevel: 5,
		MinLevel:     3,
		MaxLevel:     3,
	})

	mob := firstActiveMob(t, hub)
	player := addCombatTestPlayer(hub, "player:target", mob.State.X+2.2, mob.State.Y, now)
	progress := hub.ensurePlayerProgressLocked(player.ID)
	startingLife := progress.CurrentLife

	if !hub.processMobRuntimeLocked(now) {
		t.Fatalf("expected ranged mob runtime to attack or move")
	}
	if progress.CurrentLife >= startingLife {
		t.Fatalf("expected ranged mob to damage player, got %d from %d", progress.CurrentLife, startingLife)
	}
	if mob.LastAttackAt.IsZero() {
		t.Fatalf("expected ranged mob attack cooldown to start")
	}
	if mob.TargetPlayerID != player.ID {
		t.Fatalf("expected ranged mob to lock on nearby player")
	}
}
