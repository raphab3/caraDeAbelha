package httpserver

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeStageValidationErrorsReturnsEmptySliceForNil(t *testing.T) {
	result := normalizeStageValidationErrors(nil)
	if result == nil {
		t.Fatalf("expected empty slice, got nil")
	}
	if len(result) != 0 {
		t.Fatalf("expected no validation errors, got %d", len(result))
	}
}

func TestStageSourceStorageWriteAndRead(t *testing.T) {
	storage := &stageSourceStorage{root: t.TempDir()}
	source := []byte(`{"stageId":"stage:test","displayName":"Test","tiles":[{"x":0,"y":0,"z":0,"type":"grass"}]}`)

	storagePath, sizeBytes, err := storage.Write("stage:test", "stage:test:v1", checksumBytes(source), source)
	if err != nil {
		t.Fatalf("write stage source: %v", err)
	}
	if storagePath == "" {
		t.Fatalf("expected storage path")
	}
	if sizeBytes != int64(len(source)) {
		t.Fatalf("expected %d source bytes, got %d", len(source), sizeBytes)
	}

	readSource, err := storage.Read(storagePath)
	if err != nil {
		t.Fatalf("read stage source: %v", err)
	}
	if string(readSource) != string(source) {
		t.Fatalf("read source mismatch")
	}
}

func TestBundledStageMapsAreValid(t *testing.T) {
	mapPath, err := resolveWorldMapPath()
	if err != nil {
		t.Fatalf("resolve world map path: %v", err)
	}

	matches, err := filepath.Glob(filepath.Join(filepath.Dir(mapPath), "*.json"))
	if err != nil {
		t.Fatalf("glob bundled maps: %v", err)
	}
	if len(matches) == 0 {
		t.Fatalf("expected bundled stage maps")
	}

	for _, match := range matches {
		t.Run(filepath.Base(match), func(t *testing.T) {
			source := mustReadTestFile(t, match)
			validation := validateStageSource(source)
			if len(validation.Errors) > 0 {
				t.Fatalf("invalid bundled map: %v", validation.Errors)
			}
		})
	}
}

func mustReadTestFile(t *testing.T, path string) []byte {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return source
}
