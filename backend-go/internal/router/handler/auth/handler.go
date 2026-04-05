package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	authsvc "task/backend-go/internal/service/auth"
)

type Handler struct {
	svc *authsvc.Service
}

func NewHandler(s *authsvc.Service) *Handler {
	return &Handler{svc: s}
}

func (h *Handler) Register(c *gin.Context) {
	var req authsvc.CredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "username must be 2–32 chars (lowercase letters, digits, underscore); password 6–128 chars",
			"code":    "VALIDATION",
			"status":  400,
		})
		return
	}
	token, username, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, authsvc.ErrValidation) {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "username must be 2–32 chars (lowercase letters, digits, underscore); password 6–128 chars",
				"code":    "VALIDATION",
				"status":  400,
			})
			return
		}
		if errors.Is(err, authsvc.ErrTaken) {
			c.JSON(http.StatusConflict, gin.H{
				"message": "Username already taken",
				"code":    "CONFLICT",
				"status":  409,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "username": username})
}

func (h *Handler) Login(c *gin.Context) {
	var req authsvc.CredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid username or password",
			"code":    "VALIDATION",
			"status":  400,
		})
		return
	}
	token, username, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, authsvc.ErrValidation) {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Invalid username or password",
				"code":    "VALIDATION",
				"status":  400,
			})
			return
		}
		if errors.Is(err, authsvc.ErrAuth) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Invalid username or password",
				"code":    "UNAUTHORIZED",
				"status":  401,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "username": username})
}
