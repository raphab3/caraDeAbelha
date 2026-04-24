package httpserver

import (
	"fmt"
	"math"
	"sort"
	"time"
)

const (
	defaultMobRespawnMinSeconds = 8
	defaultMobRespawnMaxSeconds = 18
	mobMoveSpeed                = 1.55
	mobTargetReachDistance      = 0.24
	mobMeleeAttackRange         = 0.9
	mobRangedAttackRange        = 4.2
	mobRangedPreferredDistance  = 2.8
	mobMeleeAttackCooldown      = 1200 * time.Millisecond
	mobRangedAttackCooldown     = 1800 * time.Millisecond
)

type mobSpawnTile struct {
	X       float64
	Y       float64
	GroundY float64
}

type activeMobRuntime struct {
	State           worldMobState
	HomeX           float64
	HomeY           float64
	HomeGroundY     float64
	MoveRadius      float64
	AggroRadius     float64
	PursuitLevel    int
	TargetPlayerID  string
	WanderTargetX   float64
	WanderTargetY   float64
	HasWanderTarget bool
	RespawnAt       time.Time
	LastAttackAt    time.Time
}

type projectileTarget struct {
	Player     *playerState
	Mob        *activeMobRuntime
	Projection float64
	X          float64
	Y          float64
}

func (config worldMobConfig) totalCount() int {
	return config.MeleeCount + config.RangedCount
}

func mobAggroRadiusForPursuitLevel(level int) float64 {
	clamped := level
	if clamped < 1 {
		clamped = 1
	}
	if clamped > 5 {
		clamped = 5
	}
	return 2.6 + float64(clamped-1)*1.2
}

func mobMaxLife(level int, kind string) int {
	base := 28 + level*12
	if kind == "ranged" {
		base -= 4
	}
	if base < 18 {
		return 18
	}
	return base
}

func mobDamage(level int, kind string) int {
	base := 5 + level*2
	if kind == "melee" {
		base += 2
	}
	return base
}

func mobRewards(level int, kind string) (int, int) {
	xp := 12 + level*7
	honey := 1 + level/3
	if kind == "ranged" {
		xp += 4
	}
	return xp, honey
}

func (hub *gameHub) initializeWorldMobs() {
	if hub == nil {
		return
	}

	hub.activeMobs = make(map[string]*activeMobRuntime)
	if hub.world.mobs.totalCount() == 0 {
		return
	}

	spawnTiles := hub.collectMobSpawnTiles()
	if len(spawnTiles) == 0 {
		return
	}

	spawnKinds := make([]string, 0, hub.world.mobs.totalCount())
	for index := 0; index < hub.world.mobs.MeleeCount; index++ {
		spawnKinds = append(spawnKinds, "melee")
	}
	for index := 0; index < hub.world.mobs.RangedCount; index++ {
		spawnKinds = append(spawnKinds, "ranged")
	}

	for index, kind := range spawnKinds {
		mob := hub.buildMobRuntime(kind, index, spawnTiles)
		if mob == nil {
			continue
		}
		hub.activeMobs[mob.State.ID] = mob
	}
}

func (hub *gameHub) collectMobSpawnTiles() []mobSpawnTile {
	tiles := make([]mobSpawnTile, 0)
	for _, chunk := range hub.world.chunks {
		for _, tile := range chunk.Tiles {
			if tile.Type != "grass" {
				continue
			}
			if !hub.world.containsMovementPosition(tile.X, tile.Z) || !hub.world.isTraversablePosition(tile.X, tile.Z) {
				continue
			}
			tiles = append(tiles, mobSpawnTile{X: tile.X, Y: tile.Z, GroundY: tile.Y})
		}
	}
	return tiles
}

func (hub *gameHub) buildMobRuntime(kind string, index int, spawnTiles []mobSpawnTile) *activeMobRuntime {
	spawnTile, ok := hub.randomMobSpawnTile(spawnTiles)
	if !ok {
		return nil
	}

	level := hub.world.mobs.MinLevel
	if hub.world.mobs.MaxLevel > hub.world.mobs.MinLevel {
		level += hub.random.Intn(hub.world.mobs.MaxLevel - hub.world.mobs.MinLevel + 1)
	}
	maxLife := mobMaxLife(level, kind)

	return &activeMobRuntime{
		State: worldMobState{
			ID:          fmt.Sprintf("mob:%s:%d", kind, index+1),
			Kind:        kind,
			X:           spawnTile.X,
			Y:           spawnTile.Y,
			GroundY:     spawnTile.GroundY,
			Level:       level,
			CurrentLife: maxLife,
			MaxLife:     maxLife,
			IsDead:      false,
		},
		HomeX:        spawnTile.X,
		HomeY:        spawnTile.Y,
		HomeGroundY:  spawnTile.GroundY,
		MoveRadius:   hub.world.mobs.MoveRadius,
		AggroRadius:  mobAggroRadiusForPursuitLevel(hub.world.mobs.PursuitLevel),
		PursuitLevel: hub.world.mobs.PursuitLevel,
	}
}

