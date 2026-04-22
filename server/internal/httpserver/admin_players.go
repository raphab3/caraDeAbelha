package httpserver

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const defaultAdminPlayersPage = 1
const defaultAdminPlayersPageSize = 8
const maxAdminPlayersPageSize = 50

type adminPlayerSummary struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	Online     bool   `json:"online"`
	LastSeenAt string `json:"lastSeenAt,omitempty"`
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
	lastSeenAt time.Time
}

func (hub *gameHub) handleAdminPlayers(w http.ResponseWriter, r *http.Request) {
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
		username := profile.Username
		if username == "" {
			username = profileKey
		}

		snapshots = append(snapshots, adminPlayerSnapshot{
			id:         profile.ID,
			username:   username,
			online:     online,
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

func parseAdminPlayersPositiveInt(rawValue string, fallback int) int {
	parsedValue, err := strconv.Atoi(rawValue)
	if err != nil || parsedValue < 1 {
		return fallback
	}

	return parsedValue
}
