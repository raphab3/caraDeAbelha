package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/lib/pq"
	"github.com/raphab33/cara-de-abelha/server/internal/dbmigrate"
)

type stageStore interface {
	ListStages(ctx context.Context) ([]adminStageSummary, error)
	GetStage(ctx context.Context, stageID string) (adminStageDetail, error)
	ImportVersion(ctx context.Context, input stageImportInput) (adminStageSummary, adminStageVersion, error)
	GetVersion(ctx context.Context, versionID string, includeSource bool) (adminStageVersion, error)
	PublishVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error)
	ActivateVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error)
	ArchiveStage(ctx context.Context, stageID string, actor string) (adminStageSummary, error)
	RollbackStage(ctx context.Context, stageID string, actor string) (adminStageSummary, adminStageVersion, error)
	GetActiveVersion(ctx context.Context) (adminStageVersion, error)
	Close() error
}

type sqlStageStore struct {
	db      *sql.DB
	storage *stageSourceStorage
}

type memoryStageStore struct {
	mu            sync.Mutex
	stages        map[string]*memoryStage
	versions      map[string]*adminStageVersion
	activeVersion string
}

type memoryStage struct {
	summary  adminStageSummary
	versions []string
}

func newStageStoreFromEnv() stageStore {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Printf("stage management using in-memory store: DATABASE_URL not set")
		return newMemoryStageStore()
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Printf("stage management using in-memory store: open database: %v", err)
		return newMemoryStageStore()
	}

	ctx, cancel := context.WithTimeout(context.Background(), persistenceConnectTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		log.Printf("stage management using in-memory store: ping database: %v", err)
		return newMemoryStageStore()
	}

	if err := dbmigrate.Apply(ctx, db); err != nil {
		_ = db.Close()
		log.Printf("stage management using in-memory store: apply migrations: %v", err)
		return newMemoryStageStore()
	}

	storage, err := newStageSourceStorageFromEnv()
	if err != nil {
		_ = db.Close()
		log.Printf("stage management using in-memory store: stage source storage: %v", err)
		return newMemoryStageStore()
	}

	store := &sqlStageStore{db: db, storage: storage}
	migrateCtx, migrateCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer migrateCancel()
	if err := store.migrateLegacySourceJSON(migrateCtx); err != nil {
		_ = db.Close()
		log.Printf("stage management using in-memory store: migrate legacy stage JSON: %v", err)
		return newMemoryStageStore()
	}

	return store
}

func newMemoryStageStore() *memoryStageStore {
	return &memoryStageStore{
		stages:   make(map[string]*memoryStage),
		versions: make(map[string]*adminStageVersion),
	}
}

func normalizeStageValidationErrors(errors []string) []string {
	if errors == nil {
		return []string{}
	}

	return errors
}

