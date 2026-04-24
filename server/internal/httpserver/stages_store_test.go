package httpserver

import "testing"

func TestNormalizeStageValidationErrorsReturnsEmptySliceForNil(t *testing.T) {
	result := normalizeStageValidationErrors(nil)
	if result == nil {
		t.Fatalf("expected empty slice, got nil")
	}
	if len(result) != 0 {
		t.Fatalf("expected no validation errors, got %d", len(result))
	}
}