func (hub *gameHub) randomMobSpawnTile(spawnTiles []mobSpawnTile) (mobSpawnTile, bool) {
	if len(spawnTiles) == 0 {
		return mobSpawnTile{}, false
	}
	return spawnTiles[hub.random.Intn(len(spawnTiles))], true
}

func (hub *gameHub) buildWorldMobsState() []worldMobState {
	if len(hub.activeMobs) == 0 {
		return nil
	}

	mobs := make([]worldMobState, 0, len(hub.activeMobs))
	for _, mob := range hub.activeMobs {
		if mob == nil || mob.State.IsDead {
			continue
		}
		mobs = append(mobs, mob.State)
	}

	if len(mobs) == 0 {
		return nil
	}

	sort.Slice(mobs, func(left int, right int) bool {
		return mobs[left].ID < mobs[right].ID
	})
	return mobs
}

func (hub *gameHub) processMobRuntimeLocked(now time.Time) bool {
	if len(hub.activeMobs) == 0 {
		return false
	}

	changed := false
	for _, mob := range hub.activeMobs {
		if mob == nil {
			continue
		}

		if mob.State.IsDead {
			if !mob.RespawnAt.IsZero() && !now.Before(mob.RespawnAt) && hub.respawnMobLocked(mob) {
				changed = true
			}
			continue
		}

		target := hub.findNearestMobTargetLocked(mob, now)
		if target != nil {
			mob.TargetPlayerID = target.ID
			if hub.advanceMobTowardTargetLocked(mob, target) {
				changed = true
			}
			if hub.tryAttackPlayerWithMobLocked(mob, target, now) {
				changed = true
			}
			continue
		}

		mob.TargetPlayerID = ""
		if hub.advanceIdleMobLocked(mob) {
			changed = true
		}
	}

	return changed
}

func (hub *gameHub) findNearestMobTargetLocked(mob *activeMobRuntime, now time.Time) *playerState {
	if mob == nil || mob.State.IsDead {
		return nil
	}

	var bestTarget *playerState
	bestDistance := math.Inf(1)
	for _, candidate := range hub.players {
		if candidate == nil || candidate.StageID != hub.world.stageID {
			continue
		}
		progress := hub.ensurePlayerProgressLocked(candidate.ID)
		hub.ensurePlayerCombatLocked(candidate, progress, now)
		if progress.IsDead || progress.SpawnProtectionUntil.After(now) {
			continue
		}
		distance := math.Hypot(candidate.X-mob.State.X, candidate.Y-mob.State.Y)
		if distance > mob.AggroRadius || distance >= bestDistance {
			continue
		}
		bestDistance = distance
		bestTarget = candidate
	}

	return bestTarget
}

func (hub *gameHub) advanceIdleMobLocked(mob *activeMobRuntime) bool {
	if mob == nil || mob.State.IsDead {
		return false
	}

	if !mob.HasWanderTarget || math.Hypot(mob.WanderTargetX-mob.State.X, mob.WanderTargetY-mob.State.Y) <= mobTargetReachDistance {
		if !hub.assignMobWanderTargetLocked(mob) {
			return false
		}
	}

	return hub.moveMobTowardLocked(mob, mob.WanderTargetX, mob.WanderTargetY, false)
}

func (hub *gameHub) assignMobWanderTargetLocked(mob *activeMobRuntime) bool {
	if mob == nil {
		return false
	}

	for attempt := 0; attempt < 10; attempt++ {
		angle := hub.random.Float64() * math.Pi * 2
		distance := hub.random.Float64() * mob.MoveRadius
		targetX := mob.HomeX + math.Cos(angle)*distance
		targetY := mob.HomeY + math.Sin(angle)*distance
		if !hub.world.containsMovementPosition(targetX, targetY) || !hub.world.isTraversablePosition(targetX, targetY) {
			continue
		}
		mob.WanderTargetX = targetX
		mob.WanderTargetY = targetY
		mob.HasWanderTarget = true
		return true
	}

	mob.WanderTargetX = mob.HomeX
	mob.WanderTargetY = mob.HomeY
	mob.HasWanderTarget = true
	return true
}

