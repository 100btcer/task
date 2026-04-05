package userjwt

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

const devDefaultSecret = "dev-user-auth-secret-change-me"

// SecretBytes returns HS256 key bytes (AUTH_JWT_SECRET → API_JWT_SECRET → dev default).
func SecretBytes() []byte {
	s := strings.TrimSpace(os.Getenv("AUTH_JWT_SECRET"))
	if s == "" {
		s = strings.TrimSpace(os.Getenv("API_JWT_SECRET"))
	}
	if s == "" {
		s = devDefaultSecret
	}
	return []byte(s)
}

// SignUserToken issues a JWT matching backend-ts (jose): typ "user", sub = username, exp 7d.
func SignUserToken(username string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"typ": "user",
		"sub": username,
		"iat": now.Unix(),
		"exp": now.Add(7 * 24 * time.Hour).Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(SecretBytes())
}

// ParseUserToken verifies HS256 and returns username from sub, or error.
func ParseUserToken(tokenString string) (username string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return SecretBytes(), nil
	})
	if err != nil || !token.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}
	if typ, _ := claims["typ"].(string); typ != "user" {
		return "", errors.New("invalid token type")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("invalid subject")
	}
	return sub, nil
}
