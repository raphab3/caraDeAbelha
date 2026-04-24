package httpserver

import "time"

const (
	stageStatusDraft     = "draft"
	stageStatusPublished = "published"
	stageStatusActive    = "active"
	stageStatusArchived  = "archived"

	stageValidationValid   = "valid"
	stageValidationInvalid = "invalid"

	gameConfigActiveStageVersionID = "active_stage_version_id"
)

type adminStageSummary struct {
	ID              string    `json:"id"`
	Slug            string    `json:"slug"`
	DisplayName     string    `json:"displayName"`
	Status          string    `json:"status"`
	ActiveVersionID string    `json:"activeVersionId,omitempty"`
	LatestVersionID string    `json:"latestVersionId,omitempty"`
	LatestVersion   int       `json:"latestVersion"`
	Checksum        string    `json:"checksum,omitempty"`
	UpdatedAt       time.Time `json:"updatedAt"`
	CreatedAt       time.Time `json:"createdAt"`
}

type adminStageVersion struct {
	ID               string     `json:"id"`
	StageID          string     `json:"stageId"`
	Version          int        `json:"version"`
	Checksum         string     `json:"checksum"`
	ValidationStatus string     `json:"validationStatus"`
	ValidationErrors []string   `json:"validationErrors"`
	CreatedAt        time.Time  `json:"createdAt"`
	PublishedAt      *time.Time `json:"publishedAt,omitempty"`
	ActivatedAt      *time.Time `json:"activatedAt,omitempty"`
	SourceJSON       string     `json:"sourceJson,omitempty"`
}

type adminStageDetail struct {
	Stage    adminStageSummary   `json:"stage"`
	Versions []adminStageVersion `json:"versions"`
}

type adminStagesResponse struct {
	Status    string              `json:"status"`
	Service   string              `json:"service"`
	Timestamp string              `json:"timestamp"`
	Stages    []adminStageSummary `json:"stages"`
}

type adminStageImportRequest struct {
	SourceJSON string `json:"sourceJson"`
	Actor      string `json:"actor"`
}

type adminStageImportResponse struct {
	Status  string            `json:"status"`
	Stage   adminStageSummary `json:"stage"`
	Version adminStageVersion `json:"version"`
}

type adminStageErrorResponse struct {
	Error  string   `json:"error"`
	Fields []string `json:"fields,omitempty"`
}

type stageImportInput struct {
	StageID     string
	Slug        string
	DisplayName string
	SourceJSON  []byte
	Checksum    string
	Valid       bool
	Errors      []string
	Actor       string
}
