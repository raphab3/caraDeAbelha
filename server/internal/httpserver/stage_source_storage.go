package httpserver

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const stageStorageDirEnvVar = "STAGE_STORAGE_DIR"

type stageSourceStorage struct {
	root string
}

func newStageSourceStorageFromEnv() (*stageSourceStorage, error) {
	root := strings.TrimSpace(os.Getenv(stageStorageDirEnvVar))
	if root == "" {
		root = filepath.Join("data", "stages")
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("create stage storage dir: %w", err)
	}
	return &stageSourceStorage{root: root}, nil
}

func (storage *stageSourceStorage) Write(stageID string, versionID string, checksum string, source []byte) (string, int64, error) {
	if storage == nil {
		return "", 0, fmt.Errorf("stage source storage is nil")
	}

	stageSlug := slugifyStage(stageID)
	versionSlug := slugifyStage(versionID)
	shortChecksum := checksum
	if len(shortChecksum) > 12 {
		shortChecksum = shortChecksum[:12]
	}

	relativePath := filepath.Join(stageSlug, fmt.Sprintf("%s-%s.json", versionSlug, shortChecksum))
	absolutePath := filepath.Join(storage.root, relativePath)
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0o755); err != nil {
		return "", 0, fmt.Errorf("create stage version dir: %w", err)
	}

	tempPath := absolutePath + ".tmp"
	if err := os.WriteFile(tempPath, source, 0o644); err != nil {
		return "", 0, fmt.Errorf("write stage source: %w", err)
	}
	if err := os.Rename(tempPath, absolutePath); err != nil {
		_ = os.Remove(tempPath)
		return "", 0, fmt.Errorf("commit stage source: %w", err)
	}

	return filepath.ToSlash(relativePath), int64(len(source)), nil
}

func (storage *stageSourceStorage) Read(storagePath string) ([]byte, error) {
	if storage == nil {
		return nil, fmt.Errorf("stage source storage is nil")
	}
	if strings.TrimSpace(storagePath) == "" {
		return nil, fmt.Errorf("stage source storage path is empty")
	}
	if filepath.IsAbs(storagePath) {
		return os.ReadFile(storagePath)
	}
	return os.ReadFile(filepath.Join(storage.root, filepath.FromSlash(storagePath)))
}
