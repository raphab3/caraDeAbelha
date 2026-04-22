package loopbase

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// LoopBaseService manages the lifecycle of gameplay entities (flowers and hives) during a session.
// It maintains collections of FlowerNode and HiveNode instances, initializes them with proper state,
// and provides distance validation for player interactions.
type LoopBaseService struct {
	mu     sync.RWMutex
	flowers map[string][]*FlowerNode // key: zoneID, value: list of flowers
	hives   map[string][]*HiveNode   // key: zoneID, value: list of hives
}

// NewLoopBaseService creates a new LoopBaseService with initialized test data.
// It populates "zone:start" with 2 flowers and 1 hive as baseline gameplay entities.
func NewLoopBaseService() *LoopBaseService {
	service := &LoopBaseService{
		flowers: make(map[string][]*FlowerNode),
		hives:   make(map[string][]*HiveNode),
	}

	// Initialize zone:start with test data
	// Flowers
	flower1 := &FlowerNode{
		ID:             "flower:start:1",
		X:              5.0,
		Y:              5.0,
		GroundY:        0.0,
		ZoneID:         "zone:start",
		PollenAvailable: 100,
		PollenCapacity: 100,
		CollectRadius:  2.5,
		RegenPerSecond: 0.1,
		YieldPerClick:  5,
	}

	flower2 := &FlowerNode{
		ID:             "flower:start:2",
		X:              10.0,
		Y:              8.0,
		GroundY:        0.0,
		ZoneID:         "zone:start",
		PollenAvailable: 100,
		PollenCapacity: 100,
		CollectRadius:  2.5,
		RegenPerSecond: 0.1,
		YieldPerClick:  5,
	}

	service.flowers["zone:start"] = []*FlowerNode{flower1, flower2}

	// Hive
	hive1 := &HiveNode{
		ID:             "hive:start",
		X:              0.0,
		Y:              0.0,
		GroundY:        -0.5,
		ZoneID:         "zone:start",
		DepositRadius:  3.0,
		ConversionRate: 10,
	}

	service.hives["zone:start"] = []*HiveNode{hive1}

	return service
}

// GetFlowersByZone returns all flowers in the specified zone.
// Returns an empty slice if the zone has no flowers.
func (s *LoopBaseService) GetFlowersByZone(zoneID string) []*FlowerNode {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if flowers, ok := s.flowers[zoneID]; ok {
		return flowers
	}

	return []*FlowerNode{}
}

// GetHivesByZone returns all hives in the specified zone.
// Returns an empty slice if the zone has no hives.
func (s *LoopBaseService) GetHivesByZone(zoneID string) []*HiveNode {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if hives, ok := s.hives[zoneID]; ok {
		return hives
	}

	return []*HiveNode{}
}

// IsPlayerInFlowerRange validates whether a player is within interaction distance of a flower.
// Uses Euclidean distance calculation: sqrt((x2-x1)^2 + (y2-y1)^2)
// Returns true if distance <= collectRadius.
func (s *LoopBaseService) IsPlayerInFlowerRange(playerX float64, playerY float64, flower *FlowerNode) bool {
	if flower == nil {
		return false
	}

	distance := calculateDistance(playerX, playerY, flower.X, flower.Y)
	return distance <= flower.CollectRadius
}

// IsPlayerInHiveRange validates whether a player is within interaction distance of a hive.
// Uses Euclidean distance calculation: sqrt((x2-x1)^2 + (y2-y1)^2)
// Returns true if distance <= depositRadius.
func (s *LoopBaseService) IsPlayerInHiveRange(playerX float64, playerY float64, hive *HiveNode) bool {
	if hive == nil {
		return false
	}

	distance := calculateDistance(playerX, playerY, hive.X, hive.Y)
	return distance <= hive.DepositRadius
}

