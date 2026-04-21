package httpserver

import "time"

type playerAction struct {
	Type string  `json:"type"`
	Dir  string  `json:"dir,omitempty"`
	X    float64 `json:"x,omitempty"`
	Z    float64 `json:"z,omitempty"`
}

type heartbeatMessage struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
}

type playerState struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	TargetX   *float64  `json:"targetX,omitempty"`
	TargetY   *float64  `json:"targetY,omitempty"`
	Speed     float64   `json:"speed"`
	UpdatedAt time.Time `json:"-"`
}

type sessionMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

type worldStateMessage struct {
	Type           string            `json:"type"`
	Tick           uint64            `json:"tick"`
	Players        []playerState     `json:"players"`
	Chunks         []worldChunkState `json:"chunks"`
	CenterChunkX   int               `json:"centerChunkX"`
	CenterChunkY   int               `json:"centerChunkY"`
	RenderDistance int               `json:"renderDistance"`
	ChunkSize      float64           `json:"chunkSize"`
}

type worldFlowerState struct {
	ID         string  `json:"id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	GroundY    float64 `json:"groundY"`
	Scale      float64 `json:"scale"`
	PetalColor string  `json:"petalColor"`
	CoreColor  string  `json:"coreColor"`
}

type worldHiveState struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	GroundY   float64 `json:"groundY"`
	Scale     float64 `json:"scale"`
	ToneColor string  `json:"toneColor"`
	GlowColor string  `json:"glowColor"`
}

type worldTileState struct {
	ID   string  `json:"id"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Z    float64 `json:"z"`
	Type string  `json:"type"`
}

type worldTreeState struct {
	ID      string  `json:"id"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	GroundY float64 `json:"groundY"`
	Scale   float64 `json:"scale"`
}

type worldChunkState struct {
	Key     string             `json:"key"`
	X       int                `json:"x"`
	Y       int                `json:"y"`
	Tiles   []worldTileState   `json:"tiles"`
	Flowers []worldFlowerState `json:"flowers"`
	Trees   []worldTreeState   `json:"trees"`
	Hives   []worldHiveState   `json:"hives"`
}

type clientSnapshot struct {
	client  *clientSession
	message worldStateMessage
}
