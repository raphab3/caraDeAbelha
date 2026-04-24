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
		OwnedSkillIDs:   []string{},
		EquippedSkills:  make([]string, skillSlotCount),
		SkillRuntime:    normalizeSkillRuntime(nil, make([]string, skillSlotCount), hub.now()),
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
				StageID:    hub.world.stageID,
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
	if strings.TrimSpace(profile.StageID) == "" {
		profile.StageID = hub.world.stageID
	}
	profile.LastSeenAt = now
	replacedClient := hub.clients[profile.ID]
	progress := hub.ensurePlayerProgressLocked(profile.ID)
	hub.resetPlayerToAccessibleSpawnLocked(profile, now)
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

func (hub *gameHub) canPlayerAccessPositionLocked(player *playerState, x float64, y float64) bool {
	if player == nil {
		return false
	}

	progress := hub.ensurePlayerProgressLocked(player.ID)
	zoneID := hub.world.zoneIDAt(x, y)
	canAccess, _ := hub.zones.CanAccessZone(progress, zoneID)
	return canAccess
}

func (hub *gameHub) resetPlayerToAccessibleSpawnLocked(player *playerState, now time.Time) bool {
	if player == nil {
		return false
	}

	progress := hub.ensurePlayerProgressLocked(player.ID)
	currentZoneID := hub.world.zoneIDAt(player.X, player.Y)
	if canAccess, _ := hub.zones.CanAccessZone(progress, currentZoneID); canAccess {
		return false
	}

	spawnX, spawnY := profileSpawnPosition(strings.TrimPrefix(player.ID, "player:"))
	spawnX, spawnY = hub.clampWorldPosition(spawnX, spawnY)
	if !hub.world.isTraversablePosition(spawnX, spawnY) || !hub.canPlayerAccessPositionLocked(player, spawnX, spawnY) {
		return false
	}

	player.X = spawnX
	player.Y = spawnY
	hub.clearPlayerMovementLocked(player)
	player.UpdatedAt = now
	hub.updatePlayerZoneLocked(player, progress)
	return true
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

	hub.clearPlayerMovementLocked(player)
	nextX, nextY = hub.clampWorldPosition(nextX, nextY)
	currentX, currentY, remappedTargetX, remappedTargetY, remapped := hub.world.remapReturnMovement(player.X, player.Y, nextX, nextY)
	if remapped {
		player.X = currentX
		player.Y = currentY
		nextX = remappedTargetX
		nextY = remappedTargetY
	}

	if !hub.world.isTraversablePosition(nextX, nextY) || !hub.canPlayerAccessPositionLocked(player, nextX, nextY) {
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
	targetX, targetY := x, z
	if !hub.world.containsMovementPosition(targetX, targetY) {
		hub.clearPlayerMovementLocked(player)
		hub.rejectMoveToLocked(clientID, "Destino invalido")
		return false
	}

	currentX, currentY, remappedTargetX, remappedTargetY, remapped := hub.world.remapReturnMovement(player.X, player.Y, targetX, targetY)
	if remapped {
		player.X = currentX
		player.Y = currentY
		targetX = remappedTargetX
		targetY = remappedTargetY
	}

	route := hub.resolveMovementRouteLocked(player, targetX, targetY)
	if len(route.waypoints) == 0 {
		hub.clearPlayerMovementLocked(player)
		hub.rejectMoveToLocked(clientID, route.reason)
		return false
	}

	hub.setPlayerRouteLocked(player, route.waypoints, targetX, targetY, now)
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
	hub.clearPlayerMovementLocked(player)
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

	if hub.resetPlayerToAccessibleSpawnLocked(player, now) {
		return true
	}

	if player.UpdatedAt.IsZero() {
		player.UpdatedAt = now
		return false
	}

	if player.TargetX == nil || player.TargetY == nil {
		hub.clearPlayerRouteLocked(player)
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
		if !hub.world.isTraversablePosition(*player.TargetX, *player.TargetY) || !hub.canPlayerAccessPositionLocked(player, *player.TargetX, *player.TargetY) {
			hub.clearPlayerMovementLocked(player)
			player.UpdatedAt = now
			return true
		}

		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.UpdatedAt = now
		hub.advancePlayerRouteTargetLocked(player, now)
		return true
	}

	stepDistance := player.Speed * elapsed
	if stepDistance >= distance {
		if !hub.world.isTraversablePosition(*player.TargetX, *player.TargetY) || !hub.canPlayerAccessPositionLocked(player, *player.TargetX, *player.TargetY) {
			hub.clearPlayerMovementLocked(player)
			player.UpdatedAt = now
			return true
		}

		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.UpdatedAt = now
		hub.advancePlayerRouteTargetLocked(player, now)
		return true
	}

	ratio := stepDistance / distance
	nextX := player.X + deltaX*ratio
	nextY := player.Y + deltaY*ratio
	if !hub.world.isTraversablePosition(nextX, nextY) || !hub.canPlayerAccessPositionLocked(player, nextX, nextY) {
		hub.clearPlayerMovementLocked(player)
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

	hub.clearPlayerRouteLocked(player)
	if math.Abs(player.X-x) <= movementStopDistance && math.Abs(player.Y-y) <= movementStopDistance {
		player.X = x
		player.Y = y
		hub.clearPlayerMovementLocked(player)
		player.UpdatedAt = now
		return
	}

	player.TargetX = &x
	player.TargetY = &y
	player.UpdatedAt = now
}

func (hub *gameHub) setPlayerRouteLocked(player *playerState, waypoints []movementWaypoint, destinationX float64, destinationY float64, now time.Time) {
	if player == nil {
		return
	}

	hub.clearPlayerMovementLocked(player)
	if len(waypoints) == 0 {
		player.UpdatedAt = now
		return
	}

	first := waypoints[0]
	player.TargetX = &first.X
	player.TargetY = &first.Y
	if len(waypoints) > 1 {
		player.Route = append([]movementWaypoint{}, waypoints[1:]...)
		player.DestinationX = &destinationX
		player.DestinationY = &destinationY
	}
	player.UpdatedAt = now
}

func (hub *gameHub) advancePlayerRouteTargetLocked(player *playerState, now time.Time) {
	if player == nil {
		return
	}

	if len(player.Route) == 0 {
		hub.clearPlayerMovementLocked(player)
		return
	}

	next := player.Route[0]
	if !hub.world.isTraversablePosition(next.X, next.Y) || !hub.canPlayerAccessPositionLocked(player, next.X, next.Y) {
		hub.clearPlayerMovementLocked(player)
		return
	}

	player.Route = append([]movementWaypoint{}, player.Route[1:]...)
	player.TargetX = &next.X
	player.TargetY = &next.Y
	player.UpdatedAt = now
}

func (hub *gameHub) clearPlayerRouteLocked(player *playerState) {
	if player == nil {
		return
	}

	player.Route = nil
	player.DestinationX = nil
	player.DestinationY = nil
}

func (hub *gameHub) clearPlayerMovementLocked(player *playerState) {
	if player == nil {
		return
	}

	player.TargetX = nil
	player.TargetY = nil
	hub.clearPlayerRouteLocked(player)
}

func (hub *gameHub) rejectMoveToLocked(clientID string, reason string) {
	if strings.TrimSpace(reason) == "" {
		reason = "Nao existe rota disponivel"
	}

	hub.sendInteractionResult(hub.clients[clientID], "move_to", false, 0, reason)
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

func (hub *gameHub) buySkill(clientID string, skillID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}

	skill, ok := findBeeSkillDefinition(skillID)
	if !ok {
		hub.sendInteractionResult(client, "buy_skill", false, 0, "Skill invalida")
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.EquippedSkills = normalizeEquippedSkills(progress.EquippedSkills, progress.OwnedSkillIDs)

	for _, ownedSkillID := range progress.OwnedSkillIDs {
		if ownedSkillID == skillID {
			hub.sendInteractionResult(client, "buy_skill", false, 0, "Skill ja comprada")
			return false
		}
	}

	if progress.Honey < skill.CostHoney {
		hub.sendInteractionResult(client, "buy_skill", false, 0, "Mel insuficiente")
		return false
	}

	progress.Honey -= skill.CostHoney
	progress.OwnedSkillIDs = append(progress.OwnedSkillIDs, skillID)
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.UpdatedAt = hub.now()

	hub.sendInteractionResult(client, "buy_skill", true, skill.CostHoney, "Skill comprada")
	hub.sendPlayerStatus(client, progress)
	return false
}

func (hub *gameHub) equipSkill(clientID string, skillID string, slot int) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}

	if slot < 0 || slot >= skillSlotCount {
		hub.sendInteractionResult(client, "equip_skill", false, 0, "Slot invalido")
		return false
	}

	if _, ok := findBeeSkillDefinition(skillID); !ok {
		hub.sendInteractionResult(client, "equip_skill", false, 0, "Skill invalida")
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)

	owned := false
	for _, ownedSkillID := range progress.OwnedSkillIDs {
		if ownedSkillID == skillID {
			owned = true
			break
		}
	}
	if !owned {
		hub.sendInteractionResult(client, "equip_skill", false, 0, "Compre a skill antes de equipar")
		return false
	}

	progress.EquippedSkills = normalizeEquippedSkills(progress.EquippedSkills, progress.OwnedSkillIDs)
	progress.SkillRuntime = normalizeSkillRuntime(progress.SkillRuntime, progress.EquippedSkills, hub.now())
	for index, equippedSkillID := range progress.EquippedSkills {
		if equippedSkillID == skillID {
			progress.EquippedSkills[index] = ""
		}
	}
	progress.EquippedSkills[slot] = skillID
	progress.SkillRuntime = normalizeSkillRuntime(progress.SkillRuntime, progress.EquippedSkills, hub.now())
	progress.UpdatedAt = hub.now()

	hub.sendInteractionResult(client, "equip_skill", true, slot+1, "Skill equipada")
	hub.sendPlayerStatus(client, progress)
	return false
}

func (hub *gameHub) useSkill(clientID string, slot int) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}

	if slot < 0 || slot >= skillSlotCount {
		hub.sendInteractionResult(client, "use_skill", false, 0, "Slot invalido")
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.EquippedSkills = normalizeEquippedSkills(progress.EquippedSkills, progress.OwnedSkillIDs)
	progress.SkillRuntime = normalizeSkillRuntime(progress.SkillRuntime, progress.EquippedSkills, hub.now())

	skillID := progress.EquippedSkills[slot]
	if strings.TrimSpace(skillID) == "" {
		hub.sendInteractionResult(client, "use_skill", false, 0, "Nenhuma skill equipada neste slot")
		return false
	}

	skill, ok := findBeeSkillDefinition(skillID)
	if !ok {
		hub.sendInteractionResult(client, "use_skill", false, 0, "Skill invalida")
		return false
	}

	runtime := progress.SkillRuntime[slot]
	if runtime.State == skillStateCooldown && runtime.CooldownEndsAt.After(hub.now()) {
		hub.sendInteractionResult(client, "use_skill", false, 0, "Skill em cooldown")
		hub.sendPlayerStatus(client, progress)
		return false
	}

	progress.SkillRuntime[slot] = loopbase.PlayerSkillRuntime{
		Slot:           slot,
		SkillID:        skillID,
		State:          skillStateCooldown,
		CooldownEndsAt: hub.now().Add(skillCooldownForSkill(skillID)),
	}
	progress.UpdatedAt = hub.now()

	hub.sendInteractionResult(client, "use_skill", true, slot+1, skill.Name)
	hub.sendPlayerStatus(client, progress)
	return false
}
