package dao

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// ErrUsernameTaken is returned when INSERT violates UNIQUE on users.username.
var ErrUsernameTaken = errors.New("username taken")

func (d *Dao) UserAdd(ctx context.Context, username, passwordHash string) error {
	_, err := d.db.ExecContext(ctx, `INSERT INTO users (username, password_hash) VALUES (?, ?)`, username, passwordHash)
	if err == nil {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "unique") {
		return ErrUsernameTaken
	}
	return err
}

// UserIDByUsername returns the numeric user id for JWT subject (username), if present.
func (d *Dao) UserIDByUsername(ctx context.Context, username string) (id int64, ok bool, err error) {
	row := d.db.QueryRowContext(ctx,
		`SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
		username,
	)
	var uid int64
	if err := row.Scan(&uid); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return uid, true, nil
}

func (d *Dao) UserGetPasswordHash(ctx context.Context, username string) (hash string, ok bool, err error) {
	row := d.db.QueryRowContext(ctx,
		`SELECT password_hash FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
		username,
	)
	var h sql.NullString
	if err := row.Scan(&h); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	if !h.Valid {
		return "", false, nil
	}
	return h.String, true, nil
}