func (hub *gameHub) advanceMobTowardTargetLocked(mob *activeMobRuntime, target *playerState) bool {
	if mob == nil || target == nil {
		return false
	}

	distance := math.Hypot(target.X-mob.State.X, target.Y-mob.State.Y)
	if mob.State.Kind == "ranged" {
		if distance <= mobRangedAttackRange && distance >= mobRangedPreferredDistance*0.6 {
			return false
		}
		if distance < mobRangedPreferredDistance*0.6 {
			awayX := mob.State.X - (target.X - mob.State.X)
			awayY := mob.State.Y - (target.Y - mob.State.Y)
			return hub.moveMobTowardLocked(mob, awayX, awayY, true)
		}
	}

	if mob.State.Kind == "melee" && distance <= mobMeleeAttackRange*0.85 {
		return false
	}

	return hub.moveMobTowardLocked(mob, target.X, target.Y, true)
}

func (hub *gameHub) moveMobTowardLocked(mob *activeMobRuntime, targetX float64, targetY float64, clampToHome bool) bool {
	if mob == nil || mob.State.IsDead {
		return false
	}

	deltaX := targetX - mob.State.X
	deltaY := targetY - mob.State.Y
	distance := math.Hypot(deltaX, deltaY)
	if distance <= mobTargetReachDistance {
		mob.State.X = targetX
		mob.State.Y = targetY
		return true
	}

	step := mobMoveSpeed * worldTickInterval.Seconds()
	if distance < step {
		step = distance
	}
	nextX := mob.State.X + (deltaX/distance)*step
	nextY := mob.State.Y + (deltaY/distance)*step
	if clampToHome {
		nextX, nextY = clampPointToCircle(nextX, nextY, mob.HomeX, mob.HomeY, mob.MoveRadius)
	}
	if !hub.world.containsMovementPosition(nextX, nextY) || !hub.world.isTraversablePosition(nextX, nextY) {
		mob.HasWanderTarget = false
		return false
	}

	mob.State.X = nextX
	mob.State.Y = nextY
	mob.State.GroundY = resolveGroundYForMob(hub.world, nextX, nextY, mob.HomeGroundY)
	return true
}

func (hub *gameHub) tryAttackPlayerWithMobLocked(mob *activeMobRuntime, target *playerState, now time.Time) bool {
	if mob == nil || target == nil || mob.State.IsDead {
		return false
	}

	var attackRange float64
	var cooldown time.Duration
	skillID := "mob:swipe"
	if mob.State.Kind == "ranged" {
		attackRange = mobRangedAttackRange
		cooldown = mobRangedAttackCooldown
		skillID = "mob:venom-shot"
	} else {
		attackRange = mobMeleeAttackRange
		cooldown = mobMeleeAttackCooldown
	}

	if !mob.LastAttackAt.IsZero() && now.Before(mob.LastAttackAt.Add(cooldown)) {
		return false
	}
	if math.Hypot(target.X-mob.State.X, target.Y-mob.State.Y) > attackRange {
		return false
	}

	mob.LastAttackAt = now
	if mob.State.Kind == "ranged" {
		directionX := target.X - mob.State.X
		directionY := target.Y - mob.State.Y
		length := math.Hypot(directionX, directionY)
		if length > 0 {
			directionX /= length
			directionY /= length
		}
		hub.sendSkillEffectsToStageLocked(hub.world.stageID, []skillEffectMessage{{
			ID:            fmt.Sprintf("mobfx:%s:%d", mob.State.ID, now.UnixNano()),
			OwnerPlayerID: mob.State.ID,
			SkillID:       skillID,
			StageID:       hub.world.stageID,
			Kind:          skillEffectKindProjectile,
			State:         skillEffectStateActive,
			FromX:         mob.State.X,
			FromY:         mob.State.Y,
			ToX:           target.X,
			ToY:           target.Y,
			DirectionX:    directionX,
			DirectionY:    directionY,
			Power:         1,
			DurationMs:    500,
			StartedAt:     now.UnixMilli(),
			ExpiresAt:     now.Add(500 * time.Millisecond).UnixMilli(),
		}})
	}

	return hub.applyDamageLocked(nil, target, mobDamage(mob.State.Level, mob.State.Kind), skillID, now)
}

func (hub *gameHub) applyDamageToMobLocked(source *playerState, mob *activeMobRuntime, amount int, skillID string, now time.Time) bool {
	if source == nil || mob == nil || mob.State.IsDead || amount <= 0 {
		return false
	}

	mob.State.CurrentLife -= amount
	if mob.State.CurrentLife > 0 {
		return true
	}

	hub.killMobLocked(source, mob, skillID, now)
	return true
}

