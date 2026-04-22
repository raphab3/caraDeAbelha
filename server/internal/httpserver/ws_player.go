package httpserver

import (
	"math"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

func (hub *gameHub) ensurePlayerProgressLocked(playerID string) *loopbase.PlayerProgress {
	if progress, ok := hub.playerProgress[playerID]; ok && progress != nil {
		return progress
	}

	progress := &loopbase.PlayerProgress{
		PlayerID:        playerID,
		PollenCapacity:  40,
		Level:           1,
		SkillPoints:     1,
		CurrentZoneID:   zones.DefaultCurrentZoneID(),
		UnlockedZoneIDs: zones.DefaultUnlockedZoneIDs(),
	}

	hub.playerProgress[playerID] = progress
	return progress
}

func (hub *gameHub) register(connection *websocket.Conn, profileKey string, username string) (*clientSession, *clientSession, error) {
	persisted := hub.loadPersistedPlayer(profileKey)

	hub.mu.Lock()
	defer hub.mu.Unlock()

	now := hub.now()

	profile, ok := hub.profiles[profileKey]
	if !ok {
		if persisted != nil && persisted.Player != nil {
			profile = persisted.Player
			profile.Username = username
			profile.UpdatedAt = now
			profile.LastSeenAt = now
		} else {
			spawnX, spawnY := profileSpawnPosition(profileKey)
			spawnX, spawnY = hub.clampWorldPosition(spawnX, spawnY)
			profile = &playerState{
				ID:         buildPlayerID(profileKey),
				Username:   username,
				X:          spawnX,
				Y:          spawnY,
				Speed:      defaultPlayerSpeed,
				UpdatedAt:  now,
				LastSeenAt: now,
			}
		}
		hub.profiles[profileKey] = profile
	}

	if persisted != nil && persisted.Progress != nil {
		persisted.Progress.PlayerID = profile.ID
		persisted.Progress.CurrentZoneID = zones.NormalizeZoneID(persisted.Progress.CurrentZoneID)
		persisted.Progress.UnlockedZoneIDs = zones.NormalizeZoneIDs(persisted.Progress.UnlockedZoneIDs)
		persisted.Progress.UpdatedAt = now
		hub.playerProgress[profile.ID] = persisted.Progress
	}

	hub.advancePlayerLocked(profile, now)

	profile.Username = username
	profile.LastSeenAt = now
	replacedClient := hub.clients[profile.ID]
	progress := hub.ensurePlayerProgressLocked(profile.ID)
	hub.updatePlayerZoneLocked(profile, progress)

	client := &clientSession{
		id:         profile.ID,
		profileKey: profileKey,
		conn:       connection,
	}

	hub.clients[profile.ID] = client
	hub.players[profile.ID] = profile
	hub.tick++

	return client, replacedClient, nil
}

func (hub *gameHub) touchPlayerLastSeen(clientID string, seenAt time.Time) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return
	}

	profile, ok := hub.profiles[client.profileKey]
	if !ok || profile == nil {
		return
	}

	profile.LastSeenAt = seenAt
}

func (hub *gameHub) unregister(client *clientSession) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if client == nil {
		return false
	}

	current, ok := hub.clients[client.id]
	if !ok || current != client {
		return false
	}

	delete(hub.clients, client.id)
	delete(hub.players, client.id)
	hub.tick++

	return true
}

func (hub *gameHub) movePlayer(clientID string, direction string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	nextX := player.X
	nextY := player.Y

	switch direction {
	case "up":
		nextY = player.Y - 1
	case "down":
		nextY = player.Y + 1
	case "left":
		nextX = player.X - 1
	case "right":
		nextX = player.X + 1
	default:
		return false
	}

	nextX, nextY = hub.clampWorldPosition(nextX, nextY)
	currentX, currentY, remappedTargetX, remappedTargetY, remapped := hub.world.remapReturnMovement(player.X, player.Y, nextX, nextY)
	if remapped {
		player.X = currentX
		player.Y = currentY
		nextX = remappedTargetX
		nextY = remappedTargetY
	}

	if !hub.world.isTraversablePosition(nextX, nextY) {
		return false
	}

	hub.setPlayerTargetLocked(player, nextX, nextY, now)
	hub.tick++

	return true
}

func (hub *gameHub) movePlayerTo(clientID string, x float64, z float64) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	clampedX, clampedY := hub.clampWorldPosition(x, z)
	currentX, currentY, remappedTargetX, remappedTargetY, remapped := hub.world.remapReturnMovement(player.X, player.Y, clampedX, clampedY)
	if remapped {
		player.X = currentX
		player.Y = currentY
		clampedX = remappedTargetX
		clampedY = remappedTargetY
	}
	if !hub.world.isTraversablePosition(clampedX, clampedY) {
		return false
	}
	hub.setPlayerTargetLocked(player, clampedX, clampedY, now)
	hub.tick++

	return true
}

