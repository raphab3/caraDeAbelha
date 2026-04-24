package httpserver

import (
	"context"
	"database/sql"
	"encoding/json"
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
		source = normalizeBundledStageSource(mapFile, source)
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

func normalizeBundledStageSource(mapFile string, source []byte) []byte {
	stageID, displayName := deriveStageIdentityFromMapFile(mapFile)

	var records []worldMapRecord
	if err := json.Unmarshal(source, &records); err == nil && len(records) > 0 {
		return marshalBundledStageSource(worldMapContainer{
			StageID:     stageID,
			DisplayName: displayName,
			Audio:       worldStageAudio{BGM: "assets/rpg-adventure.mp3"},
			Tiles:       records,
			Zones:       []worldZone{},
			Transitions: []worldTransition{},
			Landmarks:   []worldLandmark{},
		}, source)
	}

	var container worldMapContainer
	if err := json.Unmarshal(source, &container); err != nil || len(container.Tiles) == 0 {
		return source
	}
	if strings.TrimSpace(container.StageID) == "" {
		container.StageID = stageID
	}
	if strings.TrimSpace(container.DisplayName) == "" {
		container.DisplayName = displayName
	}
	if strings.TrimSpace(container.Audio.BGM) == "" {
		container.Audio.BGM = "assets/rpg-adventure.mp3"
	}
	return marshalBundledStageSource(container, source)
}

func marshalBundledStageSource(container worldMapContainer, fallback []byte) []byte {
	normalized, err := json.MarshalIndent(container, "", "  ")
	if err != nil {
		return fallback
	}
	return normalized
}

func deriveStageIdentityFromMapFile(mapFile string) (string, string) {
	name := strings.TrimSuffix(filepath.Base(mapFile), filepath.Ext(mapFile))
	name = strings.TrimPrefix(name, "map-")
	name = strings.TrimPrefix(name, "stage-")
	slug := slugifyStage(name)
	return "stage:" + slug, humanizeStageSlug(slug)
}

func humanizeStageSlug(slug string) string {
	parts := strings.Fields(strings.ReplaceAll(slug, "-", " "))
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	if len(parts) == 0 {
		return "Imported Stage"
	}
	return strings.Join(parts, " ")
}