func (store *sqlStageStore) ListStages(ctx context.Context) ([]adminStageSummary, error) {
	rows, err := store.db.QueryContext(ctx, `
		SELECT s.id, s.slug, s.display_name, s.status, COALESCE(s.active_version_id, ''),
		       COALESCE(latest.id, ''), COALESCE(latest.version, 0), COALESCE(latest.checksum, ''),
		       s.updated_at, s.created_at
		  FROM stages s
		  LEFT JOIN LATERAL (
		    SELECT id, version, checksum
		      FROM stage_versions
		     WHERE stage_id = s.id
		     ORDER BY version DESC
		     LIMIT 1
		  ) latest ON TRUE
		 ORDER BY s.updated_at DESC, s.display_name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := []adminStageSummary{}
	for rows.Next() {
		var item adminStageSummary
		if err := rows.Scan(&item.ID, &item.Slug, &item.DisplayName, &item.Status, &item.ActiveVersionID, &item.LatestVersionID, &item.LatestVersion, &item.Checksum, &item.UpdatedAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		stages = append(stages, item)
	}
	return stages, rows.Err()
}

func (store *sqlStageStore) GetStage(ctx context.Context, stageID string) (adminStageDetail, error) {
	stages, err := store.ListStages(ctx)
	if err != nil {
		return adminStageDetail{}, err
	}
	var summary *adminStageSummary
	for index := range stages {
		if stages[index].ID == stageID || stages[index].Slug == stageID {
			summary = &stages[index]
			break
		}
	}
	if summary == nil {
		return adminStageDetail{}, sql.ErrNoRows
	}

	rows, err := store.db.QueryContext(ctx, `
		SELECT id, stage_id, version, checksum, storage_path, source_size_bytes, validation_status, validation_errors,
		       created_at, published_at, activated_at
		  FROM stage_versions
		 WHERE stage_id = $1
		 ORDER BY version DESC`, summary.ID)
	if err != nil {
		return adminStageDetail{}, err
	}
	defer rows.Close()

	versions := []adminStageVersion{}
	for rows.Next() {
		version, err := scanStageVersion(rows)
		if err != nil {
			return adminStageDetail{}, err
		}
		versions = append(versions, version)
	}
	return adminStageDetail{Stage: *summary, Versions: versions}, rows.Err()
}

func (store *sqlStageStore) ImportVersion(ctx context.Context, input stageImportInput) (adminStageSummary, adminStageVersion, error) {
	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now().UTC()
	status := stageStatusDraft
	validationStatus := stageValidationInvalid
	if input.Valid {
		validationStatus = stageValidationValid
	}
	validationErrors := normalizeStageValidationErrors(input.Errors)

	_, err = tx.ExecContext(ctx, `
		INSERT INTO stages (id, slug, display_name, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		ON CONFLICT (id) DO UPDATE SET
		    slug = EXCLUDED.slug,
		    display_name = EXCLUDED.display_name,
		    updated_at = EXCLUDED.updated_at`,
		input.StageID, input.Slug, input.DisplayName, status, now)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	var existingVersionID string
	var existingStoragePath string
	if err = tx.QueryRowContext(ctx, `SELECT id, COALESCE(storage_path, '') FROM stage_versions WHERE stage_id = $1 AND checksum = $2`, input.StageID, input.Checksum).Scan(&existingVersionID, &existingStoragePath); err == nil {
		if existingStoragePath == "" {
			storagePath, sourceSizeBytes, writeErr := store.storage.Write(input.StageID, existingVersionID, input.Checksum, input.SourceJSON)
			if writeErr != nil {
				return adminStageSummary{}, adminStageVersion{}, writeErr
			}
			if _, err = tx.ExecContext(ctx, `UPDATE stage_versions SET storage_path = $2, source_size_bytes = $3 WHERE id = $1`, existingVersionID, storagePath, sourceSizeBytes); err != nil {
				return adminStageSummary{}, adminStageVersion{}, err
			}
		}
		if err = tx.Commit(); err != nil {
			return adminStageSummary{}, adminStageVersion{}, err
		}
		return store.findStageAndVersionByChecksum(ctx, input.StageID, input.Checksum)
	} else if err != sql.ErrNoRows {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	var nextVersion int
	if err = tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) + 1 FROM stage_versions WHERE stage_id = $1`, input.StageID).Scan(&nextVersion); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	versionID := fmt.Sprintf("%s:v%d", input.StageID, nextVersion)
	storagePath, sourceSizeBytes, err := store.storage.Write(input.StageID, versionID, input.Checksum, input.SourceJSON)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO stage_versions (
		    id, stage_id, version, storage_path, source_size_bytes, checksum, validation_status, validation_errors, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (stage_id, checksum) DO NOTHING`,
		versionID, input.StageID, nextVersion, storagePath, sourceSizeBytes, input.Checksum, validationStatus, pq.Array(validationErrors), now)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	_ = insertStageAudit(ctx, tx, "import", input.StageID, versionID, input.Actor)
	if err = tx.Commit(); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	summary, version, err := store.findStageAndVersionByChecksum(ctx, input.StageID, input.Checksum)
	return summary, version, err
}

func (store *sqlStageStore) findStageAndVersionByChecksum(ctx context.Context, stageID string, checksum string) (adminStageSummary, adminStageVersion, error) {
	detail, err := store.GetStage(ctx, stageID)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	for _, version := range detail.Versions {
		if version.Checksum == checksum {
			return detail.Stage, version, nil
		}
	}
	return adminStageSummary{}, adminStageVersion{}, sql.ErrNoRows
}

func (store *sqlStageStore) GetVersion(ctx context.Context, versionID string, includeSource bool) (adminStageVersion, error) {
	row := store.db.QueryRowContext(ctx, `
		SELECT id, stage_id, version, checksum, storage_path, source_size_bytes, validation_status, validation_errors,
		       created_at, published_at, activated_at
		  FROM stage_versions
		 WHERE id = $1`, versionID)
	version, err := scanStageVersion(row)
	if err != nil {
		return adminStageVersion{}, err
	}
	if includeSource {
		source, readErr := store.storage.Read(version.StoragePath)
		if readErr != nil {
			return adminStageVersion{}, readErr
		}
		version.SourceJSON = string(source)
	}
	return version, nil
}

func (store *sqlStageStore) PublishVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error) {
	return store.markVersion(ctx, versionID, actor, false)
}

func (store *sqlStageStore) ActivateVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error) {
	return store.markVersion(ctx, versionID, actor, true)
}

func (store *sqlStageStore) markVersion(ctx context.Context, versionID string, actor string, activate bool) (adminStageSummary, adminStageVersion, error) {
	version, err := store.GetVersion(ctx, versionID, false)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	if version.ValidationStatus != stageValidationValid {
		return adminStageSummary{}, adminStageVersion{}, fmt.Errorf("stage version is not valid")
	}

	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	now := time.Now().UTC()
	if _, err = tx.ExecContext(ctx, `UPDATE stage_versions SET published_at = COALESCE(published_at, $2) WHERE id = $1`, versionID, now); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE stages SET status = $2, updated_at = $3 WHERE id = $1 AND status <> $4`, version.StageID, stageStatusPublished, now, stageStatusArchived); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	action := "publish"
	if activate {
		action = "activate"
		if _, err = tx.ExecContext(ctx, `UPDATE stage_versions SET activated_at = $2 WHERE id = $1`, versionID, now); err != nil {
			return adminStageSummary{}, adminStageVersion{}, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE stages SET status = CASE WHEN id = $1 THEN $2 ELSE CASE WHEN status = $2 THEN $3 ELSE status END END, active_version_id = CASE WHEN id = $1 THEN $4 ELSE active_version_id END, updated_at = $5`, version.StageID, stageStatusActive, stageStatusPublished, versionID, now); err != nil {
			return adminStageSummary{}, adminStageVersion{}, err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO game_config (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`, gameConfigActiveStageVersionID, versionID, now); err != nil {
			return adminStageSummary{}, adminStageVersion{}, err
		}
	}
	_ = insertStageAudit(ctx, tx, action, version.StageID, versionID, actor)
	if err = tx.Commit(); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}

	detail, err := store.GetStage(ctx, version.StageID)
	if err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	updatedVersion, err := store.GetVersion(ctx, versionID, false)
	return detail.Stage, updatedVersion, err
}

