package svc

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"

	"task/backend-go/config"
	"task/backend-go/pkg/sqlitepath"
)

// OpenSQLite opens the shared SQLite file (pure Go driver), enables WAL + foreign_keys, applies docs/sqlite/schema.sql.
func OpenSQLite() (*sql.DB, string, error) {
	dbPath, err := sqlitepath.Resolve(config.PackageRoot, config.RepoRoot)
	if err != nil {
		return nil, "", err
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, "", err
	}

	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", filepath.ToSlash(dbPath))
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, "", err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, "", err
	}

	schemaPath := filepath.Join(config.RepoRoot, "docs", "sqlite", "schema.sql")
	schemaSQL, err := os.ReadFile(schemaPath)
	if err != nil {
		_ = db.Close()
		return nil, "", fmt.Errorf("read schema %s: %w", schemaPath, err)
	}

	if err := execSchema(db, stripSQLLineComments(string(schemaSQL))); err != nil {
		_ = db.Close()
		return nil, "", err
	}
	if err := migrateTasksUserID(db); err != nil {
		_ = db.Close()
		return nil, "", err
	}

	log.Printf("sqlite ready: %s", dbPath)
	return db, dbPath, nil
}

// stripSQLLineComments removes full-line -- comments so semicolons inside comments do not break splitting.
func stripSQLLineComments(schema string) string {
	schema = strings.ReplaceAll(schema, "\r\n", "\n")
	lines := strings.Split(schema, "\n")
	var out []string
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "--") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func execSchema(db *sql.DB, schema string) error {
	for _, stmt := range splitStatements(schema) {
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("schema exec: %w\n---\n%s\n---", err, stmt)
		}
	}
	return nil
}

// migrateTasksUserID adds tasks.user_id for legacy DBs, backfills to first user, drops orphans.
// Always creates idx_tasks_user_created afterward (schema.sql cannot create that index before the column exists on old DBs).
func migrateTasksUserID(db *sql.DB) error {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = 'user_id'`).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		if _, err := db.Exec(`ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)`); err != nil {
			return err
		}
		var firstID sql.NullInt64
		if err := db.QueryRow(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).Scan(&firstID); err != nil && err != sql.ErrNoRows {
			return err
		}
		if firstID.Valid {
			if _, err := db.Exec(`UPDATE tasks SET user_id = ? WHERE user_id IS NULL`, firstID.Int64); err != nil {
				return err
			}
		}
		if _, err := db.Exec(`DELETE FROM tasks WHERE user_id IS NULL`); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks (user_id, created_at)`); err != nil {
		return err
	}
	return nil
}

func splitStatements(schema string) []string {
	parts := strings.Split(schema, ";")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		lines := strings.Split(strings.TrimSpace(p), "\n")
		var kept []string
		for _, line := range lines {
			t := strings.TrimSpace(line)
			if t == "" || strings.HasPrefix(t, "--") {
				continue
			}
			kept = append(kept, line)
		}
		if len(kept) == 0 {
			continue
		}
		out = append(out, strings.Join(kept, "\n"))
	}
	return out
}
