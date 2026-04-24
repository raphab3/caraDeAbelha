package httpserver

import (
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

func (hub *gameHub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	profileKey, username, err := parseUsername(r.URL.Query().Get("username"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	connection, err := hub.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client, replacedClient, err := hub.register(connection, profileKey, username)
	if err != nil {
		writeCloseMessage(connection, err.Error())
		return
	}

	if replacedClient != nil {
		_ = replacedClient.conn.Close()
	}

	if err := connection.SetReadDeadline(hub.now().Add(hub.pongWait)); err != nil {
		_ = connection.Close()
		return
	}

	connection.SetPongHandler(func(string) error {
		now := hub.now()
		hub.touchPlayerLastSeen(client.id, now)
		return connection.SetReadDeadline(now.Add(hub.pongWait))
	})

	stopPingLoop := make(chan struct{})
	go hub.runPingLoop(client, stopPingLoop)

	hub.sendToClient(client, sessionMessage{
		Type:     "session",
		PlayerID: client.id,
		Username: username,
	})

	hub.broadcast()
	progress := hub.ensurePlayerProgress(client.id)
	if shouldSendInitialProgress(progress) {
		hub.sendPlayerStatus(client, progress)
		hub.sendZoneState(client, client.id)
	}

	defer func() {
		close(stopPingLoop)
		_ = connection.Close()
		hub.persistPlayerState(client.profileKey)

		if hub.unregister(client) {
			hub.broadcast()
		}
	}()

	for {
		var raw map[string]interface{}
		if err := connection.ReadJSON(&raw); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket read failed for %s: %v", client.id, err)
			}
			return
		}

		now := hub.now()
		hub.touchPlayerLastSeen(client.id, now)

		if err := connection.SetReadDeadline(now.Add(hub.pongWait)); err != nil {
			return
		}

		actionType, ok := raw["type"].(string)
		if !ok {
			continue
		}

		var shouldBroadcast bool

		switch actionType {
		case "move":
			action := playerAction{}
			if dir, ok := raw["dir"].(string); ok {
				action.Dir = dir
			}
			shouldBroadcast = hub.movePlayer(client.id, action.Dir)

		case "move_to":
			var x, z float64
			if xVal, ok := raw["x"].(float64); ok {
				x = xVal
			}
			if zVal, ok := raw["z"].(float64); ok {
				z = zVal
			}
			shouldBroadcast = hub.movePlayerTo(client.id, x, z)

		case "respawn":
			shouldBroadcast = hub.respawnPlayer(client.id)

		case "collect_flower":
			nodeID, ok := raw["flowerId"].(string)
			if !ok || nodeID == "" {
				nodeID, ok = raw["nodeId"].(string)
			}
			if !ok {
				continue
			}
			shouldBroadcast = hub.collectFlower(client.id, nodeID)

		case "deposit_honey", "deposit":
			shouldBroadcast = hub.depositHoney(client.id)

		case "unlock_zone":
			zoneID, ok := raw["zoneId"].(string)
			if !ok {
				continue
			}
			shouldBroadcast = hub.unlockZone(client.id, zoneID)

		case "buy_skill":
			skillID, ok := raw["skillId"].(string)
			if !ok {
				continue
			}
			shouldBroadcast = hub.buySkill(client.id, skillID)

		case "equip_skill":
			skillID, ok := raw["skillId"].(string)
			if !ok {
				continue
			}
			slotValue, ok := raw["slot"].(float64)
			if !ok {
				continue
			}
			shouldBroadcast = hub.equipSkill(client.id, skillID, int(slotValue))

		case "upgrade_skill":
			skillID, ok := raw["skillId"].(string)
			if !ok {
				continue
			}
			shouldBroadcast = hub.upgradeSkill(client.id, skillID)

		case "use_skill":
			slotValue, ok := raw["slot"].(float64)
			if !ok {
				continue
			}
			shouldBroadcast = hub.useSkill(client.id, int(slotValue))

		default:
			continue
		}

		if !shouldBroadcast {
			continue
		}

		hub.broadcast()
	}
}

func (hub *gameHub) broadcast() {
	snapshots := hub.collectClientSnapshots()

	for _, snapshot := range snapshots {
		if err := hub.writeJSON(snapshot.client, snapshot.message); err != nil {
			log.Printf("websocket write failed for %s: %v", snapshot.client.id, err)
		}
	}
}

func (hub *gameHub) sendToClient(client *clientSession, message sessionMessage) {
	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

// sendPlayerStatus sends a player_status message to a client.
// Called when player progress changes (pollen, honey, level, etc).
func (hub *gameHub) sendPlayerStatus(client *clientSession, progress *loopbase.PlayerProgress) {
	if client == nil || progress == nil {
		return
	}

	message := newPlayerStatusMessage(progress)
	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

// sendInteractionResult sends an interaction_result message to a client.
// Called to provide immediate feedback on player actions like collecting flowers or depositing pollen.
func (hub *gameHub) sendInteractionResult(client *clientSession, action string, success bool, amount int, reason string) {
	hub.sendInteractionResultWithCode(client, action, success, amount, reason, "")
}

func (hub *gameHub) sendInteractionResultWithCode(client *clientSession, action string, success bool, amount int, reason string, reasonCode string) {
	if client == nil {
		return
	}

	timestamp := hub.now().UnixMilli()
	message := newInteractionResultMessageWithCode(action, success, amount, reason, reasonCode, timestamp)
	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

func (hub *gameHub) sendSkillEffectsToStageLocked(stageID string, effects []skillEffectMessage) {
	if len(effects) == 0 {
		return
	}

	message := skillEffectsMessage{
		Type:    "skill_effects",
		Effects: effects,
	}

	for _, client := range hub.clients {
		viewer := hub.players[client.id]
		if viewer == nil || viewer.StageID != stageID {
			continue
		}

		if err := hub.writeJSON(client, message); err != nil {
			log.Printf("websocket write failed for %s: %v", client.id, err)
		}
	}
}

// sendZoneState sends zone metadata and unlock status to a client.
// Called on player login and when a zone is unlocked.
func (hub *gameHub) sendZoneState(client *clientSession, playerID string) {
	if client == nil || playerID == "" {
		return
	}

	hub.mu.Lock()
	progress := hub.playerProgress[playerID]
	hub.mu.Unlock()

	if progress == nil {
		return
	}

	zoneList := hub.zones.GetZoneState()
	now := hub.now()
	message := newZoneStateMessage(zoneList, progress.UnlockedZoneIDs, now)

	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

func (hub *gameHub) ensurePlayerProgress(playerID string) *loopbase.PlayerProgress {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	return hub.ensurePlayerProgressLocked(playerID)
}

func shouldSendInitialProgress(progress *loopbase.PlayerProgress) bool {
	if progress == nil {
		return false
	}

	if progress.PollenCarried != 0 || progress.Honey != 0 || progress.Level != 1 || progress.XP != 0 || progress.SkillPoints != 1 {
		return true
	}
	if progress.CurrentEnergy != defaultMaxPlayerEnergy || progress.MaxEnergy != defaultMaxPlayerEnergy {
		return true
	}

	if progress.PollenCapacity != 40 || progress.CurrentZoneID != zones.DefaultCurrentZoneID() {
		return true
	}

	if len(progress.OwnedSkillIDs) > 0 {
		return true
	}

	for _, skillID := range progress.EquippedSkills {
		if skillID != "" {
			return true
		}
	}

	return len(progress.UnlockedZoneIDs) != 1 || progress.UnlockedZoneIDs[0] != zones.DefaultCurrentZoneID()
}

func (hub *gameHub) collectClientSnapshots() []clientSnapshot {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	snapshots := make([]clientSnapshot, 0, len(hub.clients))
	for _, client := range hub.clients {
		viewer := hub.players[client.id]
		if viewer == nil {
			continue
		}

		snapshots = append(snapshots, clientSnapshot{
			client:  client,
			message: hub.snapshotForPlayerLocked(viewer),
		})
	}

	return snapshots
}

func (hub *gameHub) writeJSON(client *clientSession, message any) error {
	client.writeMu.Lock()
	defer client.writeMu.Unlock()

	if err := client.conn.SetWriteDeadline(hub.now().Add(hub.writeWait)); err != nil {
		return err
	}

	return client.conn.WriteJSON(message)
}

func (hub *gameHub) writeControl(client *clientSession, messageType int, payload []byte) error {
	client.writeMu.Lock()
	defer client.writeMu.Unlock()

	return client.conn.WriteControl(messageType, payload, hub.now().Add(hub.writeWait))
}

func (hub *gameHub) runPingLoop(client *clientSession, stop <-chan struct{}) {
	if client == nil || hub.pingPeriod <= 0 {
		return
	}

	ticker := time.NewTicker(hub.pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if err := hub.writeControl(client, websocket.PingMessage, nil); err != nil {
				_ = client.conn.Close()
				return
			}
		}
	}
}

func parseUsername(rawUsername string) (string, string, error) {
	username := strings.Join(strings.Fields(strings.TrimSpace(rawUsername)), " ")
	if username == "" {
		return "", "", errInvalidUsername
	}

	if utf8.RuneCountInString(username) > maxUsernameLength {
		return "", "", errInvalidUsername
	}

	return strings.ToLower(username), username, nil
}

func writeCloseMessage(connection *websocket.Conn, message string) {
	deadline := time.Now().Add(time.Second)
	_ = connection.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.ClosePolicyViolation, message),
		deadline,
	)
	_ = connection.Close()
}
