package httpserver

import (
	"context"
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const stageSeedMapsDirEnvVar = "STAGE_SEED_MAPS_DIR"

func seedBundledStages(store stageStore) {
	if store == nil {
		return
	}

	mapFiles := discoverStageSeedMapFiles()
	if len(mapFiles) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, activeErr := store.GetActiveVersion(ctx)
	shouldActivateFirst := activeErr != nil && (isStageNotFound(activeErr) || activeErr == sql.ErrNoRows)
	var firstValidVersionID string

	for _, mapFile := range mapFiles {
		source, err := os.ReadFile(mapFile)
		if err != nil {
			log.Printf("skip bundled stage %s: %v", mapFile, err)
			continue
		}
		validation := validateStageSource(source)
		if len(validation.SourceJSON) == 0 {
			log.Printf("skip bundled stage %s: empty JSON", mapFile)
			continue
		}

		_, version, err := store.ImportVersion(ctx, stageImportInput{
			StageID:     validation.StageID,
			Slug:        validation.Slug,
			DisplayName: validation.DisplayName,
			SourceJSON:  validation.SourceJSON,
			Checksum:    validation.Checksum,
			Valid:       len(validation.Errors) == 0,
			Errors:      validation.Errors,
			Actor:       "stage-seed",
		})
		if err != nil {
			log.Printf("failed to import bundled stage %s: %v", mapFile, err)
			continue
		}
		if len(validation.Errors) == 0 && firstValidVersionID == "" {
			firstValidVersionID = version.ID
		}
	}

	if shouldActivateFirst && firstValidVersionID != "" {
		if _, _, err := store.ActivateVersion(ctx, firstValidVersionID, "stage-seed"); err != nil {
			log.Printf("failed to activate bundled stage %s: %v", firstValidVersionID, err)
		}
	}
}

func discoverStageSeedMapFiles() []string {
	dirs := []string{}
	if overrideDir := strings.TrimSpace(os.Getenv(stageSeedMapsDirEnvVar)); overrideDir != "" {
		dirs = append(dirs, overrideDir)
	}

	if fallbackPath, err := resolveWorldMapPath(); err == nil {
		dirs = append(dirs, filepath.Dir(fallbackPath))
	}

	seenDirs := map[string]bool{}
	files := []string{}
	for _, dir := range dirs {
		if dir == "" || seenDirs[dir] {
			continue
		}
		seenDirs[dir] = true
		matches, err := filepath.Glob(filepath.Join(dir, "*.json"))
		if err != nil {
			continue
		}
		files = append(files, matches...)
	}

	sort.Slice(files, func(left, right int) bool {
		leftBase := filepath.Base(files[left])
		rightBase := filepath.Base(files[right])
		if leftBase == "map.json" {
			return true
		}
		if rightBase == "map.json" {
			return false
		}
		return files[left] < files[right]
	})
	return files
}
