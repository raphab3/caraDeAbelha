package httpserver

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

// TestPlayerStatusMessageStructure verifies playerStatusMessage JSON marshaling.
func TestPlayerStatusMessageStructure(t *testing.T) {
	progress := &loopbase.PlayerProgress{
		PlayerID:        "player-123",
		PollenCarried:   42,
		PollenCapacity:  100,
		Honey:           5,
		Level:           2,
		XP:              150,
		SkillPoints:     1,
		CurrentZoneID:   "zone-forest",
		UnlockedZoneIDs: []string{"zone-forest", "zone-meadow"},
		UpdatedAt:       time.Now(),
	}

	msg := newPlayerStatusMessage(progress)

	// Verify type field
	if msg.Type != "player_status" {
		t.Errorf("expected type 'player_status', got %q", msg.Type)
	}

	// Verify all fields are copied correctly
	if msg.PlayerID != progress.PlayerID {
		t.Errorf("expected PlayerID %q, got %q", progress.PlayerID, msg.PlayerID)
	}
	if msg.PollenCarried != progress.PollenCarried {
		t.Errorf("expected PollenCarried %d, got %d", progress.PollenCarried, msg.PollenCarried)
	}
	if msg.PollenCapacity != progress.PollenCapacity {
		t.Errorf("expected PollenCapacity %d, got %d", progress.PollenCapacity, msg.PollenCapacity)
	}
	if msg.Honey != progress.Honey {
		t.Errorf("expected Honey %d, got %d", progress.Honey, msg.Honey)
	}
	if msg.Level != progress.Level {
		t.Errorf("expected Level %d, got %d", progress.Level, msg.Level)
	}
	if msg.XP != progress.XP {
		t.Errorf("expected XP %d, got %d", progress.XP, msg.XP)
	}
	if msg.SkillPoints != progress.SkillPoints {
		t.Errorf("expected SkillPoints %d, got %d", progress.SkillPoints, msg.SkillPoints)
	}
	if msg.CurrentZoneID != progress.CurrentZoneID {
		t.Errorf("expected CurrentZoneID %q, got %q", progress.CurrentZoneID, msg.CurrentZoneID)
	}
	if len(msg.UnlockedZoneIDs) != len(progress.UnlockedZoneIDs) {
		t.Errorf("expected %d unlocked zones, got %d", len(progress.UnlockedZoneIDs), len(msg.UnlockedZoneIDs))
	}
}

// TestPlayerStatusMessageJSON verifies JSON marshaling with camelCase fields.
func TestPlayerStatusMessageJSON(t *testing.T) {
	progress := &loopbase.PlayerProgress{
		PlayerID:        "player-456",
		PollenCarried:   10,
		PollenCapacity:  50,
		Honey:           3,
		Level:           1,
		XP:              50,
		SkillPoints:     0,
		CurrentZoneID:   "zone-start",
		UnlockedZoneIDs: []string{"zone-start"},
	}

	msg := newPlayerStatusMessage(progress)
	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	// Parse to verify field names are camelCase
	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	// Check for camelCase field names (not snake_case or PascalCase)
	expectedFields := map[string]bool{
		"type":            true,
		"playerId":        true,
		"pollenCarried":   true,
		"pollenCapacity":  true,
		"honey":           true,
		"level":           true,
		"xp":              true,
		"skillPoints":     true,
		"currentZoneId":   true,
		"unlockedZoneIds": true,
	}

	for expectedField := range expectedFields {
		if _, exists := parsed[expectedField]; !exists {
			t.Errorf("expected JSON field %q not found", expectedField)
		}
	}

	// Verify values in JSON
	if parsed["type"] != "player_status" {
		t.Errorf("expected type 'player_status' in JSON, got %v", parsed["type"])
	}
	if parsed["playerId"] != "player-456" {
		t.Errorf("expected playerId 'player-456' in JSON, got %v", parsed["playerId"])
	}
	if parsed["pollenCarried"] != float64(10) {
		t.Errorf("expected pollenCarried 10 in JSON, got %v", parsed["pollenCarried"])
	}
	if parsed["honey"] != float64(3) {
		t.Errorf("expected honey 3 in JSON, got %v", parsed["honey"])
	}
}

