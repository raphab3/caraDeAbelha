package dbmigrate

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"path"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type migration struct {
	name string
	sql  string
}

func Apply(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}

	if err := ensureMigrationsTable(ctx, db); err != nil {
		return err
	}

	migrations, err := loadMigrations()
	if err != nil {
		return err
	}

	for _, item := range migrations {
		applied, err := isApplied(ctx, db, item.name)
		if err != nil {
			return err
		}
		if applied {
			continue
		}

		if err := applySingle(ctx, db, item); err != nil {
			return fmt.Errorf("apply migration %s: %w", item.name, err)
		}
	}

	return nil
}

func ensureMigrationsTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	return nil
}

func loadMigrations() ([]migration, error) {
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	items := make([]migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		contents, err := migrationFiles.ReadFile(path.Join("migrations", entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		items = append(items, migration{
			name: entry.Name(),
			sql:  string(contents),
		})
	}

	sort.Slice(items, func(left int, right int) bool {
		return items[left].name < items[right].name
	})

	return items, nil
}

func isApplied(ctx context.Context, db *sql.DB, version string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`,
		version,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check migration %s: %w", version, err)
	}

	return exists, nil
}

func applySingle(ctx context.Context, db *sql.DB, item migration) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, item.sql); err != nil {
		return fmt.Errorf("exec sql: %w", err)
	}

	if _, err = tx.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, item.name); err != nil {
		return fmt.Errorf("insert schema migration row: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	return nil
}