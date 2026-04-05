package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"task/backend-go/internal/dao"
	"task/backend-go/pkg/userjwt"
)

// TasksAuth requires a valid user JWT on all methods (including GET) for /api/tasks. Sets authUserID and authUsername.
func TasksAuth(d *dao.Dao) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Sign in required — send Authorization: Bearer <token> to access tasks",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Sign in required — send Authorization: Bearer <token> to access tasks",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		username, err := userjwt.ParseUserToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Session expired or invalid. Please sign in again.",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		uid, ok, err := d.UserIDByUsername(c.Request.Context(), username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			c.Abort()
			return
		}
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Session expired or invalid. Please sign in again.",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			c.Abort()
			return
		}
		c.Set("authUserID", uid)
		c.Set("authUsername", username)
		c.Next()
	}
}
