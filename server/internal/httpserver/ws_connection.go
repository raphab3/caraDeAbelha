package httpserver

import (
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
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
		return connection.SetReadDeadline(hub.now().Add(hub.pongWait))
	})

	stopPingLoop := make(chan struct{})
	go hub.runPingLoop(client, stopPingLoop)

	hub.sendToClient(client, sessionMessage{
		Type:     "session",
		PlayerID: client.id,
		Username: username,
	})
	hub.broadcast()

	defer func() {
		close(stopPingLoop)
		_ = connection.Close()

		if hub.unregister(client) {
			hub.broadcast()
		}
	}()

	for {
		var action playerAction
		if err := connection.ReadJSON(&action); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket read failed for %s: %v", client.id, err)
			}
			return
		}

		if err := connection.SetReadDeadline(hub.now().Add(hub.pongWait)); err != nil {
			return
		}

		var ok bool

		switch action.Type {
		case "move":
			ok = hub.movePlayer(client.id, action.Dir)
		case "move_to":
			ok = hub.movePlayerTo(client.id, action.X, action.Z)
		case "respawn":
			ok = hub.respawnPlayer(client.id)
		default:
			continue
		}

		if !ok {
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