// TestPlayerStatusMessageWithNilProgress handles nil input gracefully.
func TestPlayerStatusMessageWithNilProgress(t *testing.T) {
	msg := newPlayerStatusMessage(nil)

	// Should have type set even with nil progress
	if msg.Type != "player_status" {
		t.Errorf("expected type 'player_status' even with nil progress, got %q", msg.Type)
	}

	// Other fields should be zero values
	if msg.PlayerID != "" {
		t.Errorf("expected empty PlayerID with nil progress, got %q", msg.PlayerID)
	}
	if msg.PollenCarried != 0 {
		t.Errorf("expected zero PollenCarried with nil progress, got %d", msg.PollenCarried)
	}
}

// TestInteractionResultMessageSuccessful verifies successful action feedback.
func TestInteractionResultMessageSuccessful(t *testing.T) {
	timestamp := int64(1700000000000)
	msg := newInteractionResultMessage("collect_flower", true, 15, "", timestamp)

	if msg.Type != "interaction_result" {
		t.Errorf("expected type 'interaction_result', got %q", msg.Type)
	}
	if msg.Action != "collect_flower" {
		t.Errorf("expected action 'collect_flower', got %q", msg.Action)
	}
	if !msg.Success {
		t.Errorf("expected success=true, got %v", msg.Success)
	}
	if msg.Amount != 15 {
		t.Errorf("expected amount 15, got %d", msg.Amount)
	}
	if msg.Reason != "" {
		t.Errorf("expected empty reason for success, got %q", msg.Reason)
	}
	if msg.Timestamp != timestamp {
		t.Errorf("expected timestamp %d, got %d", timestamp, msg.Timestamp)
	}
}

// TestInteractionResultMessageError verifies error action feedback.
func TestInteractionResultMessageError(t *testing.T) {
	timestamp := int64(1700000000000)
	msg := newInteractionResultMessage("collect_flower", false, 0, "backpack_full", timestamp)

	if msg.Type != "interaction_result" {
		t.Errorf("expected type 'interaction_result', got %q", msg.Type)
	}
	if msg.Action != "collect_flower" {
		t.Errorf("expected action 'collect_flower', got %q", msg.Action)
	}
	if msg.Success {
		t.Errorf("expected success=false, got %v", msg.Success)
	}
	if msg.Amount != 0 {
		t.Errorf("expected amount 0 for failure, got %d", msg.Amount)
	}
	if msg.Reason != "backpack_full" {
		t.Errorf("expected reason 'backpack_full', got %q", msg.Reason)
	}
}

// TestInteractionResultMessageJSON verifies JSON marshaling with camelCase fields.
func TestInteractionResultMessageJSON(t *testing.T) {
	timestamp := int64(1700000000000)
	msg := newInteractionResultMessage("deposit_pollen", true, 50, "", timestamp)

	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	// Parse to verify field names are camelCase
	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	// Check for camelCase field names
	expectedFields := []string{"type", "action", "success", "amount", "reason", "timestamp"}
	for _, expectedField := range expectedFields {
		if _, exists := parsed[expectedField]; !exists {
			t.Errorf("expected JSON field %q not found", expectedField)
		}
	}

	// Verify values in JSON
	if parsed["type"] != "interaction_result" {
		t.Errorf("expected type 'interaction_result' in JSON, got %v", parsed["type"])
	}
	if parsed["action"] != "deposit_pollen" {
		t.Errorf("expected action 'deposit_pollen' in JSON, got %v", parsed["action"])
	}
	if parsed["success"] != true {
		t.Errorf("expected success true in JSON, got %v", parsed["success"])
	}
	if parsed["amount"] != float64(50) {
		t.Errorf("expected amount 50 in JSON, got %v", parsed["amount"])
	}
}

// TestInteractionResultMessageVariousActions verifies different action types.
func TestInteractionResultMessageVariousActions(t *testing.T) {
	actions := []string{"collect_flower", "deposit_pollen", "enter_hive", "level_up"}

	for _, action := range actions {
		msg := newInteractionResultMessage(action, true, 0, "", 0)
		if msg.Action != action {
			t.Errorf("expected action %q, got %q", action, msg.Action)
		}
	}
}

