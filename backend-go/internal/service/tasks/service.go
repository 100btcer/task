package tasks

import (
	"context"
	"encoding/json"
	"io"
	"strings"

	"task/backend-go/internal/dao"
)

type Service struct {
	dao *dao.Dao
}

func NewService(d *dao.Dao) *Service {
	return &Service{dao: d}
}

type ListResult struct {
	Items []dao.Task
	Total int
	Page  int
	Limit int
}

func (s *Service) List(ctx context.Context, userID int64, page, limit int) (*ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	all, err := s.dao.TasksListSortedDesc(ctx, userID)
	if err != nil {
		return nil, err
	}
	total := len(all)
	start := (page - 1) * limit
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}
	items := all[start:end]
	return &ListResult{Items: items, Total: total, Page: page, Limit: limit}, nil
}

func (s *Service) Create(ctx context.Context, userID int64, title string, description *string) (*dao.Task, error) {
	t := strings.TrimSpace(title)
	if t == "" {
		return nil, ErrTitleRequired
	}
	var desc *string
	if description != nil {
		d := strings.TrimSpace(*description)
		if d != "" {
			desc = &d
		}
	}
	return s.dao.TaskCreate(ctx, userID, t, desc)
}

func (s *Service) Get(ctx context.Context, userID, id int64) (*dao.Task, error) {
	return s.dao.TaskGet(ctx, userID, id)
}

// Patch applies JSON body rules matching backend-ts (only known keys).
func (s *Service) Patch(ctx context.Context, userID, id int64, body io.Reader) (*dao.Task, error) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(body).Decode(&raw); err != nil {
		if err == io.EOF {
			raw = map[string]json.RawMessage{}
		} else {
			return nil, err
		}
	}
	if raw == nil {
		raw = map[string]json.RawMessage{}
	}
	cur, err := s.dao.TaskGet(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if cur == nil {
		return nil, nil
	}
	var patch dao.TaskPatch
	if v, ok := raw["title"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err == nil {
			patch.TitleSet = true
			patch.Title = strings.TrimSpace(s)
		}
	}
	if _, ok := raw["description"]; ok {
		patch.DescriptionSet = true
		v := raw["description"]
		if string(v) == "null" {
			patch.Description = nil
		} else {
			var s string
			if err := json.Unmarshal(v, &s); err == nil {
				patch.Description = &s
			}
		}
	}
	if v, ok := raw["completed"]; ok {
		var b bool
		if err := json.Unmarshal(v, &b); err == nil {
			patch.CompletedSet = true
			patch.Completed = b
		}
	}
	return s.dao.TaskUpdate(ctx, userID, id, patch)
}

func (s *Service) Delete(ctx context.Context, userID, id int64) (bool, error) {
	return s.dao.TaskDelete(ctx, userID, id)
}

func (s *Service) Exists(ctx context.Context, userID, id int64) (bool, error) {
	return s.dao.TaskExists(ctx, userID, id)
}

var ErrTitleRequired = errTitle{}

type errTitle struct{}

func (errTitle) Error() string { return "title is required" }
