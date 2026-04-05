package auth

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"task/backend-go/internal/dao"
	"task/backend-go/pkg/userjwt"
)

const bcryptCost = 10

var (
	usernameRe = regexp.MustCompile(`^[a-z0-9_]{2,32}$`)
)

type Service struct {
	dao *dao.Dao
}

func NewService(d *dao.Dao) *Service {
	return &Service{dao: d}
}

type CredentialRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func normalizeUsername(raw string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if !usernameRe.MatchString(s) {
		return "", false
	}
	return s, true
}

func validatePassword(raw string) (string, bool) {
	if len(raw) < 6 || len(raw) > 128 {
		return "", false
	}
	return raw, true
}

var (
	ErrValidation = errors.New("validation")
	ErrTaken      = errors.New("taken")
	ErrAuth       = errors.New("auth")
)

func (s *Service) Register(ctx context.Context, req CredentialRequest) (token string, username string, err error) {
	u, ok := normalizeUsername(req.Username)
	if !ok {
		return "", "", ErrValidation
	}
	pw, ok := validatePassword(req.Password)
	if !ok {
		return "", "", ErrValidation
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcryptCost)
	if err != nil {
		return "", "", err
	}
	if err := s.dao.UserAdd(ctx, u, string(hash)); err != nil {
		if errors.Is(err, dao.ErrUsernameTaken) {
			return "", "", ErrTaken
		}
		return "", "", err
	}
	tok, err := userjwt.SignUserToken(u)
	if err != nil {
		return "", "", err
	}
	return tok, u, nil
}

func (s *Service) Login(ctx context.Context, req CredentialRequest) (token string, username string, err error) {
	u, ok := normalizeUsername(req.Username)
	if !ok {
		return "", "", ErrValidation
	}
	pw, ok := validatePassword(req.Password)
	if !ok {
		return "", "", ErrValidation
	}
	hash, ok, err := s.dao.UserGetPasswordHash(ctx, u)
	if err != nil {
		return "", "", err
	}
	if !ok {
		return "", "", ErrAuth
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) != nil {
		return "", "", ErrAuth
	}
	tok, err := userjwt.SignUserToken(u)
	if err != nil {
		return "", "", err
	}
	return tok, u, nil
}
