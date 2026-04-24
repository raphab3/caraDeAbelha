package httpserver

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

const (
	useSkillReasonInvalidSlot  = "invalid_slot"
	useSkillReasonEmptySlot    = "empty_slot"
	useSkillReasonInvalidSkill = "invalid_skill"
	useSkillReasonCooldown     = "cooldown_active"
	useSkillReasonBlockedPath  = "blocked_path"
	skillEffectKindDash        = "dash"
	skillEffectKindProjectile  = "projectile"
	skillEffectStateActive     = "active"
	impulsoDashDistance        = 1.8
	impulsoDashMinDistance     = 0.18
	impulsoDashSampleDistance  = 0.14
	impulsoDashDuration        = 320 * time.Millisecond
	ferraoProjectileDistance   = 4.2
	ferraoProjectileDuration   = 560 * time.Millisecond
	slimeAreaBaseRadius        = 1.15
	slimeAreaBaseDuration      = 4200 * time.Millisecond
	florAreaBaseRadius         = 1.3
	florAreaBaseDuration       = 5200 * time.Millisecond
)

func (hub *gameHub) ensurePlayerProgressLocked(playerID string) *loopbase.PlayerProgress {
	if progress, ok := hub.playerProgress[playerID]; ok && progress != nil {
		return progress
	}

	progress := &loopbase.PlayerProgress{
		PlayerID:           playerID,
		PollenCapacity:     40,
		Level:              1,
		SkillPoints:        1,
		CurrentZoneID:      zones.DefaultCurrentZoneID(),
		UnlockedZoneIDs:    zones.DefaultUnlockedZoneIDs(),
		OwnedSkillIDs:      []string{},
		EquippedSkills:     make([]string, skillSlotCount),
		SkillUpgradeLevels: map[string]int{},
		SkillRuntime:       normalizeSkillRuntime(nil, make([]string, skillSlotCount), hub.now()),
	}
	hub.ensurePlayerCombatLocked(nil, progress, hub.now())

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
				FacingX:    1,
				FacingY:    0,
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
	if math.Abs(profile.FacingX) <= movementStopDistance && math.Abs(profile.FacingY) <= movementStopDistance {
		profile.FacingX = 1
		profile.FacingY = 0
	}
	profile.LastSeenAt = now
	replacedClient := hub.clients[profile.ID]
	progress := hub.ensurePlayerProgressLocked(profile.ID)
	hub.ensurePlayerCombatLocked(profile, progress, now)
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

	delete(hub.activeCollections, client.id)
	hub.clearPlayerCombatAreasLocked(client.id)
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
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "move") {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.SpawnProtectionUntil = time.Time{}
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

	hub.updatePlayerFacingLocked(player, nextX-player.X, nextY-player.Y)
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
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "move_to") {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.SpawnProtectionUntil = time.Time{}
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
	progress := hub.ensurePlayerProgressLocked(clientID)
	hub.ensurePlayerCombatLocked(player, progress, now)
	if progress.IsDead {
		hub.sendInteractionResultWithCode(client, "respawn", false, 0, "Respawn automatico em andamento", "respawn_pending")
		hub.sendPlayerStatus(client, progress)
		return false
	}

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
	if hub.processMobRuntimeLocked(now) {
		changed = true
	}
	if hub.processCombatRuntimeLocked(now) {
		changed = true
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
	progress := hub.ensurePlayerProgressLocked(player.ID)
	hub.ensurePlayerCombatLocked(player, progress, now)
	if progress.IsDead {
		player.UpdatedAt = now
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
	hub.updatePlayerFacingLocked(player, deltaX, deltaY)
	player.UpdatedAt = now
	return true
}

func (hub *gameHub) updatePlayerFacingLocked(player *playerState, deltaX float64, deltaY float64) {
	if player == nil {
		return
	}

	distance := math.Hypot(deltaX, deltaY)
	if distance <= movementStopDistance {
		return
	}

	player.FacingX = deltaX / distance
	player.FacingY = deltaY / distance
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

	hub.updatePlayerFacingLocked(player, x-player.X, y-player.Y)
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
	hub.updatePlayerFacingLocked(player, first.X-player.X, first.Y-player.Y)
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
	hub.updatePlayerFacingLocked(player, next.X-player.X, next.Y-player.Y)
	player.TargetX = &next.X
	player.TargetY = &next.Y
	player.UpdatedAt = now
}

func (hub *gameHub) resolveSkillDirectionLocked(player *playerState) (float64, float64) {
	if player == nil {
		return 1, 0
	}

	if player.TargetX != nil && player.TargetY != nil {
		deltaX := *player.TargetX - player.X
		deltaY := *player.TargetY - player.Y
		distance := math.Hypot(deltaX, deltaY)
		if distance > movementStopDistance {
			return deltaX / distance, deltaY / distance
		}
	}

	distance := math.Hypot(player.FacingX, player.FacingY)
	if distance > movementStopDistance {
		return player.FacingX / distance, player.FacingY / distance
	}

	return 1, 0
}

func (hub *gameHub) resolveImpulsoDestinationLocked(player *playerState, directionX float64, directionY float64, dashDistance float64) (float64, float64, bool) {
	if player == nil {
		return 0, 0, false
	}

	if dashDistance <= movementStopDistance {
		dashDistance = impulsoDashDistance
	}

	directionMagnitude := math.Hypot(directionX, directionY)
	if directionMagnitude <= movementStopDistance {
		directionX = 1
		directionY = 0
	} else {
		directionX /= directionMagnitude
		directionY /= directionMagnitude
	}

	lastValidX := player.X
	lastValidY := player.Y
	moved := false
	steps := int(math.Ceil(dashDistance / impulsoDashSampleDistance))

	for step := 1; step <= steps; step++ {
		travel := math.Min(dashDistance, float64(step)*impulsoDashSampleDistance)
		candidateX, candidateY := hub.clampWorldPosition(player.X+directionX*travel, player.Y+directionY*travel)
		if !hub.isTraversableSegmentLocked(player, player.X, player.Y, candidateX, candidateY) {
			break
		}
		if !hub.world.isTraversablePosition(candidateX, candidateY) || !hub.canPlayerAccessPositionLocked(player, candidateX, candidateY) {
			break
		}

		lastValidX = candidateX
		lastValidY = candidateY
		moved = true
	}

	if !moved || math.Hypot(lastValidX-player.X, lastValidY-player.Y) < impulsoDashMinDistance {
		return 0, 0, false
	}

	return lastValidX, lastValidY, true
}

func (hub *gameHub) sendUseSkillFailure(client *clientSession, reasonCode string, reason string) {
	hub.sendInteractionResultWithCode(client, "use_skill", false, 0, reason, reasonCode)
}

func (hub *gameHub) triggerImpulsoLocked(player *playerState, slot int, now time.Time, level int) (skillEffectMessage, bool) {
	if player == nil {
		return skillEffectMessage{}, false
	}

	directionX, directionY := hub.resolveSkillDirectionLocked(player)
	dashDistance := skillDistanceForLevel("skill:impulso", level)
	fromX := player.X
	fromY := player.Y
	toX, toY, ok := hub.resolveImpulsoDestinationLocked(player, directionX, directionY, dashDistance)
	if !ok {
		return skillEffectMessage{}, false
	}

	hub.clearPlayerMovementLocked(player)
	player.X = toX
	player.Y = toY
	hub.updatePlayerFacingLocked(player, directionX, directionY)
	player.UpdatedAt = now

	startedAt := now.UnixMilli()
	expiresAt := now.Add(impulsoDashDuration).UnixMilli()
	effectID := "skillfx:" + player.ID + ":" + strconv.Itoa(slot) + ":" + strconv.FormatInt(startedAt, 10)

	return skillEffectMessage{
		ID:            effectID,
		OwnerPlayerID: player.ID,
		SkillID:       "skill:impulso",
		Slot:          slot,
		StageID:       player.StageID,
		Kind:          skillEffectKindDash,
		State:         skillEffectStateActive,
		FromX:         fromX,
		FromY:         fromY,
		ToX:           toX,
		ToY:           toY,
		DirectionX:    directionX,
		DirectionY:    directionY,
		Radius:        0,
		Power:         0,
		DurationMs:    int(impulsoDashDuration / time.Millisecond),
		StartedAt:     startedAt,
		ExpiresAt:     expiresAt,
	}, true
}

func (hub *gameHub) triggerAtirarFerraoLocked(player *playerState, slot int, now time.Time, level int) (skillEffectMessage, bool) {
	if player == nil {
		return skillEffectMessage{}, false
	}

	directionX, directionY := hub.resolveSkillDirectionLocked(player)
	if math.Hypot(directionX, directionY) <= movementStopDistance {
		return skillEffectMessage{}, false
	}

	fromX := player.X
	fromY := player.Y
	power := skillPowerForLevel("skill:atirar-ferrao", level)
	travelDistance := skillDistanceForLevel("skill:atirar-ferrao", level)
	toX, toY := hub.clampWorldPosition(fromX+directionX*travelDistance, fromY+directionY*travelDistance)
	startedAt := now.UnixMilli()
	projectileDuration := time.Duration(float64(ferraoProjectileDuration) * (1 + (power-1)*0.3))
	expiresAt := now.Add(projectileDuration).UnixMilli()
	effectID := "skillfx:" + player.ID + ":" + strconv.Itoa(slot) + ":" + strconv.FormatInt(startedAt, 10) + ":ferrao"

	return skillEffectMessage{
		ID:            effectID,
		OwnerPlayerID: player.ID,
		SkillID:       "skill:atirar-ferrao",
		Slot:          slot,
		StageID:       player.StageID,
		Kind:          skillEffectKindProjectile,
		State:         skillEffectStateActive,
		FromX:         fromX,
		FromY:         fromY,
		ToX:           toX,
		ToY:           toY,
		DirectionX:    directionX,
		DirectionY:    directionY,
		Radius:        0,
		Power:         power,
		DurationMs:    int(projectileDuration / time.Millisecond),
		StartedAt:     startedAt,
		ExpiresAt:     expiresAt,
	}, true
}

func (hub *gameHub) triggerSlimeDeMelLocked(player *playerState, slot int, now time.Time, level int) (skillEffectMessage, bool) {
	if player == nil {
		return skillEffectMessage{}, false
	}

	power := skillPowerForLevel("skill:slime-de-mel", level)
	radius := slimeAreaBaseRadius * (0.92 + power*0.28)
	duration := time.Duration(float64(slimeAreaBaseDuration) * (1 + (power-1)*0.4))
	startedAt := now.UnixMilli()
	expiresAt := now.Add(duration).UnixMilli()
	effectID := "skillfx:" + player.ID + ":" + strconv.Itoa(slot) + ":" + strconv.FormatInt(startedAt, 10) + ":slime"

	return skillEffectMessage{
		ID:            effectID,
		OwnerPlayerID: player.ID,
		SkillID:       "skill:slime-de-mel",
		Slot:          slot,
		StageID:       player.StageID,
		Kind:          "ground-area",
		State:         skillEffectStateActive,
		FromX:         player.X,
		FromY:         player.Y,
		ToX:           player.X,
		ToY:           player.Y,
		DirectionX:    0,
		DirectionY:    0,
		Radius:        radius,
		Power:         power,
		DurationMs:    int(duration / time.Millisecond),
		StartedAt:     startedAt,
		ExpiresAt:     expiresAt,
	}, true
}

func (hub *gameHub) triggerFlorDeNectarLocked(player *playerState, slot int, now time.Time, level int) (skillEffectMessage, bool) {
	if player == nil {
		return skillEffectMessage{}, false
	}

	power := skillPowerForLevel("skill:flor-de-nectar", level)
	radius := florAreaBaseRadius * (0.94 + power*0.24)
	duration := time.Duration(float64(florAreaBaseDuration) * (1 + (power-1)*0.35))
	startedAt := now.UnixMilli()
	expiresAt := now.Add(duration).UnixMilli()
	effectID := "skillfx:" + player.ID + ":" + strconv.Itoa(slot) + ":" + strconv.FormatInt(startedAt, 10) + ":flor"

	return skillEffectMessage{
		ID:            effectID,
		OwnerPlayerID: player.ID,
		SkillID:       "skill:flor-de-nectar",
		Slot:          slot,
		StageID:       player.StageID,
		Kind:          "support-area",
		State:         skillEffectStateActive,
		FromX:         player.X,
		FromY:         player.Y,
		ToX:           player.X,
		ToY:           player.Y,
		DirectionX:    0,
		DirectionY:    0,
		Radius:        radius,
		Power:         power,
		DurationMs:    int(duration / time.Millisecond),
		StartedAt:     startedAt,
		ExpiresAt:     expiresAt,
	}, true
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
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "collect_flower") {
		return false
	}

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
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "deposit_honey") {
		return false
	}

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
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "buy_skill") {
		return false
	}

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
	progress.SpawnProtectionUntil = time.Time{}
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, progress.OwnedSkillIDs)
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
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, progress.OwnedSkillIDs)
	progress.UpdatedAt = hub.now()

	hub.sendInteractionResult(client, "buy_skill", true, skill.CostHoney, "Skill comprada")
	hub.sendPlayerStatus(client, progress)
	return false
}

