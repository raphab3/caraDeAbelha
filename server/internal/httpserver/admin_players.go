package httpserver

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

const defaultAdminPlayersPage = 1
const defaultAdminPlayersPageSize = 8
const maxAdminPlayersPageSize = 50

type adminPlayerSummary struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	Online     bool   `json:"online"`
	Honey      int    `json:"honey"`
	LastSeenAt string `json:"lastSeenAt,omitempty"`
}

type adminPlayerHoneyUpdateRequest struct {
	Honey int `json:"honey"`
}

type adminPlayerHoneyUpdateResponse struct {
	Status    string             `json:"status"`
	Service   string             `json:"service"`
	Timestamp string             `json:"timestamp"`
	Player    adminPlayerSummary `json:"player"`
}

type adminPlayersResponse struct {
	Status     string               `json:"status"`
	Service    string               `json:"service"`
	Timestamp  string               `json:"timestamp"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"pageSize"`
	Total      int                  `json:"total"`
	TotalPages int                  `json:"totalPages"`
	Players    []adminPlayerSummary `json:"players"`
}

type adminPlayerSnapshot struct {
	id         string
	username   string
	online     bool
	honey      int
	lastSeenAt time.Time
}

func (hub *gameHub) handleAdminPlayers(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		hub.handleAdminPlayerHoneyUpdate(w, r)
		return
	}

	if r.Method != http.MethodGet || r.URL.Path != "/admin/players" {
		http.NotFound(w, r)
		return
	}

	page := parseAdminPlayersPositiveInt(r.URL.Query().Get("page"), defaultAdminPlayersPage)
	pageSize := parseAdminPlayersPositiveInt(r.URL.Query().Get("pageSize"), defaultAdminPlayersPageSize)
	if pageSize > maxAdminPlayersPageSize {
		pageSize = maxAdminPlayersPageSize
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(hub.snapshotAdminPlayers(page, pageSize))
}

func (hub *gameHub) snapshotAdminPlayers(page int, pageSize int) adminPlayersResponse {
	if page < 1 {
		page = defaultAdminPlayersPage
	}

	if pageSize < 1 {
		pageSize = defaultAdminPlayersPageSize
	}

	hub.mu.Lock()
	snapshots := make([]adminPlayerSnapshot, 0, len(hub.profiles))
	for profileKey, profile := range hub.profiles {
		if profile == nil {
			continue
		}

		_, online := hub.clients[profile.ID]
		progress := hub.playerProgress[profile.ID]
		username := profile.Username
		if username == "" {
			username = profileKey
		}

		honey := 0
		if progress != nil {
			honey = progress.Honey
		}

		snapshots = append(snapshots, adminPlayerSnapshot{
			id:         profile.ID,
			username:   username,
			online:     online,
			honey:      honey,
			lastSeenAt: profile.LastSeenAt,
		})
	}
	timestamp := hub.now().UTC().Format(time.RFC3339)
	hub.mu.Unlock()

	sort.Slice(snapshots, func(left int, right int) bool {
		if snapshots[left].online != snapshots[right].online {
			return snapshots[left].online
		}

		if !snapshots[left].lastSeenAt.Equal(snapshots[right].lastSeenAt) {
			return snapshots[left].lastSeenAt.After(snapshots[right].lastSeenAt)
		}

		leftUsername := strings.ToLower(snapshots[left].username)
		rightUsername := strings.ToLower(snapshots[right].username)
		if leftUsername != rightUsername {
			return leftUsername < rightUsername
		}

		return snapshots[left].id < snapshots[right].id
	})

	total := len(snapshots)
	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
		if page > totalPages {
			page = totalPages
		}
	} else {
		page = 1
	}

	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	players := make([]adminPlayerSummary, 0, end-start)
	for _, snapshot := range snapshots[start:end] {
		player := adminPlayerSummary{
			ID:       snapshot.id,
			Username: snapshot.username,
			Online:   snapshot.online,
			Honey:    snapshot.honey,
		}

		if !snapshot.lastSeenAt.IsZero() {
			player.LastSeenAt = snapshot.lastSeenAt.UTC().Format(time.RFC3339)
		}

		players = append(players, player)
	}

	return adminPlayersResponse{
		Status:     "ok",
		Service:    "cara-de-abelha-server",
		Timestamp:  timestamp,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
		Players:    players,
	}
}

func (hub *gameHub) handleAdminPlayerHoneyUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodGet+", "+http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	playerID, ok := parseAdminPlayerHoneyPath(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}

	var request adminPlayerHoneyUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if request.Honey < 0 {
		http.Error(w, "honey must be greater than or equal to zero", http.StatusBadRequest)
		return
	}

	player, profileKey, client, progress := hub.updateAdminPlayerHoney(playerID, request.Honey)
	if profileKey == "" || progress == nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}

	if client != nil {
		hub.sendPlayerStatus(client, progress)
	}
	hub.persistPlayerState(profileKey)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(adminPlayerHoneyUpdateResponse{
		Status:    "ok",
		Service:   "cara-de-abelha-server",
		Timestamp: hub.now().UTC().Format(time.RFC3339),
		Player:    player,
	})
}

func parseAdminPlayerHoneyPath(path string) (string, bool) {
	const prefix = "/admin/players/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}

	segments := strings.Split(strings.TrimPrefix(path, prefix), "/")
	if len(segments) != 2 || segments[0] == "" || segments[1] != "honey" {
		return "", false
	}

	return segments[0], true
}

func (hub *gameHub) updateAdminPlayerHoney(playerID string, honey int) (adminPlayerSummary, string, *clientSession, *loopbase.PlayerProgress) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	for profileKey, profile := range hub.profiles {
		if profile == nil || profile.ID != playerID {
			continue
		}

		progress := hub.playerProgress[playerID]
		if progress == nil {
			progress = hub.ensurePlayerProgressLocked(playerID)
		}

		progress.Honey = honey
		progress.UpdatedAt = hub.now()
		profile.UpdatedAt = progress.UpdatedAt

		progressSnapshot := *progress

		return adminPlayerSummary{
			ID:       profile.ID,
			Username: profile.Username,
			Online:   hub.clients[playerID] != nil,
			Honey:    progress.Honey,
			LastSeenAt: func() string {
				if profile.LastSeenAt.IsZero() {
					return ""
				}

				return profile.LastSeenAt.UTC().Format(time.RFC3339)
			}(),
		}, profileKey, hub.clients[playerID], &progressSnapshot
	}

	return adminPlayerSummary{}, "", nil, nil
}

func parseAdminPlayersPositiveInt(rawValue string, fallback int) int {
	parsedValue, err := strconv.Atoi(rawValue)
	if err != nil || parsedValue < 1 {
		return fallback
	}

	return parsedValue
}
