package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"task/backend-go/pkg/userjwt"
)

// MutationAuth matches backend-ts: GET/HEAD/OPTIONS under /api are anonymous; other methods require Bearer user JWT.
func MutationAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		m := c.Request.Method
		if m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions {
			c.Next()
			return
		}
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Sign in required — send Authorization: Bearer <token> for write operations",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Sign in required — send Authorization: Bearer <token> for write operations",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		user, err := userjwt.ParseUserToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Session expired or invalid. Please sign in again.",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		c.Set("authUsername", user)
		c.Next()
	}
}
