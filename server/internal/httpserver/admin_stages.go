package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

const maxStageImportBytes = 8 << 20

func (hub *gameHub) handleAdminStages(w http.ResponseWriter, r *http.Request) {
	if hub == nil || hub.stageStore == nil {
		writeStageError(w, http.StatusServiceUnavailable, "stage store unavailable", nil)
		return
	}

	trimmedPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/"), "/")
	parts := []string{}
	if trimmedPath != "" {
		parts = strings.Split(trimmedPath, "/")
	}

	if len(parts) == 1 && parts[0] == "stages" && r.Method == http.MethodGet {
		hub.listAdminStages(w, r)
		return
	}

	if len(parts) == 2 && parts[0] == "stages" && parts[1] == "import" && r.Method == http.MethodPost {
		hub.importAdminStage(w, r)
		return
	}

	if len(parts) == 2 && parts[0] == "stages" && r.Method == http.MethodGet {
		hub.getAdminStage(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stages" && parts[2] == "archive" && r.Method == http.MethodPost {
		hub.archiveAdminStage(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stages" && parts[2] == "rollback" && r.Method == http.MethodPost {
		hub.rollbackAdminStage(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stage-versions" && parts[2] == "export" && r.Method == http.MethodGet {
		hub.exportAdminStageVersion(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stage-versions" && parts[2] == "validate" && r.Method == http.MethodPost {
		hub.validateAdminStageVersion(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stage-versions" && parts[2] == "publish" && r.Method == http.MethodPost {
		hub.publishAdminStageVersion(w, r, parts[1])
		return
	}

	if len(parts) == 3 && parts[0] == "stage-versions" && parts[2] == "activate" && r.Method == http.MethodPost {
		hub.activateAdminStageVersion(w, r, parts[1])
		return
	}

	http.NotFound(w, r)
}

func (hub *gameHub) listAdminStages(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	stages, err := hub.stageStore.ListStages(ctx)
	if err != nil {
		writeStageError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	writeJSON(w, http.StatusOK, adminStagesResponse{
		Status:    "ok",
		Service:   "cara-de-abelha-server",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Stages:    stages,
	})
}

func (hub *gameHub) getAdminStage(w http.ResponseWriter, r *http.Request, stageID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	detail, err := hub.stageStore.GetStage(ctx, stageID)
	if err != nil {
		status := http.StatusInternalServerError
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

func (hub *gameHub) importAdminStage(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxStageImportBytes))
	if err != nil {
		writeStageError(w, http.StatusBadRequest, "failed to read request body", nil)
		return
	}

	sourceJSON, actor := extractStageImportBody(body)
	validation := validateStageSource(sourceJSON)
	if len(validation.SourceJSON) == 0 {
		writeStageError(w, http.StatusBadRequest, "stage JSON vazio", validation.Errors)
		return
	}
	if !json.Valid(validation.SourceJSON) {
		writeStageError(w, http.StatusBadRequest, "JSON invalido", validation.Errors)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	stage, version, err := hub.stageStore.ImportVersion(ctx, stageImportInput{
		StageID:     validation.StageID,
		Slug:        validation.Slug,
		DisplayName: validation.DisplayName,
		SourceJSON:  validation.SourceJSON,
		Checksum:    validation.Checksum,
		Valid:       len(validation.Errors) == 0,
		Errors:      validation.Errors,
		Actor:       actor,
	})
	if err != nil {
		writeStageError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	status := http.StatusCreated
	if version.ValidationStatus != stageValidationValid {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, adminStageImportResponse{Status: "ok", Stage: stage, Version: version})
}

func extractStageImportBody(body []byte) ([]byte, string) {
	var request adminStageImportRequest
	if err := json.Unmarshal(body, &request); err == nil && strings.TrimSpace(request.SourceJSON) != "" {
		return []byte(request.SourceJSON), request.Actor
	}
	return body, ""
}

func (hub *gameHub) validateAdminStageVersion(w http.ResponseWriter, r *http.Request, versionID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	version, err := hub.stageStore.GetVersion(ctx, versionID, true)
	if err != nil {
		status := http.StatusInternalServerError
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}

	validation := validateStageSource([]byte(version.SourceJSON))
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"valid":  len(validation.Errors) == 0,
		"errors": validation.Errors,
	})
}

func (hub *gameHub) publishAdminStageVersion(w http.ResponseWriter, r *http.Request, versionID string) {
	hub.markAdminStageVersion(w, r, versionID, false)
}

func (hub *gameHub) activateAdminStageVersion(w http.ResponseWriter, r *http.Request, versionID string) {
	hub.markAdminStageVersion(w, r, versionID, true)
}

func (hub *gameHub) markAdminStageVersion(w http.ResponseWriter, r *http.Request, versionID string, activate bool) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	versionWithSource, err := hub.stageStore.GetVersion(ctx, versionID, true)
	if err != nil {
		status := http.StatusInternalServerError
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}

	validation := validateStageSource([]byte(versionWithSource.SourceJSON))
	if len(validation.Errors) > 0 {
		writeStageError(w, http.StatusUnprocessableEntity, "stage version is invalid", validation.Errors)
		return
	}

	var stage adminStageSummary
	var version adminStageVersion
	if activate {
		stage, version, err = hub.stageStore.ActivateVersion(ctx, versionID, "admin")
	} else {
		stage, version, err = hub.stageStore.PublishVersion(ctx, versionID, "admin")
	}
	if err != nil {
		writeStageError(w, http.StatusUnprocessableEntity, err.Error(), nil)
		return
	}

	if activate {
		hub.swapActiveStage(version.ID, validation.Layout)
	}

	writeJSON(w, http.StatusOK, adminStageImportResponse{Status: "ok", Stage: stage, Version: version})
}

func (hub *gameHub) archiveAdminStage(w http.ResponseWriter, r *http.Request, stageID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	stage, err := hub.stageStore.ArchiveStage(ctx, stageID, "admin")
	if err != nil {
		status := http.StatusInternalServerError
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, stage)
}

func (hub *gameHub) rollbackAdminStage(w http.ResponseWriter, r *http.Request, stageID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	stage, version, err := hub.stageStore.RollbackStage(ctx, stageID, "admin")
	if err != nil {
		status := http.StatusUnprocessableEntity
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}
	versionWithSource, err := hub.stageStore.GetVersion(ctx, version.ID, true)
	if err == nil {
		validation := validateStageSource([]byte(versionWithSource.SourceJSON))
		if len(validation.Errors) == 0 {
			hub.swapActiveStage(version.ID, validation.Layout)
		}
	}
	writeJSON(w, http.StatusOK, adminStageImportResponse{Status: "ok", Stage: stage, Version: version})
}

func (hub *gameHub) exportAdminStageVersion(w http.ResponseWriter, r *http.Request, versionID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	version, err := hub.stageStore.GetVersion(ctx, versionID, true)
	if err != nil {
		status := http.StatusInternalServerError
		if isStageNotFound(err) {
			status = http.StatusNotFound
		}
		writeStageError(w, status, err.Error(), nil)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="`+version.ID+`.json"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(version.SourceJSON))
}

func (hub *gameHub) swapActiveStage(versionID string, layout worldLayout) {
	hub.mu.Lock()
	hub.world = layout
	if hub.stageRegistry != nil {
		hub.stageRegistry.setActiveLayout(versionID, layout)
	}
	for _, player := range hub.players {
		if player == nil {
			continue
		}
		player.StageID = layout.stageID
	}
	for _, profile := range hub.profiles {
		if profile == nil {
			continue
		}
		profile.StageID = layout.stageID
	}
	hub.initializeWorldEntities()
	hub.mu.Unlock()
	hub.broadcast()
}

func writeStageError(w http.ResponseWriter, status int, message string, fields []string) {
	writeJSON(w, status, adminStageErrorResponse{Error: message, Fields: fields})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
