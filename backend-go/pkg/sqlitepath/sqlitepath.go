package sqlitepath

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const defaultRelative = "store" + string(filepath.Separator) + "app.sqlite"

// Resolve returns the absolute path to the SQLite file.
// Order: SQLITE_PATH env → backend-go/config/backend.yaml `database.path` (relative to packageRoot) → repoRoot/store/app.sqlite.
func Resolve(packageRoot, repoRoot string) (string, error) {
	if p := strings.TrimSpace(os.Getenv("SQLITE_PATH")); p != "" {
		if filepath.IsAbs(p) {
			return filepath.Clean(p), nil
		}
		return filepath.Abs(p)
	}
	cfgPath := filepath.Join(packageRoot, "config", "backend.yaml")
	rel := readDatabasePathFromYAML(cfgPath)
	if rel == "" {
		return filepath.Join(repoRoot, filepath.FromSlash("store/app.sqlite")), nil
	}
	rel = filepath.FromSlash(strings.TrimSpace(rel))
	if filepath.IsAbs(rel) {
		return filepath.Clean(rel), nil
	}
	return filepath.Abs(filepath.Join(packageRoot, rel))
}

func readDatabasePathFromYAML(path string) string {
	raw, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return parseDatabasePathYAML(string(raw))
}

var (
	reDatabaseLine = regexp.MustCompile(`^database:\s*(#.*)?$`)
	rePathQuoted   = regexp.MustCompile(`^path:\s*["'](.+)["']\s*(?:#.*)?$`)
	rePathPlain    = regexp.MustCompile(`^path:\s*([^\s#]+)`)
)

func parseDatabasePathYAML(content string) string {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	inDatabase := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if reDatabaseLine.MatchString(trimmed) {
			inDatabase = true
			continue
		}
		if inDatabase {
			if len(line) > 0 && !strings.ContainsAny(string(line[0]), " \t") {
				break
			}
			if m := rePathQuoted.FindStringSubmatch(trimmed); len(m) > 1 {
				return strings.TrimSpace(m[1])
			}
			if m := rePathPlain.FindStringSubmatch(trimmed); len(m) > 1 {
				return strings.TrimSpace(m[1])
			}
		}
	}
	return ""
}

// DefaultRelativePath documents the fallback under repo root (for README).
func DefaultRelativePath() string { return defaultRelative }
