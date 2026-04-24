package httpserver

import (
	"context"
	"database/sql"
	"log"
	"sync"
)

type stageRuntime struct {
	stageID     string
	versionID   string
	layout      worldLayout
	players     map[string]*playerState
	flowers     map[string]*activeFlowerRuntime
	hives       map[string]*activeHiveRuntime
	mobs        map[string]*activeMobRuntime
	collections map[string]*collectionState
}

type stageRegistry struct {
	mu       sync.RWMutex
	store    stageStore
	activeID string
	layout   worldLayout
}

func newStageRegistry(store stageStore) *stageRegistry {
	return &stageRegistry{store: store}
}

func (registry *stageRegistry) loadInitialLayout() worldLayout {
	if registry == nil || registry.store == nil {
		return loadWorldLayout()
	}

	ctx, cancel := context.WithTimeout(context.Background(), persistenceSaveTimeout)
	defer cancel()

	version, err := registry.store.GetActiveVersion(ctx)
	if err != nil {
		if !isStageNotFound(err) && err != sql.ErrNoRows {
			log.Printf("failed to load active stage from store, using file fallback: %v", err)
		} else {
			log.Printf("no active stored stage configured, using file fallback")
		}
		layout := loadWorldLayout()
		registry.setActiveLayout("", layout)
		return layout
	}

	validation := validateStageSource([]byte(version.SourceJSON))
	if len(validation.Errors) > 0 {
		log.Printf("failed to parse active stored stage %s, using file fallback: %v", version.ID, validation.Errors)
		layout := loadWorldLayout()
		registry.setActiveLayout("", layout)
		return layout
	}

	log.Printf("loaded active stored stage %s (%s) with %d chunks", version.StageID, version.ID, len(validation.Layout.chunks))
	registry.setActiveLayout(version.ID, validation.Layout)
	return validation.Layout
}

func (registry *stageRegistry) setActiveLayout(versionID string, layout worldLayout) {
	if registry == nil {
		return
	}
	registry.mu.Lock()
	defer registry.mu.Unlock()
	registry.activeID = versionID
	registry.layout = layout
}

func (registry *stageRegistry) activeVersionID() string {
	if registry == nil {
		return ""
	}
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	return registry.activeID
}
