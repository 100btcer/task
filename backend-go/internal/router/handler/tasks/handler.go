package tasks

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"task/backend-go/internal/dao"
	tasksvc "task/backend-go/internal/service/tasks"
)

type Handler struct {
	svc *tasksvc.Service
}

func NewHandler(s *tasksvc.Service) *Handler {
	return &Handler{svc: s}
}

func taskToJSON(t *dao.Task) gin.H {
	var desc interface{}
	if t.Description != nil {
		desc = *t.Description
	} else {
		desc = nil
	}
	return gin.H{
		"id":          t.ID,
		"userId":      t.UserID,
		"title":       t.Title,
		"description": desc,
		"completed":   t.Completed,
		"createdAt":   t.CreatedAt,
		"updatedAt":   t.UpdatedAt,
	}
}

func authUserID(c *gin.Context) (int64, bool) {
	v, ok := c.Get("authUserID")
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

func qInt(c *gin.Context, key string, def int) int {
	s := strings.TrimSpace(c.Query(key))
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized", "code": "UNAUTHORIZED", "status": 401})
		return
	}
	page := qInt(c, "page", 1)
	limit := qInt(c, "limit", 20)
	if page < 1 {
		page = 1
	}
	res, err := h.svc.List(c.Request.Context(), userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	items := make([]gin.H, 0, len(res.Items))
	for i := range res.Items {
		items = append(items, taskToJSON(&res.Items[i]))
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": res.Total,
		"page":  res.Page,
		"limit": res.Limit,
	})
}

func (h *Handler) Create(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized", "code": "UNAUTHORIZED", "status": 401})
		return
	}
	var body struct {
		Title       string  `json:"title"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "title is required",
			"code":    "VALIDATION",
			"status":  400,
		})
		return
	}
	task, err := h.svc.Create(c.Request.Context(), userID, body.Title, body.Description)
	if err != nil {
		if errors.Is(err, tasksvc.ErrTitleRequired) {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "title is required",
				"code":    "VALIDATION",
				"status":  400,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, taskToJSON(task))
}

func (h *Handler) Get(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized", "code": "UNAUTHORIZED", "status": 401})
		return
	}
	id, ok := dao.ParseTaskID(c.Param("taskId"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	task, err := h.svc.Get(c.Request.Context(), userID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	c.JSON(http.StatusOK, taskToJSON(task))
}

func (h *Handler) Patch(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized", "code": "UNAUTHORIZED", "status": 401})
		return
	}
	id, ok := dao.ParseTaskID(c.Param("taskId"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	task, err := h.svc.Patch(c.Request.Context(), userID, id, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	c.JSON(http.StatusOK, taskToJSON(task))
}

func (h *Handler) Delete(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized", "code": "UNAUTHORIZED", "status": 401})
		return
	}
	id, ok := dao.ParseTaskID(c.Param("taskId"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	ex, err := h.svc.Exists(c.Request.Context(), userID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if !ex {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found", "code": "NOT_FOUND", "status": 404})
		return
	}
	if _, err := h.svc.Delete(c.Request.Context(), userID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
