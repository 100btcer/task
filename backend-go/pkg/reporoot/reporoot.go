package reporoot

import (
	"os"
	"path/filepath"
)

// Marker under monorepo root (canonical schema shared by Node + Go).
var marker = filepath.Join("docs", "sqlite", "schema.sql")

// Find walks upward from the process working directory until `docs/sqlite/schema.sql` exists.
func Find() string {
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	dir := wd
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, marker)
		if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}
