package openapi

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"task/backend-go/config"
)

// hostForOpenAPIServers strips port from Host / X-Forwarded-Host and formats IPv6 for URL authority.
func hostForOpenAPIServers(hostHeader string) string {
	hostHeader = strings.TrimSpace(strings.Split(hostHeader, ",")[0])
	if hostHeader == "" {
		return "127.0.0.1"
	}
	host, _, err := net.SplitHostPort(hostHeader)
	if err != nil {
		host = hostHeader
	}
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		return "[" + host + "]"
	}
	return host
}

func openAPIServersForRequest(c *gin.Context) []map[string]interface{} {
	proto := "http"
	if c.Request.TLS != nil {
		proto = "https"
	}
	if xf := c.GetHeader("X-Forwarded-Proto"); xf != "" {
		proto = strings.TrimSpace(strings.Split(xf, ",")[0])
		proto = strings.TrimSuffix(proto, ":")
	}
	forwardedHost := strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Host"), ",")[0])
	host := c.Request.Host
	if forwardedHost != "" {
		host = forwardedHost
	}
	h := hostForOpenAPIServers(host)

	return []map[string]interface{}{
		{"url": fmt.Sprintf("%s://%s:3000/api", proto, h), "description": "Node.js (backend-ts, port 3000)"},
		{"url": fmt.Sprintf("%s://%s:3001/api", proto, h), "description": "Go (backend-go, port 3001)"},
	}
}

// OpenAPIJSON serves docs/api-spec.json with dynamic servers (same contract as backend-ts).
func OpenAPIJSON(c *gin.Context) {
	path := filepath.Join(config.RepoRoot, "docs", "api-spec.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "openapi spec missing"})
		return
	}
	var spec map[string]interface{}
	if err := json.Unmarshal(raw, &spec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "invalid openapi json"})
		return
	}
	spec["servers"] = openAPIServersForRequest(c)
	c.Header("Content-Type", "application/json")
	c.JSON(http.StatusOK, spec)
}

const swaggerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tasks API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function () {
      var specUrl = new URL('/api/openapi.json', window.location.origin).href;
      window.ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: '#swagger-ui',
        deepLinking: true,
        tryItOutEnabled: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`

func SwaggerUI(c *gin.Context) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, swaggerHTML)
}
