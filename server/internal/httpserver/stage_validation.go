package httpserver

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var stageSlugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)

type stageValidationResult struct {
	Layout      worldLayout
	Container   worldMapContainer
	SourceJSON  []byte
	Checksum    string
	StageID     string
	Slug        string
	DisplayName string
	Errors      []string
}

func validateStageSource(source []byte) stageValidationResult {
	trimmed := []byte(strings.TrimSpace(string(source)))
	result := stageValidationResult{SourceJSON: trimmed}
	if len(trimmed) == 0 {
		result.Errors = append(result.Errors, "stage JSON vazio")
		return result
	}

	var raw any
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("JSON invalido: %v", err))
		return result
	}

	container := worldMapContainer{}
	if err := json.Unmarshal(trimmed, &container); err != nil || len(container.Tiles) == 0 {
		var legacyRecords []worldMapRecord
		if legacyErr := json.Unmarshal(trimmed, &legacyRecords); legacyErr == nil {
			container.Tiles = legacyRecords
		}
	}

	layout, err := parseWorldLayout(trimmed)
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
	}

	stageID := strings.TrimSpace(container.StageID)
	displayName := strings.TrimSpace(container.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(layout.displayName)
	}
	if displayName == "" {
		displayName = "Imported Stage"
	}
	if stageID == "" {
		stageID = "stage:" + slugifyStage(displayName)
	}

	result.Layout = layout
	result.Layout.stageID = stageID
	result.Layout.displayName = displayName
	result.Container = container
	result.Checksum = checksumBytes(trimmed)
	result.StageID = stageID
	result.Slug = slugifyStage(strings.TrimPrefix(stageID, "stage:"))
	result.DisplayName = displayName
	return result
}

func checksumBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func slugifyStage(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.TrimPrefix(normalized, "stage:")
	normalized = stageSlugInvalidChars.ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		return "imported-stage"
	}
	return normalized
}