// TestPlayerStatusMessageRoundTrip verifies marshal/unmarshal cycle.
func TestPlayerStatusMessageRoundTrip(t *testing.T) {
	progress := &loopbase.PlayerProgress{
		PlayerID:        "player-789",
		PollenCarried:   25,
		PollenCapacity:  100,
		Honey:           12,
		Level:           3,
		XP:              500,
		SkillPoints:     2,
		CurrentZoneID:   "zone-meadow",
		UnlockedZoneIDs: []string{"zone-start", "zone-forest", "zone-meadow"},
	}

	original := newPlayerStatusMessage(progress)
	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	var restored playerStatusMessage
	if err := json.Unmarshal(jsonData, &restored); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	if restored.Type != original.Type {
		t.Errorf("type mismatch after round-trip: %q vs %q", original.Type, restored.Type)
	}
	if restored.PlayerID != original.PlayerID {
		t.Errorf("PlayerID mismatch: %q vs %q", original.PlayerID, restored.PlayerID)
	}
	if restored.PollenCarried != original.PollenCarried {
		t.Errorf("PollenCarried mismatch: %d vs %d", original.PollenCarried, restored.PollenCarried)
	}
	if restored.Honey != original.Honey {
		t.Errorf("Honey mismatch: %d vs %d", original.Honey, restored.Honey)
	}
	if len(restored.UnlockedZoneIDs) != len(original.UnlockedZoneIDs) {
		t.Errorf("UnlockedZoneIDs length mismatch: %d vs %d", len(original.UnlockedZoneIDs), len(restored.UnlockedZoneIDs))
	}
}

// TestInteractionResultMessageRoundTrip verifies marshal/unmarshal cycle.
func TestInteractionResultMessageRoundTrip(t *testing.T) {
	timestamp := int64(1700000000000)
	original := newInteractionResultMessage("collect_flower", true, 20, "", timestamp)

	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	var restored interactionResultMessage
	if err := json.Unmarshal(jsonData, &restored); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	if restored.Type != original.Type {
		t.Errorf("type mismatch: %q vs %q", original.Type, restored.Type)
	}
	if restored.Action != original.Action {
		t.Errorf("action mismatch: %q vs %q", original.Action, restored.Action)
	}
	if restored.Success != original.Success {
		t.Errorf("success mismatch: %v vs %v", original.Success, restored.Success)
	}
	if restored.Amount != original.Amount {
		t.Errorf("amount mismatch: %d vs %d", original.Amount, restored.Amount)
	}
	if restored.Timestamp != original.Timestamp {
		t.Errorf("timestamp mismatch: %d vs %d", original.Timestamp, restored.Timestamp)
	}
}

// TestPlayerStatusMessageUnlockedZonesSlice verifies slice handling in unmarshaling.
func TestPlayerStatusMessageUnlockedZonesSlice(t *testing.T) {
	progress := &loopbase.PlayerProgress{
		PlayerID:        "player-zones",
		UnlockedZoneIDs: []string{"zone-1", "zone-2", "zone-3"},
	}

	msg := newPlayerStatusMessage(progress)
	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	var restored playerStatusMessage
	if err := json.Unmarshal(jsonData, &restored); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	if len(restored.UnlockedZoneIDs) != 3 {
		t.Fatalf("expected 3 unlocked zones, got %d", len(restored.UnlockedZoneIDs))
	}

	for i, expectedZone := range []string{"zone-1", "zone-2", "zone-3"} {
		if restored.UnlockedZoneIDs[i] != expectedZone {
			t.Errorf("zone[%d] mismatch: expected %q, got %q", i, expectedZone, restored.UnlockedZoneIDs[i])
		}
	}
}

// TestPlayerStatusMessageEmptyUnlockedZones handles empty zone list.
func TestPlayerStatusMessageEmptyUnlockedZones(t *testing.T) {
	progress := &loopbase.PlayerProgress{
		PlayerID:        "player-no-zones",
		UnlockedZoneIDs: []string{},
	}

	msg := newPlayerStatusMessage(progress)
	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal to JSON: %v", err)
	}

	var restored playerStatusMessage
	if err := json.Unmarshal(jsonData, &restored); err != nil {
		t.Fatalf("unmarshal JSON: %v", err)
	}

	if restored.UnlockedZoneIDs == nil || len(restored.UnlockedZoneIDs) != 0 {
		t.Errorf("expected empty zones, got %v", restored.UnlockedZoneIDs)
	}
}