func (hub *gameHub) respawnPlayer(clientID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return false
	}

	client, ok := hub.clients[clientID]
	if !ok {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)

	spawnX, spawnY := profileSpawnPosition(client.profileKey)
	spawnX, spawnY = hub.clampWorldPosition(spawnX, spawnY)
	player.X = spawnX
	player.Y = spawnY
	player.TargetX = nil
	player.TargetY = nil
	player.UpdatedAt = now
	hub.tick++

	return true
}

func (hub *gameHub) advanceActivePlayersLocked(now time.Time) {
	for _, player := range hub.players {
		hub.advancePlayerLocked(player, now)
	}
}

func (hub *gameHub) stepMovingPlayers() bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if len(hub.players) == 0 {
		return false
	}

	now := hub.now()
	changed := false
	for _, player := range hub.players {
		if hub.advancePlayerLocked(player, now) {
			changed = true
		}
	}
	if hub.processWorldInteractionsLocked(now) {
		changed = true
	}

	if !changed {
		return false
	}

	hub.tick++
	return true
}

func (hub *gameHub) runMovementLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		if !hub.stepMovingPlayers() {
			continue
		}

		hub.broadcast()
	}
}

func (hub *gameHub) advancePlayerLocked(player *playerState, now time.Time) bool {
	if player == nil {
		return false
	}

	if player.UpdatedAt.IsZero() {
		player.UpdatedAt = now
		return false
	}

	if player.TargetX == nil || player.TargetY == nil {
		player.UpdatedAt = now
		return false
	}

	elapsed := now.Sub(player.UpdatedAt).Seconds()
	if elapsed <= 0 {
		return false
	}

	deltaX := *player.TargetX - player.X
	deltaY := *player.TargetY - player.Y
	distance := math.Hypot(deltaX, deltaY)

	if distance <= movementStopDistance {
		if !hub.world.isTraversablePosition(*player.TargetX, *player.TargetY) {
			player.TargetX = nil
			player.TargetY = nil
			player.UpdatedAt = now
			return true
		}

		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	stepDistance := player.Speed * elapsed
	if stepDistance >= distance {
		if !hub.world.isTraversablePosition(*player.TargetX, *player.TargetY) {
			player.TargetX = nil
			player.TargetY = nil
			player.UpdatedAt = now
			return true
		}

		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	ratio := stepDistance / distance
	nextX := player.X + deltaX*ratio
	nextY := player.Y + deltaY*ratio
	if !hub.world.isTraversablePosition(nextX, nextY) {
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	player.X = nextX
	player.Y = nextY
	player.UpdatedAt = now
	return true
}

func (hub *gameHub) setPlayerTargetLocked(player *playerState, x float64, y float64, now time.Time) {
	if player == nil {
		return
	}

	if math.Abs(player.X-x) <= movementStopDistance && math.Abs(player.Y-y) <= movementStopDistance {
		player.X = x
		player.Y = y
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return
	}

	player.TargetX = &x
	player.TargetY = &y
	player.UpdatedAt = now
}

func (hub *gameHub) clampWorldPosition(x float64, y float64) (float64, float64) {
	if hub == nil {
		return x, y
	}

	return hub.world.clampPosition(x, y)
}

// unlockZone attempts to unlock a zone for a player using honey as currency.
// Returns whether the action should trigger a broadcast.
func (hub *gameHub) unlockZone(clientID string, zoneID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)

	now := hub.now()

	// Call zone service to unlock zone
	success, honeyCost, reason := hub.zones.UnlockZone(progress, zoneID, now)

	// Send interaction result feedback (always send, even on failure)
	hub.sendInteractionResult(client, "unlock_zone", success, honeyCost, reason)

	// If successful, also send updated player status and zone state
	if success {
		hub.sendPlayerStatus(client, progress)
		hub.sendZoneState(client, clientID)
	}

	return success
}

// collectFlower handles a flower collection action from a player.
// Returns whether the action should trigger a broadcast.
func (hub *gameHub) collectFlower(clientID string, nodeID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client := hub.clients[clientID]
	if client != nil {
		reason := "Encoste na flor para iniciar a coleta. O servidor conclui quando a abelha permanece em contato."
		if strings.TrimSpace(nodeID) == "" {
			reason = "Aproxime-se de uma flor para coletar"
		}
		hub.sendInteractionResult(client, "collect_flower", false, 0, reason)
	}

	return true
}

func (hub *gameHub) findFlowerForPlayerLocked(player *playerState, flowerID string) (*worldFlowerState, bool) {
	if player == nil || strings.TrimSpace(flowerID) == "" {
		return nil, false
	}

	centerChunkX, centerChunkY := playerChunkPosition(player)
	for _, chunk := range hub.world.visibleChunksAround(centerChunkX, centerChunkY) {
		for index := range chunk.Flowers {
			flower := chunk.Flowers[index]
			if flower.ID == flowerID {
				return &flower, true
			}
		}
	}

	return nil, false
}

// depositHoney handles a honey deposit action from a player.
// Returns whether the action should trigger a broadcast.
func (hub *gameHub) depositHoney(clientID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}
	hub.sendInteractionResult(client, "deposit_honey", false, 0, "Entre em contato com a colmeia para converter polen em mel")

	return false
}