func (hub *gameHub) upgradeSkill(clientID string, skillID string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "upgrade_skill") {
		return false
	}

	client, ok := hub.clients[clientID]
	if !ok || client == nil {
		return false
	}

	skill, ok := findBeeSkillDefinition(skillID)
	if !ok {
		hub.sendInteractionResult(client, "upgrade_skill", false, 0, "Skill invalida")
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.SpawnProtectionUntil = time.Time{}
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, progress.OwnedSkillIDs)

	owned := false
	for _, ownedSkillID := range progress.OwnedSkillIDs {
		if ownedSkillID == skillID {
			owned = true
			break
		}
	}
	if !owned {
		hub.sendInteractionResult(client, "upgrade_skill", false, 0, "Compre a skill antes de melhorar")
		return false
	}

	currentLevel := skillUpgradeLevel(progress.SkillUpgradeLevels, skillID)
	nextCost, canUpgrade := nextSkillUpgradeCost(skillID, currentLevel)
	if !canUpgrade {
		hub.sendInteractionResult(client, "upgrade_skill", false, 0, "Skill ja esta no nivel maximo")
		return false
	}
	if progress.Honey < nextCost {
		hub.sendInteractionResult(client, "upgrade_skill", false, 0, "Mel insuficiente para melhorar")
		return false
	}

	progress.Honey -= nextCost
	progress.SkillUpgradeLevels[skillID] = currentLevel + 1
	progress.UpdatedAt = hub.now()

	hub.sendInteractionResult(client, "upgrade_skill", true, progress.SkillUpgradeLevels[skillID], skill.Name)
	hub.sendPlayerStatus(client, progress)
	return false
}

