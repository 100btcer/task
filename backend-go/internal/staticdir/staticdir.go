package staticdir

import (
	"os"
	"path/filepath"

	"task/backend-go/config"
)

// Resolve returns the first existing directory: STATIC_DIR env, ../frontend-dist, ../frontend/dist (relative to repo root).
func Resolve() string {
	if p := os.Getenv("STATIC_DIR"); p != "" {
		abs, err := filepath.Abs(p)
		if err == nil && isDir(abs) {
			return abs
		}
	}
	repo := config.RepoRoot
	for _, rel := range []string{"frontend-dist", filepath.Join("frontend", "dist")} {
		candidate := filepath.Join(repo, rel)
		if isDir(candidate) {
			return candidate
		}
	}
	return ""
}

func isDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