func (store *sqlStageStore) ArchiveStage(ctx context.Context, stageID string, actor string) (adminStageSummary, error) {
	result, err := store.db.ExecContext(ctx, `UPDATE stages SET status = $2, updated_at = NOW() WHERE id = $1 AND status <> $3`, stageID, stageStatusArchived, stageStatusActive)
	if err != nil {
		return adminStageSummary{}, err
	}
	if affected, affectedErr := result.RowsAffected(); affectedErr == nil && affected == 0 {
		return adminStageSummary{}, fmt.Errorf("active stage cannot be archived")
	}
	_ = insertStageAudit(ctx, store.db, "archive", stageID, "", actor)
	detail, err := store.GetStage(ctx, stageID)
	return detail.Stage, err
}

func (store *sqlStageStore) RollbackStage(ctx context.Context, stageID string, actor string) (adminStageSummary, adminStageVersion, error) {
	row := store.db.QueryRowContext(ctx, `
		SELECT id
		  FROM stage_versions
		 WHERE stage_id = $1
		   AND published_at IS NOT NULL
		   AND id <> COALESCE((SELECT active_version_id FROM stages WHERE id = $1), '')
		 ORDER BY version DESC
		 LIMIT 1`, stageID)
	var versionID string
	if err := row.Scan(&versionID); err != nil {
		return adminStageSummary{}, adminStageVersion{}, err
	}
	return store.markVersion(ctx, versionID, actor, true)
}

func (store *sqlStageStore) GetActiveVersion(ctx context.Context) (adminStageVersion, error) {
	row := store.db.QueryRowContext(ctx, `SELECT value FROM game_config WHERE key = $1`, gameConfigActiveStageVersionID)
	var versionID string
	if err := row.Scan(&versionID); err != nil {
		return adminStageVersion{}, err
	}
	return store.GetVersion(ctx, versionID, true)
}

func (store *sqlStageStore) Close() error {
	if store == nil || store.db == nil {
		return nil
	}
	return store.db.Close()
}

