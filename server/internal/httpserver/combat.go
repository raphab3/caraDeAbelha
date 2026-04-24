package httpserver

import (
	"fmt"
	"math"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

const (
	defaultMaxPlayerLife        = 100
	defaultMaxPlayerEnergy      = 100
	defaultLifeRegenDelay       = 5 * time.Second
	defaultLifeRegenPerSecond   = 4.0
	defaultEnergyRegenPerSecond = 10.0
	defaultCombatTagDuration    = 5 * time.Second
	defaultRespawnDelay         = 3 * time.Second
	defaultSpawnProtectionDelay = 2 * time.Second
	defaultFerraoDamage         = 18
	ferraoHitRadius             = 0.62
	slimeSlowDuration           = 800 * time.Millisecond
	slimeSlowMultiplier         = 0.70
	florHealPerSecond           = 8.0
)

func (hub *gameHub) ensurePlayerCombatLocked(player *playerState, progress *loopbase.PlayerProgress, now time.Time) {
	if progress == nil {
		return
	}

	if progress.MaxLife <= 0 {
		progress.MaxLife = defaultMaxPlayerLife
	}
	if progress.CurrentLife <= 0 && !progress.IsDead {
		progress.CurrentLife = progress.MaxLife
	}
	if progress.CurrentLife > progress.MaxLife {
		progress.CurrentLife = progress.MaxLife
	}
	if progress.MaxEnergy <= 0 {
		progress.MaxEnergy = defaultMaxPlayerEnergy
	}
	if progress.CurrentEnergy <= 0 && !progress.IsDead {
		progress.CurrentEnergy = progress.MaxEnergy
	}
	if progress.CurrentEnergy > progress.MaxEnergy {
		progress.CurrentEnergy = progress.MaxEnergy
	}
	if progress.LastLifeRegenAt.IsZero() {
		progress.LastLifeRegenAt = now
	}
	if progress.LastEnergyRegenAt.IsZero() {
		progress.LastEnergyRegenAt = now
	}

	hub.syncPlayerCombatStateLocked(player, progress)
}

func (hub *gameHub) syncPlayerCombatStateLocked(player *playerState, progress *loopbase.PlayerProgress) {
	if player == nil || progress == nil {
		return
	}

	player.CurrentLife = progress.CurrentLife
	player.MaxLife = progress.MaxLife
	player.IsDead = progress.IsDead
	player.CombatTagUntil = combatTimeMillis(progress.CombatTagUntil)
	if progress.IsDead {
		player.Speed = 0
	} else if progress.SlowUntil.After(hub.now()) {
		player.Speed = defaultPlayerSpeed * slimeSlowMultiplier
	} else if player.Speed <= 0 {
		player.Speed = defaultPlayerSpeed
	}
}

func (hub *gameHub) isPlayerActionBlockedByDeathLocked(clientID string, action string) bool {
	progress := hub.ensurePlayerProgressLocked(clientID)
	hub.ensurePlayerCombatLocked(hub.players[clientID], progress, hub.now())
	if !progress.IsDead {
		return false
	}

	hub.sendInteractionResultWithCode(hub.clients[clientID], action, false, 0, "Aguarde o respawn para agir", "player_dead")
	return true
}

func (hub *gameHub) consumeSkillEnergyLocked(client *clientSession, progress *loopbase.PlayerProgress, skill beeSkillDefinition) bool {
	if progress.CurrentEnergy < skill.EnergyCostPollen {
		hub.sendUseSkillFailure(client, "insufficient_energy", "Energia insuficiente")
		hub.sendPlayerStatus(client, progress)
		return false
	}

	progress.CurrentEnergy -= skill.EnergyCostPollen
	progress.LastEnergyRegenAt = hub.now()
	return true
}

func (hub *gameHub) applyDamageLocked(source *playerState, target *playerState, amount int, skillID string, now time.Time) bool {
	if source == nil || target == nil || amount <= 0 {
		if target == nil || amount <= 0 {
			return false
		}
	}

	progress := hub.ensurePlayerProgressLocked(target.ID)
	hub.ensurePlayerCombatLocked(target, progress, now)
	if progress.IsDead || progress.SpawnProtectionUntil.After(now) {
		return false
	}

	sourceID := ""
	if source != nil {
		sourceID = source.ID
	}

	progress.CurrentLife -= amount
	if progress.CurrentLife < 0 {
		progress.CurrentLife = 0
	}
	progress.LastDamageAt = now
	progress.CombatTagUntil = now.Add(defaultCombatTagDuration)
	progress.UpdatedAt = now
	hub.syncPlayerCombatStateLocked(target, progress)
	hub.sendCombatEventToStageLocked(target.StageID, combatEventMessage{
		Type:           "combat_event",
		EventID:        combatEventID(sourceID, target.ID, skillID, "damage", now),
		EventKind:      "damage",
		SourcePlayerID: sourceID,
		TargetPlayerID: target.ID,
		SkillID:        skillID,
		Amount:         amount,
		Timestamp:      now.UnixMilli(),
	})

	if progress.CurrentLife > 0 {
		hub.sendPlayerStatus(hub.clients[target.ID], progress)
		return true
	}

	hub.killPlayerLocked(source, target, progress, skillID, now)
	return true
}

func (hub *gameHub) healPlayerLocked(source *playerState, target *playerState, amount int, skillID string, now time.Time) bool {
	if source == nil || target == nil || amount <= 0 {
		return false
	}

	progress := hub.ensurePlayerProgressLocked(target.ID)
	hub.ensurePlayerCombatLocked(target, progress, now)
	if progress.IsDead || progress.CurrentLife >= progress.MaxLife {
		return false
	}

	before := progress.CurrentLife
	progress.CurrentLife += amount
	if progress.CurrentLife > progress.MaxLife {
		progress.CurrentLife = progress.MaxLife
	}
	applied := progress.CurrentLife - before
	if applied <= 0 {
		return false
	}

	progress.UpdatedAt = now
	hub.syncPlayerCombatStateLocked(target, progress)
	hub.sendCombatEventToStageLocked(target.StageID, combatEventMessage{
		Type:           "combat_event",
		EventID:        combatEventID(source.ID, target.ID, skillID, "heal", now),
		EventKind:      "heal",
		SourcePlayerID: source.ID,
		TargetPlayerID: target.ID,
		SkillID:        skillID,
		Amount:         applied,
		Timestamp:      now.UnixMilli(),
	})
	hub.sendPlayerStatus(hub.clients[target.ID], progress)
	return true
}

func (hub *gameHub) killPlayerLocked(source *playerState, target *playerState, progress *loopbase.PlayerProgress, skillID string, now time.Time) {
	progress.IsDead = true
	progress.RespawnAt = now.Add(defaultRespawnDelay)
	progress.SpawnProtectionUntil = time.Time{}
	progress.SlowUntil = time.Time{}
	progress.PollenCarried = 0
	progress.UpdatedAt = now
	hub.clearPlayerMovementLocked(target)
	delete(hub.activeCollections, target.ID)
	hub.clearPlayerCombatAreasLocked(target.ID)
	hub.syncPlayerCombatStateLocked(target, progress)

	sourceID := ""
	if source != nil {
		sourceID = source.ID
	}
	hub.sendCombatEventToStageLocked(target.StageID, combatEventMessage{
		Type:           "combat_event",
		EventID:        combatEventID(sourceID, target.ID, skillID, "death", now),
		EventKind:      "death",
		SourcePlayerID: sourceID,
		TargetPlayerID: target.ID,
		SkillID:        skillID,
		Amount:         0,
		Timestamp:      now.UnixMilli(),
	})
	hub.sendPlayerStatus(hub.clients[target.ID], progress)
}

func (hub *gameHub) respawnDeadPlayerLocked(player *playerState, progress *loopbase.PlayerProgress, now time.Time) bool {
	if player == nil || progress == nil || !progress.IsDead || progress.RespawnAt.IsZero() || now.Before(progress.RespawnAt) {
		return false
	}

	spawnX, spawnY := profileSpawnPositionFromPlayerID(player.ID)
	spawnX, spawnY = hub.clampWorldPosition(spawnX, spawnY)
	player.X = spawnX
	player.Y = spawnY
	hub.clearPlayerMovementLocked(player)
	player.UpdatedAt = now
	progress.CurrentLife = progress.MaxLife
	progress.CurrentEnergy = progress.MaxEnergy
	progress.IsDead = false
	progress.RespawnAt = time.Time{}
	progress.LastDamageAt = time.Time{}
	progress.LastLifeRegenAt = now
	progress.LastEnergyRegenAt = now
	progress.SpawnProtectionUntil = now.Add(defaultSpawnProtectionDelay)
	progress.CombatTagUntil = time.Time{}
	progress.SlowUntil = time.Time{}
	progress.UpdatedAt = now
	hub.updatePlayerZoneLocked(player, progress)
	hub.syncPlayerCombatStateLocked(player, progress)
	hub.sendCombatEventToStageLocked(player.StageID, combatEventMessage{
		Type:           "combat_event",
		EventID:        combatEventID("", player.ID, "", "respawn", now),
		EventKind:      "respawn",
		TargetPlayerID: player.ID,
		Amount:         progress.CurrentLife,
		Timestamp:      now.UnixMilli(),
	})
	hub.sendPlayerStatus(hub.clients[player.ID], progress)
	return true
}

func (hub *gameHub) regeneratePlayerLifeLocked(player *playerState, progress *loopbase.PlayerProgress, now time.Time) bool {
	if player == nil || progress == nil || progress.IsDead || progress.CurrentLife >= progress.MaxLife {
		progress.LastLifeRegenAt = now
		return false
	}
	if !progress.LastDamageAt.IsZero() && now.Before(progress.LastDamageAt.Add(defaultLifeRegenDelay)) {
		progress.LastLifeRegenAt = now
		return false
	}

	elapsed := now.Sub(progress.LastLifeRegenAt).Seconds()
	if elapsed <= 0 {
		return false
	}

	amount := int(math.Floor(elapsed * defaultLifeRegenPerSecond))
	if amount <= 0 {
		return false
	}

	progress.LastLifeRegenAt = now
	return hub.healPlayerLocked(player, player, amount, "natural_regen", now)
}

func (hub *gameHub) regeneratePlayerEnergyLocked(progress *loopbase.PlayerProgress, now time.Time) bool {
	if progress == nil || progress.IsDead || progress.CurrentEnergy >= progress.MaxEnergy {
		progress.LastEnergyRegenAt = now
		return false
	}

	elapsed := now.Sub(progress.LastEnergyRegenAt).Seconds()
	if elapsed <= 0 {
		return false
	}

	amount := int(math.Floor(elapsed * defaultEnergyRegenPerSecond))
	if amount <= 0 {
		return false
	}

	progress.LastEnergyRegenAt = now
	progress.CurrentEnergy += amount
	if progress.CurrentEnergy > progress.MaxEnergy {
		progress.CurrentEnergy = progress.MaxEnergy
	}
	progress.UpdatedAt = now
	return true
}

func (hub *gameHub) clearPlayerCombatAreasLocked(playerID string) {
	for effectID, effect := range hub.activeCombatAreas {
		if effect.OwnerPlayerID == playerID {
			delete(hub.activeCombatAreas, effectID)
		}
	}
}

func (hub *gameHub) processCombatRuntimeLocked(now time.Time) bool {
	changed := false
	for _, player := range hub.players {
		progress := hub.ensurePlayerProgressLocked(player.ID)
		hub.ensurePlayerCombatLocked(player, progress, now)
		if hub.respawnDeadPlayerLocked(player, progress, now) {
			changed = true
			continue
		}
		if hub.regeneratePlayerLifeLocked(player, progress, now) {
			changed = true
		}
		if hub.regeneratePlayerEnergyLocked(progress, now) {
			changed = true
		}
		if progress.SlowUntil.Before(now) && !progress.IsDead && player.Speed != defaultPlayerSpeed {
			progress.SlowUntil = time.Time{}
			hub.syncPlayerCombatStateLocked(player, progress)
			changed = true
		}
	}

	for effectID, effect := range hub.activeCombatAreas {
		if now.UnixMilli() >= effect.ExpiresAt {
			delete(hub.activeCombatAreas, effectID)
			continue
		}

		owner := hub.players[effect.OwnerPlayerID]
		if owner == nil {
			delete(hub.activeCombatAreas, effectID)
			continue
		}

		switch effect.SkillID {
		case "skill:slime-de-mel":
			for _, target := range hub.players {
				if target == nil || target.ID == owner.ID || target.StageID != owner.StageID {
					continue
				}
				progress := hub.ensurePlayerProgressLocked(target.ID)
				hub.ensurePlayerCombatLocked(target, progress, now)
				if progress.IsDead || math.Hypot(target.X-effect.ToX, target.Y-effect.ToY) > effect.Radius {
					continue
				}
				nextSlowUntil := now.Add(slimeSlowDuration)
				if nextSlowUntil.After(progress.SlowUntil) {
					progress.SlowUntil = nextSlowUntil
					progress.UpdatedAt = now
					hub.syncPlayerCombatStateLocked(target, progress)
					changed = true
				}
			}
		case "skill:flor-de-nectar":
			progress := hub.ensurePlayerProgressLocked(owner.ID)
			if !progress.IsDead && math.Hypot(owner.X-effect.ToX, owner.Y-effect.ToY) <= effect.Radius {
				healAmount := int(math.Max(1, math.Round(florHealPerSecond*effect.Power*worldTickInterval.Seconds())))
				if hub.healPlayerLocked(owner, owner, healAmount, effect.SkillID, now) {
					changed = true
				}
			}
		}
	}

	return changed
}

func (hub *gameHub) resolveProjectileHitLocked(owner *playerState, effect skillEffectMessage) *playerState {
	if owner == nil {
		return nil
	}

	var bestTarget *playerState
	bestProjection := math.Inf(1)
	rangeX := effect.ToX - effect.FromX
	rangeY := effect.ToY - effect.FromY
	rangeLength := math.Hypot(rangeX, rangeY)
	if rangeLength <= movementStopDistance {
		return nil
	}

	dirX := rangeX / rangeLength
	dirY := rangeY / rangeLength
	for _, target := range hub.players {
		if target == nil || target.ID == owner.ID || target.StageID != owner.StageID {
			continue
		}
		progress := hub.ensurePlayerProgressLocked(target.ID)
		hub.ensurePlayerCombatLocked(target, progress, hub.now())
		if progress.IsDead || progress.SpawnProtectionUntil.After(hub.now()) {
			continue
		}
		targetX := target.X - effect.FromX
		targetY := target.Y - effect.FromY
		projection := targetX*dirX + targetY*dirY
		if projection < 0 || projection > rangeLength || projection >= bestProjection {
			continue
		}
		closestX := effect.FromX + dirX*projection
		closestY := effect.FromY + dirY*projection
		if math.Hypot(target.X-closestX, target.Y-closestY) > ferraoHitRadius {
			continue
		}
		bestTarget = target
		bestProjection = projection
	}

	if bestTarget != nil {
		effect.ToX = bestTarget.X
		effect.ToY = bestTarget.Y
	}
	return bestTarget
}

func (hub *gameHub) sendCombatEventToStageLocked(stageID string, event combatEventMessage) {
	for _, client := range hub.clients {
		viewer := hub.players[client.id]
		if viewer == nil || viewer.StageID != stageID {
			continue
		}
		if err := hub.writeJSON(client, event); err != nil {
			continue
		}
	}
}

func combatEventID(sourcePlayerID string, targetPlayerID string, skillID string, kind string, now time.Time) string {
	return fmt.Sprintf("combat:%s:%s:%s:%s:%d", sourcePlayerID, targetPlayerID, skillID, kind, now.UnixNano())
}

func profileSpawnPositionFromPlayerID(playerID string) (float64, float64) {
	if len(playerID) > len("player:") && playerID[:len("player:")] == "player:" {
		return profileSpawnPosition(playerID[len("player:"):])
	}
	return profileSpawnPosition(playerID)
}
