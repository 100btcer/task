package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"task/backend-go/config"
	"task/backend-go/internal/router"
	"task/backend-go/internal/svc"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("config: %v", err)
	}

	if strings.TrimSpace(os.Getenv("AUTH_JWT_SECRET")) == "" &&
		strings.TrimSpace(os.Getenv("API_JWT_SECRET")) == "" {
		log.Println("[backend-go] AUTH_JWT_SECRET (or API_JWT_SECRET) unset — using insecure dev default for user JWTs")
	}

	sc := svc.NewServiceContext()
	defer sc.Close()

	r := router.NewRouter(sc)

	port := config.V().GetInt(config.KeyServerPort)
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: r,
	}

	go func() {
		log.Printf("Tasks API (Go) → http://127.0.0.1:%d/api/tasks", port)
		log.Printf("SQLite: %s  (SQLITE_PATH → backend-go/config/backend.yaml → store/app.sqlite)", sc.DBPath)
		log.Printf("Swagger UI: http://127.0.0.1:%d/api/docs  |  OpenAPI JSON: /api/openapi.json", port)
		log.Printf("Health: http://127.0.0.1:%d/api/health", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("server shutdown:", err)
	}
	log.Println("server exited")
}