func (store *sqlStageStore) migrateLegacySourceJSON(ctx context.Context) error {
	var hasSourceJSON bool
	if err := store.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			  FROM information_schema.columns
			 WHERE table_name = 'stage_versions'
			   AND column_name = 'source_json'
		)`).Scan(&hasSourceJSON); err != nil {
		return err
	}
	if !hasSourceJSON {
		_, err := store.db.ExecContext(ctx, `ALTER TABLE stage_versions ALTER COLUMN storage_path SET NOT NULL`)
		return err
	}

	rows, err := store.db.QueryContext(ctx, `
		SELECT id, stage_id, checksum, source_json::text
		  FROM stage_versions
		 WHERE COALESCE(storage_path, '') = ''`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type legacySource struct {
		versionID string
		stageID   string
		checksum  string
		source    []byte
	}
	legacySources := []legacySource{}
	for rows.Next() {
		var item legacySource
		var source string
		if err := rows.Scan(&item.versionID, &item.stageID, &item.checksum, &source); err != nil {
			return err
		}
		item.source = []byte(source)
		legacySources = append(legacySources, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, item := range legacySources {
		storagePath, sourceSizeBytes, err := store.storage.Write(item.stageID, item.versionID, item.checksum, item.source)
		if err != nil {
			return err
		}
		if _, err := store.db.ExecContext(ctx, `UPDATE stage_versions SET storage_path = $2, source_size_bytes = $3 WHERE id = $1`, item.versionID, storagePath, sourceSizeBytes); err != nil {
			return err
		}
	}

	_, err = store.db.ExecContext(ctx, `
		ALTER TABLE stage_versions ALTER COLUMN storage_path SET NOT NULL;
		ALTER TABLE stage_versions DROP COLUMN source_json;`)
	return err
}

type stageVersionScanner interface {
	Scan(dest ...any) error
}

func scanStageVersion(scanner stageVersionScanner) (adminStageVersion, error) {
	var version adminStageVersion
	var validationErrors pq.StringArray
	var publishedAt sql.NullTime
	var activatedAt sql.NullTime
	if err := scanner.Scan(&version.ID, &version.StageID, &version.Version, &version.Checksum, &version.StoragePath, &version.SourceSizeBytes, &version.ValidationStatus, &validationErrors, &version.CreatedAt, &publishedAt, &activatedAt); err != nil {
		return adminStageVersion{}, err
	}
	version.ValidationErrors = append([]string{}, validationErrors...)
	if publishedAt.Valid {
		version.PublishedAt = &publishedAt.Time
	}
	if activatedAt.Valid {
		version.ActivatedAt = &activatedAt.Time
	}
	return version, nil
}

type auditExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func insertStageAudit(ctx context.Context, execer auditExecer, action string, stageID string, versionID string, actor string) error {
	if actor == "" {
		actor = "system"
	}
	_, err := execer.ExecContext(ctx, `INSERT INTO stage_audit_events (action, stage_id, version_id, actor) VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`, action, stageID, versionID, actor)
	return err
}

func (store *memoryStageStore) ListStages(_ context.Context) ([]adminStageSummary, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	stages := make([]adminStageSummary, 0, len(store.stages))
	for _, stage := range store.stages {
		stages = append(stages, stage.summary)
	}
	sort.Slice(stages, func(left, right int) bool {
		return stages[left].UpdatedAt.After(stages[right].UpdatedAt)
	})
	return stages, nil
}

func (store *memoryStageStore) GetStage(_ context.Context, stageID string) (adminStageDetail, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	stage := store.findStageLocked(stageID)
	if stage == nil {
		return adminStageDetail{}, sql.ErrNoRows
	}
	versions := make([]adminStageVersion, 0, len(stage.versions))
	for _, id := range stage.versions {
		if version := store.versions[id]; version != nil {
			clone := *version
			clone.SourceJSON = ""
			versions = append(versions, clone)
		}
	}
	sort.Slice(versions, func(left, right int) bool {
		return versions[left].Version > versions[right].Version
	})
	return adminStageDetail{Stage: stage.summary, Versions: versions}, nil
}

func (store *memoryStageStore) ImportVersion(_ context.Context, input stageImportInput) (adminStageSummary, adminStageVersion, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	now := time.Now().UTC()
	validationErrors := normalizeStageValidationErrors(input.Errors)
	stage := store.stages[input.StageID]
	if stage == nil {
		stage = &memoryStage{summary: adminStageSummary{
			ID:          input.StageID,
			Slug:        input.Slug,
			DisplayName: input.DisplayName,
			Status:      stageStatusDraft,
			CreatedAt:   now,
			UpdatedAt:   now,
		}}
		store.stages[input.StageID] = stage
	}
	for _, id := range stage.versions {
		if existing := store.versions[id]; existing != nil && existing.Checksum == input.Checksum {
			clone := *existing
			clone.SourceJSON = ""
			return stage.summary, clone, nil
		}
	}
	nextVersion := len(stage.versions) + 1
	version := adminStageVersion{
		ID:               fmt.Sprintf("%s:v%d", input.StageID, nextVersion),
		StageID:          input.StageID,
		Version:          nextVersion,
		Checksum:         input.Checksum,
		StoragePath:      "memory",
		SourceSizeBytes:  int64(len(input.SourceJSON)),
		ValidationStatus: stageValidationInvalid,
		ValidationErrors: append([]string{}, validationErrors...),
		CreatedAt:        now,
		SourceJSON:       string(input.SourceJSON),
	}
	if input.Valid {
		version.ValidationStatus = stageValidationValid
	}
	store.versions[version.ID] = &version
	stage.versions = append(stage.versions, version.ID)
	stage.summary.Slug = input.Slug
	stage.summary.DisplayName = input.DisplayName
	stage.summary.LatestVersionID = version.ID
	stage.summary.LatestVersion = version.Version
	stage.summary.Checksum = version.Checksum
	stage.summary.UpdatedAt = now
	responseVersion := version
	responseVersion.SourceJSON = ""
	return stage.summary, responseVersion, nil
}

func (store *memoryStageStore) GetVersion(_ context.Context, versionID string, includeSource bool) (adminStageVersion, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	version := store.versions[versionID]
	if version == nil {
		return adminStageVersion{}, sql.ErrNoRows
	}
	clone := *version
	if !includeSource {
		clone.SourceJSON = ""
	}
	return clone, nil
}

func (store *memoryStageStore) PublishVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error) {
	return store.markVersion(ctx, versionID, false)
}

func (store *memoryStageStore) ActivateVersion(ctx context.Context, versionID string, actor string) (adminStageSummary, adminStageVersion, error) {
	return store.markVersion(ctx, versionID, true)
}

func (store *memoryStageStore) markVersion(_ context.Context, versionID string, activate bool) (adminStageSummary, adminStageVersion, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	version := store.versions[versionID]
	if version == nil {
		return adminStageSummary{}, adminStageVersion{}, sql.ErrNoRows
	}
	if version.ValidationStatus != stageValidationValid {
		return adminStageSummary{}, adminStageVersion{}, fmt.Errorf("stage version is not valid")
	}
	now := time.Now().UTC()
	if version.PublishedAt == nil {
		version.PublishedAt = &now
	}
	stage := store.stages[version.StageID]
	if stage == nil {
		return adminStageSummary{}, adminStageVersion{}, sql.ErrNoRows
	}
	stage.summary.Status = stageStatusPublished
	if activate {
		version.ActivatedAt = &now
		store.activeVersion = versionID
		for _, other := range store.stages {
			if other.summary.Status == stageStatusActive {
				other.summary.Status = stageStatusPublished
			}
		}
		stage.summary.Status = stageStatusActive
		stage.summary.ActiveVersionID = versionID
	}
	stage.summary.UpdatedAt = now
	return stage.summary, *version, nil
}

func (store *memoryStageStore) ArchiveStage(_ context.Context, stageID string, actor string) (adminStageSummary, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	stage := store.findStageLocked(stageID)
	if stage == nil {
		return adminStageSummary{}, sql.ErrNoRows
	}
	if stage.summary.Status == stageStatusActive {
		return adminStageSummary{}, fmt.Errorf("active stage cannot be archived")
	}
	stage.summary.Status = stageStatusArchived
	stage.summary.UpdatedAt = time.Now().UTC()
	return stage.summary, nil
}

func (store *memoryStageStore) RollbackStage(ctx context.Context, stageID string, actor string) (adminStageSummary, adminStageVersion, error) {
	store.mu.Lock()
	stage := store.findStageLocked(stageID)
	if stage == nil {
		store.mu.Unlock()
		return adminStageSummary{}, adminStageVersion{}, sql.ErrNoRows
	}
	var candidate string
	for index := len(stage.versions) - 1; index >= 0; index-- {
		id := stage.versions[index]
		version := store.versions[id]
		if version != nil && version.PublishedAt != nil && id != stage.summary.ActiveVersionID {
			candidate = id
			break
		}
	}
	store.mu.Unlock()
	if candidate == "" {
		return adminStageSummary{}, adminStageVersion{}, sql.ErrNoRows
	}
	return store.markVersion(ctx, candidate, true)
}

func (store *memoryStageStore) GetActiveVersion(_ context.Context) (adminStageVersion, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if store.activeVersion == "" {
		return adminStageVersion{}, sql.ErrNoRows
	}
	version := store.versions[store.activeVersion]
	if version == nil {
		return adminStageVersion{}, sql.ErrNoRows
	}
	return *version, nil
}

func (store *memoryStageStore) Close() error {
	return nil
}

func (store *memoryStageStore) findStageLocked(stageID string) *memoryStage {
	if stage := store.stages[stageID]; stage != nil {
		return stage
	}
	for _, stage := range store.stages {
		if stage.summary.Slug == stageID {
			return stage
		}
	}
	return nil
}

func isStageNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
