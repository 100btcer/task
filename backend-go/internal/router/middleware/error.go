package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[backend-go] panic: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"message": "Internal error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
