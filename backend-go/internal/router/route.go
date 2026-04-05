package router

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"task/backend-go/config"
	"task/backend-go/internal/dao"
	authhandler "task/backend-go/internal/router/handler/auth"
	blockchainhandler "task/backend-go/internal/router/handler/blockchain"
	"task/backend-go/internal/router/handler/openapi"
	taskhandler "task/backend-go/internal/router/handler/tasks"
	"task/backend-go/internal/router/middleware"
	authsvc "task/backend-go/internal/service/auth"
	tasksvc "task/backend-go/internal/service/tasks"
	"task/backend-go/internal/staticdir"
	"task/backend-go/internal/svc"
)

func NewRouter(sc *svc.ServiceContext) *gin.Engine {
	mode := config.V().GetString(config.KeyServerMode)
	gin.SetMode(mode)

	r := gin.New()
	r.Use(gin.Recovery())

	corsOrigins := config.V().GetStringSlice(config.KeyCorsOrigins)
	if env := strings.TrimSpace(os.Getenv("CORS_ORIGINS")); env != "" {
		var cleaned []string
		for _, p := range strings.Split(env, ",") {
			if t := strings.TrimSpace(p); t != "" {
				cleaned = append(cleaned, t)
			}
		}
		if len(cleaned) > 0 {
			corsOrigins = cleaned
		}
	}
	corsAllowAll := len(corsOrigins) == 0
	for _, o := range corsOrigins {
		if strings.TrimSpace(o) == "*" {
			corsAllowAll = true
			break
		}
	}
	corsCfg := cors.Config{
		AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "PUT", "HEAD", "OPTIONS"},
		AllowHeaders: []string{
			"Origin", "Content-Length", "Content-Type", "Authorization",
			"Accept", "Accept-Language", "X-Requested-With",
			"X-Forwarded-Proto", "X-Forwarded-Host",
		},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           24 * time.Hour,
	}
	if corsAllowAll {
		corsCfg.AllowOriginFunc = func(string) bool { return true }
	} else {
		corsCfg.AllowOrigins = corsOrigins
	}
	r.Use(cors.New(corsCfg))
	r.Use(middleware.ErrorHandler())

	r.HandleMethodNotAllowed = true
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "Method not allowed"})
	})

	d := dao.New(sc.DB)
	aSvc := authsvc.NewService(d)
	tSvc := tasksvc.NewService(d)
	authH := authhandler.NewHandler(aSvc)
	taskH := taskhandler.NewHandler(tSvc)

	r.GET("/api/health", func(c *gin.Context) {
		if err := sc.DB.Ping(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"ok":       true,
			"service":  "tasks-api",
			"storage":  "sqlite",
			"database": sc.DBPath,
		})
	})

	r.GET("/api/openapi.json", openapi.OpenAPIJSON)
	r.GET("/api/docs", openapi.SwaggerUI)
	r.GET("/api/docs/", openapi.SwaggerUI)

	r.POST("/api/auth/register", authH.Register)
	r.POST("/api/auth/login", authH.Login)

	bch := blockchainhandler.NewHandler(d)
	r.GET("/api/blockchain/transfer-history", bch.List)
	r.POST("/api/blockchain/transfer-history", bch.Append)
	r.DELETE("/api/blockchain/transfer-history", bch.Clear)

	tasks := r.Group("/api/tasks")
	tasks.Use(middleware.TasksAuth(d))
	{
		tasks.GET("", taskH.List)
		tasks.POST("", taskH.Create)
		tasks.GET("/:taskId", taskH.Get)
		tasks.PATCH("/:taskId", taskH.Patch)
		tasks.DELETE("/:taskId", taskH.Delete)
	}

	staticRoot := staticdir.Resolve()

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{
				"message": "Not found",
				"path":    path,
			})
			return
		}
		if staticRoot == "" {
			c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
			return
		}
		rel := strings.TrimPrefix(path, "/")
		rel = filepath.Clean("/" + rel)
		if rel == "/" || rel == "." {
			rel = "/index.html"
		}
		target := filepath.Join(staticRoot, strings.TrimPrefix(rel, "/"))
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(staticRoot)) {
			c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
			return
		}
		if fi, err := os.Stat(target); err == nil && !fi.IsDir() {
			c.File(target)
			return
		}
		c.File(filepath.Join(staticRoot, "index.html"))
	})

	return r
}