func (hub *gameHub) equipSkill(clientID string, skillID string, slot int) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "equip_skill") {
		return false
	}

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
	progress.SpawnProtectionUntil = time.Time{}
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, progress.OwnedSkillIDs)

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
	player, ok := hub.players[clientID]
	if !ok || player == nil {
		return false
	}
	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	if hub.isPlayerActionBlockedByDeathLocked(clientID, "use_skill") {
		return false
	}

	if slot < 0 || slot >= skillSlotCount {
		hub.sendUseSkillFailure(client, useSkillReasonInvalidSlot, "Slot invalido")
		return false
	}

	progress := hub.ensurePlayerProgressLocked(clientID)
	progress.SpawnProtectionUntil = time.Time{}
	progress.OwnedSkillIDs = normalizeOwnedSkillIDs(progress.OwnedSkillIDs)
	progress.SkillUpgradeLevels = normalizeSkillUpgradeLevels(progress.SkillUpgradeLevels, progress.OwnedSkillIDs)
	progress.EquippedSkills = normalizeEquippedSkills(progress.EquippedSkills, progress.OwnedSkillIDs)
	progress.SkillRuntime = normalizeSkillRuntime(progress.SkillRuntime, progress.EquippedSkills, now)

	skillID := progress.EquippedSkills[slot]
	if strings.TrimSpace(skillID) == "" {
		hub.sendUseSkillFailure(client, useSkillReasonEmptySlot, "Equipe uma skill neste slot antes de usar")
		return false
	}

	skill, ok := findBeeSkillDefinition(skillID)
	if !ok {
		hub.sendUseSkillFailure(client, useSkillReasonInvalidSkill, "Skill invalida")
		return false
	}

	runtime := progress.SkillRuntime[slot]
	if runtime.State == skillStateCooldown && runtime.CooldownEndsAt.After(now) {
		hub.sendUseSkillFailure(client, useSkillReasonCooldown, "A skill ainda esta em cooldown")
		hub.sendPlayerStatus(client, progress)
		return false
	}
	if !hub.consumeSkillEnergyLocked(client, progress, skill) {
		return false
	}

	shouldBroadcast := false
	var skillEffects []skillEffectMessage
	currentLevel := skillUpgradeLevel(progress.SkillUpgradeLevels, skillID)
	switch skillID {
	case "skill:impulso":
		effect, ok := hub.triggerImpulsoLocked(player, slot, now, currentLevel)
		if !ok {
			progress.CurrentEnergy += skill.EnergyCostPollen
			hub.sendUseSkillFailure(client, useSkillReasonBlockedPath, "Sem espaco livre para usar Impulso agora")
			return false
		}
		skillEffects = []skillEffectMessage{effect}
		shouldBroadcast = true
	case "skill:atirar-ferrao":
		effect, ok := hub.triggerAtirarFerraoLocked(player, slot, now, currentLevel)
		if !ok {
			progress.CurrentEnergy += skill.EnergyCostPollen
			hub.sendUseSkillFailure(client, useSkillReasonBlockedPath, "Sem direcao valida para disparar o Ferrão")
			return false
		}
		impact := hub.resolveProjectileTargetLocked(player, effect)
		if impact.Player != nil || impact.Mob != nil {
			effect.ToX = impact.X
			effect.ToY = impact.Y
			if impact.Player != nil {
				hub.applyDamageLocked(player, impact.Player, int(math.Round(defaultFerraoDamage*effect.Power)), skillID, now)
			}
			if impact.Mob != nil {
				hub.applyDamageToMobLocked(player, impact.Mob, int(math.Round(defaultFerraoDamage*effect.Power)), skillID, now)
			}
			shouldBroadcast = true
		}
		skillEffects = []skillEffectMessage{effect}
	case "skill:slime-de-mel":
		effect, ok := hub.triggerSlimeDeMelLocked(player, slot, now, currentLevel)
		if !ok {
			progress.CurrentEnergy += skill.EnergyCostPollen
			hub.sendUseSkillFailure(client, useSkillReasonBlockedPath, "Nao foi possivel posicionar o Slime de Mel")
			return false
		}
		hub.activeCombatAreas[effect.ID] = effect
		skillEffects = []skillEffectMessage{effect}
	case "skill:flor-de-nectar":
		effect, ok := hub.triggerFlorDeNectarLocked(player, slot, now, currentLevel)
		if !ok {
			progress.CurrentEnergy += skill.EnergyCostPollen
			hub.sendUseSkillFailure(client, useSkillReasonBlockedPath, "Nao foi possivel florescer Nectar agora")
			return false
		}
		hub.activeCombatAreas[effect.ID] = effect
		skillEffects = []skillEffectMessage{effect}
	}

	progress.SkillRuntime[slot] = loopbase.PlayerSkillRuntime{
		Slot:           slot,
		SkillID:        skillID,
		State:          skillStateCooldown,
		CooldownEndsAt: now.Add(skillCooldownForSkillLevel(skillID, currentLevel)),
	}
	progress.UpdatedAt = now

	hub.sendInteractionResult(client, "use_skill", true, slot+1, skill.Name)
	hub.sendPlayerStatus(client, progress)
	if len(skillEffects) > 0 {
		hub.sendSkillEffectsToStageLocked(player.StageID, skillEffects)
	}
	return shouldBroadcast
}
