package dao

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"
)

type Task struct {
	UserID      int64
	ID          int64
	Title       string
	Description *string
	Completed   bool
	CreatedAt   string
	UpdatedAt   string
}

func (d *Dao) TasksListSortedDesc(ctx context.Context, userID int64) ([]Task, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT id, user_id, title, description, completed, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Task
	for rows.Next() {
		var t Task
		var desc sql.NullString
		var completed int
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &desc, &completed, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		if desc.Valid {
			s := desc.String
			t.Description = &s
		}
		t.Completed = completed != 0
		list = append(list, t)
	}
	return list, rows.Err()
}

func (d *Dao) TaskGet(ctx context.Context, userID, id int64) (*Task, error) {
	row := d.db.QueryRowContext(ctx,
		`SELECT id, user_id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ?`,
		id, userID,
	)
	var t Task
	var desc sql.NullString
	var completed int
	if err := row.Scan(&t.ID, &t.UserID, &t.Title, &desc, &completed, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if desc.Valid {
		s := desc.String
		t.Description = &s
	}
	t.Completed = completed != 0
	return &t, nil
}

func (d *Dao) TaskCreate(ctx context.Context, userID int64, title string, description *string) (*Task, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	var desc interface{}
	if description != nil {
		desc = *description
	}
	res, err := d.db.ExecContext(ctx,
		`INSERT INTO tasks (user_id, title, description, completed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
		userID, title, desc, now, now,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return &Task{
		UserID: userID, ID: id, Title: title, Description: description, Completed: false,
		CreatedAt: now, UpdatedAt: now,
	}, nil
}

// TaskPatch describes partial update (omit field = leave unchanged).
type TaskPatch struct {
	TitleSet       bool
	Title          string
	DescriptionSet bool
	// If DescriptionSet && Description == nil → store SQL NULL.
	Description *string
	CompletedSet bool
	Completed   bool
}

func (d *Dao) TaskUpdate(ctx context.Context, userID, id int64, patch TaskPatch) (*Task, error) {
	cur, err := d.TaskGet(ctx, userID, id)
	if err != nil || cur == nil {
		return nil, err
	}
	newTitle := cur.Title
	if patch.TitleSet {
		newTitle = patch.Title
	}
	var descPtr *string
	if patch.DescriptionSet {
		descPtr = patch.Description
	} else {
		descPtr = cur.Description
	}
	newCompleted := cur.Completed
	if patch.CompletedSet {
		newCompleted = patch.Completed
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	var descSQL interface{}
	if descPtr != nil {
		descSQL = *descPtr
	}
	completedInt := 0
	if newCompleted {
		completedInt = 1
	}
	_, err = d.db.ExecContext(ctx,
		`UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		newTitle, descSQL, completedInt, now, id, userID,
	)
	if err != nil {
		return nil, err
	}
	return &Task{
		UserID: userID, ID: id, Title: newTitle, Description: descPtr, Completed: newCompleted,
		CreatedAt: cur.CreatedAt, UpdatedAt: now,
	}, nil
}

func (d *Dao) TaskDelete(ctx context.Context, userID, id int64) (bool, error) {
	res, err := d.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

func (d *Dao) TaskExists(ctx context.Context, userID, id int64) (bool, error) {
	var x int
	err := d.db.QueryRowContext(ctx, `SELECT 1 FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`, id, userID).Scan(&x)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// ParseTaskID mirrors backend-ts normalizeId (path/query).
func ParseTaskID(s string) (int64, bool) {
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil || n < 1 {
		return 0, false
	}
	return n, true
}
