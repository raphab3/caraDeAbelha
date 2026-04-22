package httpserver

import (
	"math/rand"
	"testing"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

func newRuntimeTestHub(now time.Time) *gameHub {
	loopbaseService := loopbase.NewLoopBaseService()
	zonesService := zones.NewZoneService()
	loopbaseService.SetZoneChecker(zonesService)

	hub := &gameHub{
		clients:        make(map[string]*clientSession),
		players:        make(map[string]*playerState),
		profiles:       make(map[string]*playerState),
		playerProgress: make(map[string]*loopbase.PlayerProgress),
		world:          loadWorldLayout(),
		loopbase:       loopbaseService,
		zones:          zonesService,
		random:         rand.New(rand.NewSource(1)),
		now: func() time.Time {
			return now
		},
	}

	hub.initializeWorldEntities()
	return hub
}

func firstActiveFlower(t *testing.T, hub *gameHub) *activeFlowerRuntime {
	t.Helper()
	for _, flower := range hub.activeFlowers {
		if flower != nil && flower.Available {
			return flower
		}
	}

	t.Fatal("expected at least one active flower")
	return nil
}

func firstActiveHive(t *testing.T, hub *gameHub) *activeHiveRuntime {
	t.Helper()
	for _, hive := range hub.activeHives {
		if hive != nil {
			return hive
		}
	}

	t.Fatal("expected at least one active hive")
	return nil
}

func TestProcessWorldInteractionsCollectsFlowerAfterTouchDuration(t *testing.T) {
	baseTime := time.Date(2026, time.April, 22, 15, 0, 0, 0, time.UTC)
	hub := newRuntimeTestHub(baseTime)
	flower := firstActiveFlower(t, hub)
	playerID := "player:test:collector"
	player := &playerState{
		ID:         playerID,
		Username:   "collector",
		X:          flower.Node.X,
		Y:          flower.Node.Y,
		Speed:      defaultPlayerSpeed,
		UpdatedAt:  baseTime,
		LastSeenAt: baseTime,
	}
	hub.players[playerID] = player
	hub.profiles["collector"] = player
	progress := hub.ensurePlayerProgressLocked(playerID)

	if changed := hub.processWorldInteractionsLocked(baseTime); changed {
		t.Fatalf("expected initial collection start to avoid world mutation until the timer completes")
	}

	collection := hub.activeCollections[playerID]
	if collection == nil {
		t.Fatalf("expected collection state to be created")
	}

	if changed := hub.processWorldInteractionsLocked(collection.CompleteAt); !changed {
		t.Fatalf("expected completed collection to mutate world state")
	}

	if progress.PollenCarried <= 0 {
		t.Fatalf("expected pollen to increase after collection, got %d", progress.PollenCarried)
	}

	if progress.XP <= 0 {
		t.Fatalf("expected XP to increase after collection, got %d", progress.XP)
	}

	if flower.Available {
		t.Fatalf("expected collected flower to disappear until respawn")
	}

	if flower.RespawnAt.Before(collection.CompleteAt.Add(15*time.Second)) || flower.RespawnAt.After(collection.CompleteAt.Add(45*time.Second)) {
		t.Fatalf("expected respawn window between 15s and 45s, got %v", flower.RespawnAt.Sub(collection.CompleteAt))
	}
}

func TestProcessWorldInteractionsDepositsHoneyAutomatically(t *testing.T) {
	baseTime := time.Date(2026, time.April, 22, 15, 5, 0, 0, time.UTC)
	hub := newRuntimeTestHub(baseTime)
	hive := firstActiveHive(t, hub)
	playerID := "player:test:beekeeper"
	player := &playerState{
		ID:         playerID,
		Username:   "beekeeper",
		X:          hive.Node.X,
		Y:          hive.Node.Y,
		Speed:      defaultPlayerSpeed,
		UpdatedAt:  baseTime,
		LastSeenAt: baseTime,
	}
	hub.players[playerID] = player
	hub.profiles["beekeeper"] = player
	progress := hub.ensurePlayerProgressLocked(playerID)
	progress.PollenCarried = 20

	if changed := hub.processWorldInteractionsLocked(baseTime); !changed {
		t.Fatalf("expected hive proximity to convert pollen into honey")
	}

	if progress.PollenCarried != 0 {
		t.Fatalf("expected pollen to be cleared after deposit, got %d", progress.PollenCarried)
	}

	if progress.Honey != 2 {
		t.Fatalf("expected 2 honey after converting 20 pollen, got %d", progress.Honey)
	}

	if progress.XP <= 0 {
		t.Fatalf("expected deposit to award XP, got %d", progress.XP)
	}
}

func TestRespawnFlowersLockedReactivatesFlower(t *testing.T) {
	baseTime := time.Date(2026, time.April, 22, 15, 10, 0, 0, time.UTC)
	hub := newRuntimeTestHub(baseTime)
	flower := firstActiveFlower(t, hub)
	flower.Available = false
	flower.Node.PollenAvailable = 0
	flower.RespawnAt = baseTime

	if changed := hub.respawnFlowersLocked(baseTime); !changed {
		t.Fatalf("expected respawn to reactivate an unavailable flower")
	}

	if !flower.Available {
		t.Fatalf("expected flower to become available again")
	}

	if flower.Node.PollenAvailable <= 0 {
		t.Fatalf("expected respawn to restore pollen availability, got %d", flower.Node.PollenAvailable)
	}

	if !flower.RespawnAt.IsZero() {
		t.Fatalf("expected respawn timestamp to be cleared after reactivation")
	}
}

func TestProcessWorldInteractionsAwardsXPWithFullBag(t *testing.T) {
	baseTime := time.Date(2026, time.April, 22, 15, 15, 0, 0, time.UTC)
	hub := newRuntimeTestHub(baseTime)
	flower := firstActiveFlower(t, hub)
	playerID := "player:test:fullbag"
	player := &playerState{
		ID:         playerID,
		Username:   "fullbag",
		X:          flower.Node.X,
		Y:          flower.Node.Y,
		Speed:      defaultPlayerSpeed,
		UpdatedAt:  baseTime,
		LastSeenAt: baseTime,
	}
	hub.players[playerID] = player
	hub.profiles["fullbag"] = player
	progress := hub.ensurePlayerProgressLocked(playerID)
	progress.PollenCarried = progress.PollenCapacity

	hub.processWorldInteractionsLocked(baseTime)
	collection := hub.activeCollections[playerID]
	if collection == nil {
		t.Fatalf("expected collection to start even with full bag")
	}

	if changed := hub.processWorldInteractionsLocked(collection.CompleteAt); !changed {
		t.Fatalf("expected full-bag collection to still mutate world state")
	}

	if progress.PollenCarried != progress.PollenCapacity {
		t.Fatalf("expected pollen to stay capped at %d, got %d", progress.PollenCapacity, progress.PollenCarried)
	}

	if progress.XP <= 0 {
		t.Fatalf("expected XP gain with full bag, got %d", progress.XP)
	}

	if flower.Available {
		t.Fatalf("expected flower to be consumed even when only XP is gained")
	}
}

func TestInitializeWorldEntitiesAddsCollectorHiveNearSpawn(t *testing.T) {
	hub := newRuntimeTestHub(time.Date(2026, time.April, 22, 15, 20, 0, 0, time.UTC))
	hive := hub.activeHives[collectorHiveID]
	if hive == nil {
		t.Fatalf("expected collector hive to be created")
	}

	if hive.State.Scale != collectorHiveScale {
		t.Fatalf("expected collector hive scale %.1f, got %.1f", collectorHiveScale, hive.State.Scale)
	}

	if hive.Node.DepositRadius != collectorHiveDepositRadius {
		t.Fatalf("expected collector hive radius %.2f, got %.2f", collectorHiveDepositRadius, hive.Node.DepositRadius)
	}

	if hive.State.X != collectorHiveX || hive.State.Y != collectorHiveY {
		t.Fatalf("expected collector hive at %.1f,%.1f got %.1f,%.1f", collectorHiveX, collectorHiveY, hive.State.X, hive.State.Y)
	}
}