// AddFlowerToZone adds a flower to a specific zone.
// This method is primarily used for testing and dynamic entity management.
func (s *LoopBaseService) AddFlowerToZone(zoneID string, flower *FlowerNode) error {
	if flower == nil {
		return fmt.Errorf("cannot add nil flower")
	}

	if zoneID == "" {
		return fmt.Errorf("zoneID cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.flowers[zoneID] == nil {
		s.flowers[zoneID] = make([]*FlowerNode, 0)
	}

	s.flowers[zoneID] = append(s.flowers[zoneID], flower)
	return nil
}

// AddHiveToZone adds a hive to a specific zone.
// This method is primarily used for testing and dynamic entity management.
func (s *LoopBaseService) AddHiveToZone(zoneID string, hive *HiveNode) error {
	if hive == nil {
		return fmt.Errorf("cannot add nil hive")
	}

	if zoneID == "" {
		return fmt.Errorf("zoneID cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.hives[zoneID] == nil {
		s.hives[zoneID] = make([]*HiveNode, 0)
	}

	s.hives[zoneID] = append(s.hives[zoneID], hive)
	return nil
}

// CanCollectFlower validates whether a player can collect pollen from a flower.
// It checks four conditions:
// 1. Player is within the flower's collect radius
// 2. Flower has pollen available to collect
// 3. Player has capacity remaining in their mochila (PollenCarried < PollenCapacity)
// 4. Flower and playerProgress are not nil
// Returns (success bool, reason string) for detailed validation feedback.
func (s *LoopBaseService) CanCollectFlower(
	playerProgress *PlayerProgress,
	flower *FlowerNode,
	playerX float64,
	playerY float64,
) (bool, string) {
	// Validate inputs
	if playerProgress == nil {
		return false, "player progress is nil"
	}

	if flower == nil {
		return false, "flower is nil"
	}

	// Check if player is within collection range
	if !s.IsPlayerInFlowerRange(playerX, playerY, flower) {
		return false, "player is out of range"
	}

	// Check if flower has pollen available
	if flower.PollenAvailable <= 0 {
		return false, "flower has no pollen available"
	}

	// Check if player has capacity remaining
	if playerProgress.PollenCarried >= playerProgress.PollenCapacity {
		return false, "mochila is full"
	}

	return true, ""
}

// CollectFlowerPollen processes the collection of pollen from a flower.
// It validates collection preconditions, deducts pollen from the flower,
// adds pollen to the player's inventory (respecting capacity limit),
// and returns the amount collected.
// Returns (pollenCollected int, err error).
// All state changes are authoritative and happen on the server.
func (s *LoopBaseService) CollectFlowerPollen(
	playerProgress *PlayerProgress,
	flower *FlowerNode,
	playerX float64,
	playerY float64,
) (int, error) {
	// Validate collection is possible
	canCollect, reason := s.CanCollectFlower(playerProgress, flower, playerX, playerY)
	if !canCollect {
		return 0, fmt.Errorf("cannot collect pollen: %s", reason)
	}

	// Calculate how much pollen to collect
	// Limited by: flower yield, flower available pollen, and player remaining capacity
	availableCapacity := playerProgress.PollenCapacity - playerProgress.PollenCarried
	pollenToCollect := flower.YieldPerClick

	// Don't collect more than flower has available
	if pollenToCollect > flower.PollenAvailable {
		pollenToCollect = flower.PollenAvailable
	}

	// Don't collect more than player can carry
	if pollenToCollect > availableCapacity {
		pollenToCollect = availableCapacity
	}

	// Update flower state: remove pollen (minimum 0)
	flower.PollenAvailable -= pollenToCollect
	if flower.PollenAvailable < 0 {
		flower.PollenAvailable = 0
	}
	flower.UpdatedAt = time.Now()

	// Update player state: add pollen to inventory
	playerProgress.PollenCarried += pollenToCollect
	playerProgress.UpdatedAt = time.Now()

	return pollenToCollect, nil
}

// CanDepositAtHive validates whether a player can deposit pollen at a hive.
// It checks two conditions:
// 1. Player has pollen to deposit (PollenCarried > 0)
// 2. Hive is not nil
// Returns (success bool, reason string) for detailed validation feedback.
func (s *LoopBaseService) CanDepositAtHive(
	playerProgress *PlayerProgress,
	hive *HiveNode,
) (bool, string) {
	// Validate inputs
	if playerProgress == nil {
		return false, "player progress is nil"
	}

	if hive == nil {
		return false, "hive is nil"
	}

	// Check if player has pollen to deposit
	if playerProgress.PollenCarried <= 0 {
		return false, "player has no pollen to deposit"
	}

	return true, ""
}

// DepositPollenToHoney processes the conversion of pollen to honey at a hive.
// It validates deposit preconditions, converts pollen to honey using the hive's conversion rate,
// updates player progress (adds honey, clears pollen), and updates the hive timestamp.
// Returns (honeyGained int, err error).
// All state changes are authoritative and happen on the server.
// Conversion formula: honeyGained = playerProgress.PollenCarried / hiveNode.ConversionRate (integer division)
func (s *LoopBaseService) DepositPollenToHoney(
	playerProgress *PlayerProgress,
	hive *HiveNode,
) (int, error) {
	// Validate deposit is possible
	canDeposit, reason := s.CanDepositAtHive(playerProgress, hive)
	if !canDeposit {
		return 0, fmt.Errorf("cannot deposit pollen: %s", reason)
	}

	// Calculate honey gained using integer division
	// Example: 50 pollen ÷ 10 conversion rate = 5 honey
	honeyGained := playerProgress.PollenCarried / hive.ConversionRate

	// Handle edge case: if conversion rate is very high and pollen is low, honey could be 0
	// This is mathematically correct (e.g., 5 pollen ÷ 10 rate = 0 honey)
	// but still allowed since we validated PollenCarried > 0

	// Update player state: add honey and clear pollen
	playerProgress.Honey += honeyGained
	playerProgress.PollenCarried = 0
	playerProgress.UpdatedAt = time.Now()

	// Update hive state: record the deposit timestamp
	hive.UpdatedAt = time.Now()

	return honeyGained, nil
}

// calculateDistance computes the Euclidean distance between two 2D points.
// Formula: sqrt((x2-x1)^2 + (y2-y1)^2)
func calculateDistance(x1 float64, y1 float64, x2 float64, y2 float64) float64 {
	deltaX := x2 - x1
	deltaY := y2 - y1
	return math.Hypot(deltaX, deltaY)
}
