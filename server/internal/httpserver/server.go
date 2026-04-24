package httpserver

import (
	"encoding/json"
	"net/http"
	"time"
)

type healthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
}

type metricsResponse struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	Timestamp     string `json:"timestamp"`
	ActivePlayers int    `json:"activePlayers"`
	Tick          uint64 `json:"tick"`
}

func NewHandler() http.Handler {
	mux := http.NewServeMux()
	gameHub := newGameHub()

	mux.HandleFunc("/ws", gameHub.handleWebSocket)
	mux.HandleFunc("/admin/players", gameHub.handleAdminPlayers)
	mux.HandleFunc("/admin/players/", gameHub.handleAdminPlayers)
	mux.HandleFunc("/admin/stages", gameHub.handleAdminStages)
	mux.HandleFunc("/admin/stages/", gameHub.handleAdminStages)
	mux.HandleFunc("/admin/stage-versions/", gameHub.handleAdminStages)

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("Cara de Abelha server is running"))
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		response := healthResponse{
			Status:    "ok",
			Service:   "cara-de-abelha-server",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}

		_ = json.NewEncoder(w).Encode(response)
	})

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(gameHub.snapshotMetrics())
	})

	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
