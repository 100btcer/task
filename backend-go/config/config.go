package config

import (
	"log"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"

	"task/backend-go/pkg/reporoot"
)

var v *viper.Viper

// RepoRoot is the monorepo root (directory containing `docs/sqlite/schema.sql`, `store/`).
var RepoRoot string

// PackageRoot is the `backend-go/` directory (`config/backend.yaml` lives in PackageRoot/config/).
var PackageRoot string

func Load() error {
	RepoRoot = reporoot.Find()
	if RepoRoot == "" {
		log.Fatal("could not locate repo root (expected docs/sqlite/schema.sql when walking up from cwd)")
	}
	log.Printf("repo root: %s", RepoRoot)

	v = viper.New()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()
	_ = v.BindEnv(KeyServerPort, "PORT")

	v.SetConfigName("backend")
	v.SetConfigType("yaml")
	v.AddConfigPath("./config")
	v.AddConfigPath(".")

	setDefaults()

	if err := v.ReadInConfig(); err != nil {
		log.Printf("warning: backend-go/config/backend.yaml not found, using defaults: %v", err)
		PackageRoot = filepath.Join(RepoRoot, "backend-go")
	} else {
		cfg := v.ConfigFileUsed()
		log.Printf("using config file: %s", cfg)
		PackageRoot = filepath.Clean(filepath.Join(filepath.Dir(cfg), ".."))
	}
	log.Printf("backend-go package root: %s", PackageRoot)

	return nil
}

func V() *viper.Viper {
	if v == nil {
		log.Fatal("config not loaded, call config.Load() first")
	}
	return v
}

func setDefaults() {
	v.SetDefault(KeyServerPort, 3001)
	v.SetDefault(KeyServerMode, "debug")
	v.SetDefault(KeyCorsOrigins, []string{"*"})
}
