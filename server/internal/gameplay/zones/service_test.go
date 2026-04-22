package zones

import (
"testing"
"time"

"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

// Test 1: Successful zone unlock
func TestUnlockZoneSuccess(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 100, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, honeyCost, reason := service.UnlockZone(player, "zone_1", now)
if !success || honeyCost != 50 || reason != "" {
t.Errorf("success=%v honeyCost=%d reason=%s", success, honeyCost, reason)
}
if player.Honey != 50 {
t.Errorf("honey should be 50, got %d", player.Honey)
}
}

// Test 2: Insufficient honey
func TestUnlockZoneInsufficientHoney(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 30, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, reason := service.UnlockZone(player, "zone_1", now)
if success || reason != "insufficient_honey" {
t.Errorf("should fail with insufficient_honey")
}
}

// Test 3: Zone not found
func TestUnlockZoneNotFound(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 1000, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, reason := service.UnlockZone(player, "zone_invalid", now)
if success || reason != "zone_not_found" {
t.Errorf("should fail with zone_not_found")
}
}

// Test 4: Zone already unlocked
func TestUnlockZoneAlreadyUnlocked(t *testing.T) {
service := NewZoneService()
now := time.Now()
registry := service.GetRegistry()
zone0 := registry.GetZone("zone_0")
zone0.UnlockedAt = &now
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 1000, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, reason := service.UnlockZone(player, "zone_0", now)
if success || reason != "zone_already_unlocked" {
t.Errorf("should fail with zone_already_unlocked")
}
}

// Test 5: Prerequisites not met
func TestUnlockZonePrerequisitesNotMet(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 1000, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, reason := service.UnlockZone(player, "zone_2", now)
if success || reason != "prerequisites_not_met" {
t.Errorf("should fail with prerequisites_not_met")
}
}

// Test 6: Empty zone ID
func TestUnlockZoneEmptyZoneID(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 1000, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, reason := service.UnlockZone(player, "", now)
if success || reason != "zone_id_empty" {
t.Errorf("should fail with zone_id_empty")
}
}

// Test 7: Nil player
func TestUnlockZoneNilPlayer(t *testing.T) {
service := NewZoneService()
now := time.Now()
success, _, reason := service.UnlockZone(nil, "zone_1", now)
if success || reason != "invalid_request" {
t.Errorf("should fail with invalid_request")
}
}

// Test 8: Honey deducted correctly
func TestUnlockZoneHoneyDeductedCorrectly(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 200, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, honeyCost, _ := service.UnlockZone(player, "zone_1", now)
if !success || player.Honey != 200-honeyCost {
t.Errorf("honey not deducted correctly")
}
}

// Test 9: Player timestamp updated
func TestUnlockZoneUpdatesPlayerTimestamp(t *testing.T) {
service := NewZoneService()
oldTime := time.Now().Add(-time.Hour)
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 100, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: oldTime,
}
service.UnlockZone(player, "zone_1", now)
if player.UpdatedAt != now {
t.Errorf("UpdatedAt not updated")
}
}

// Test 10: Chain of prerequisites
func TestUnlockZoneChainOfPrerequisites(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 1000, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, _ := service.UnlockZone(player, "zone_1", now)
if !success {
t.Errorf("zone_1 unlock failed")
}
success, _, _ = service.UnlockZone(player, "zone_2", now.Add(time.Second))
if !success {
t.Errorf("zone_2 unlock failed")
}
if len(player.UnlockedZoneIDs) < 3 {
t.Errorf("unlocked zones should be >= 3")
}
}

// Test 11: Idempotent unlock attempt
func TestUnlockZoneIdempotent(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 100, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
service.UnlockZone(player, "zone_1", now)
honeyAfter := player.Honey
success, _, _ := service.UnlockZone(player, "zone_1", now.Add(time.Second))
if success || player.Honey != honeyAfter {
t.Errorf("second unlock should fail and not change state")
}
}

// Test 12: Boundary honey amount (exact cost)
func TestUnlockZoneBoundaryHoneyAmount(t *testing.T) {
service := NewZoneService()
now := time.Now()
player := &loopbase.PlayerProgress{
PlayerID: "player_1", Honey: 50, UnlockedZoneIDs: []string{"zone_0"}, UpdatedAt: now,
}
success, _, _ := service.UnlockZone(player, "zone_1", now)
if !success || player.Honey != 0 {
t.Errorf("should succeed with exact honey")
}
}

// Test 13: GetZoneState returns all zones
func TestGetZoneState(t *testing.T) {
service := NewZoneService()
zones := service.GetZoneState()

if len(zones) != 5 {
t.Errorf("expected 5 zones, got %d", len(zones))
}

expectedZoneIDs := []string{"zone_0", "zone_1", "zone_2", "zone_3", "zone_4"}
for _, expectedID := range expectedZoneIDs {
found := false
for _, zone := range zones {
if zone.ID == expectedID {
found = true
break
}
}
if !found {
t.Errorf("expected zone %q not found in state", expectedID)
}
}
}

// Test 14: GetZoneState includes zone metadata
func TestGetZoneStateMetadata(t *testing.T) {
service := NewZoneService()
zones := service.GetZoneState()

if len(zones) == 0 {
t.Fatalf("expected at least one zone")
}

zone0 := zones[0]
if zone0.ID == "" {
t.Errorf("zone ID should not be empty")
}
if zone0.Name == "" {
t.Errorf("zone name should not be empty")
}
if zone0.BoundaryX1 == 0 && zone0.BoundaryX2 == 0 {
t.Errorf("zone boundaries should be defined")
}
}
