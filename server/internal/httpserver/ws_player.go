package httpserver

import (
	"math"
	"time"

	"github.com/gorilla/websocket"
)

func (hub *gameHub) register(connection *websocket.Conn, profileKey string, username string) (*clientSession, *clientSession, error) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	profile, ok := hub.profiles[profileKey]
	if !ok {
		spawnX, spawnY := profileSpawnPosition(profileKey)
		spawnX, spawnY = hub.clampWorldPosition(spawnX, spawnY)
		profile = &playerState{
			ID:        buildPlayerID(profileKey),
			Username:  username,
			X:         spawnX,
			Y:         spawnY,
			Speed:     defaultPlayerSpeed,
			UpdatedAt: hub.now(),
		}
		hub.profiles[profileKey] = profile
	}

	hub.advancePlayerLocked(profile, hub.now())

	profile.Username = username
	replacedClient := hub.clients[profile.ID]

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
		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	stepDistance := player.Speed * elapsed
	if stepDistance >= distance {
		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	ratio := stepDistance / distance
	player.X += deltaX * ratio
	player.Y += deltaY * ratio
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