func (hub *gameHub) killMobLocked(source *playerState, mob *activeMobRuntime, skillID string, now time.Time) {
	if mob == nil || mob.State.IsDead {
		return
	}

	mob.State.CurrentLife = 0
	mob.State.IsDead = true
	mob.TargetPlayerID = ""
	mob.HasWanderTarget = false
	respawnSeconds := defaultMobRespawnMinSeconds
	if defaultMobRespawnMaxSeconds > defaultMobRespawnMinSeconds {
		respawnSeconds += hub.random.Intn(defaultMobRespawnMaxSeconds - defaultMobRespawnMinSeconds + 1)
	}
	mob.RespawnAt = now.Add(time.Duration(respawnSeconds) * time.Second)

	if source == nil {
		return
	}

	progress := hub.ensurePlayerProgressLocked(source.ID)
	xpReward, honeyReward := mobRewards(mob.State.Level, mob.State.Kind)
	hub.addXPToProgressLocked(progress, xpReward)
	progress.Honey += honeyReward
	progress.UpdatedAt = now
	hub.sendPlayerStatus(hub.clients[source.ID], progress)
	hub.sendInteractionResult(hub.clients[source.ID], "defeat_mob", true, honeyReward, fmt.Sprintf("%d XP e %d mel", xpReward, honeyReward))
	_ = skillID
}

func (hub *gameHub) respawnMobLocked(mob *activeMobRuntime) bool {
	if mob == nil {
		return false
	}

	spawnTiles := hub.collectMobSpawnTiles()
	spawnTile, ok := hub.randomMobSpawnTile(spawnTiles)
	if !ok {
		return false
	}

	maxLife := mobMaxLife(mob.State.Level, mob.State.Kind)
	mob.State.X = spawnTile.X
	mob.State.Y = spawnTile.Y
	mob.State.GroundY = spawnTile.GroundY
	mob.State.CurrentLife = maxLife
	mob.State.MaxLife = maxLife
	mob.State.IsDead = false
	mob.HomeX = spawnTile.X
	mob.HomeY = spawnTile.Y
	mob.HomeGroundY = spawnTile.GroundY
	mob.TargetPlayerID = ""
	mob.HasWanderTarget = false
	mob.RespawnAt = time.Time{}
	return true
}

func (hub *gameHub) resolveProjectileTargetLocked(owner *playerState, effect skillEffectMessage) projectileTarget {
	best := projectileTarget{Projection: math.Inf(1)}
	if owner == nil {
		return best
	}

	rangeX := effect.ToX - effect.FromX
	rangeY := effect.ToY - effect.FromY
	rangeLength := math.Hypot(rangeX, rangeY)
	if rangeLength <= movementStopDistance {
		return best
	}

	dirX := rangeX / rangeLength
	dirY := rangeY / rangeLength
	checkProjection := func(targetX float64, targetY float64) (float64, bool) {
		offsetX := targetX - effect.FromX
		offsetY := targetY - effect.FromY
		projection := offsetX*dirX + offsetY*dirY
		if projection < 0 || projection > rangeLength || projection >= best.Projection {
			return 0, false
		}
		closestX := effect.FromX + dirX*projection
		closestY := effect.FromY + dirY*projection
		if math.Hypot(targetX-closestX, targetY-closestY) > ferraoHitRadius {
			return 0, false
		}
		return projection, true
	}

	for _, target := range hub.players {
		if target == nil || target.ID == owner.ID || target.StageID != owner.StageID {
			continue
		}
		progress := hub.ensurePlayerProgressLocked(target.ID)
		hub.ensurePlayerCombatLocked(target, progress, hub.now())
		if progress.IsDead || progress.SpawnProtectionUntil.After(hub.now()) {
			continue
		}
		projection, ok := checkProjection(target.X, target.Y)
		if !ok {
			continue
		}
		best = projectileTarget{Player: target, Projection: projection, X: target.X, Y: target.Y}
	}

	for _, mob := range hub.activeMobs {
		if mob == nil || mob.State.IsDead {
			continue
		}
		projection, ok := checkProjection(mob.State.X, mob.State.Y)
		if !ok {
			continue
		}
		best = projectileTarget{Mob: mob, Projection: projection, X: mob.State.X, Y: mob.State.Y}
	}

	return best
}

func clampPointToCircle(x float64, y float64, centerX float64, centerY float64, radius float64) (float64, float64) {
	deltaX := x - centerX
	deltaY := y - centerY
	distance := math.Hypot(deltaX, deltaY)
	if distance <= radius || distance == 0 {
		return x, y
	}
	scale := radius / distance
	return centerX + deltaX*scale, centerY + deltaY*scale
}

func resolveGroundYForMob(layout worldLayout, x float64, y float64, fallback float64) float64 {
	tile, ok := layout.tileAtPosition(x, y)
	if !ok {
		return fallback
	}
	return tile.Y
}
