package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

type contextKey string

const UserContextKey contextKey = "user"

type JWTClaims struct {
	Sub       string `json:"sub"`
	CompanyID string `json:"companyId"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

func ExtractToken(r *http.Request, cookieName string) string {
	if c, err := r.Cookie(cookieName); err == nil && c.Value != "" {
		return c.Value
	}
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func JWTAuth(secret, cookieName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ExtractToken(r, cookieName)
			if tokenStr == "" {
				httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
				return
			}
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				httpx.Error(w, http.StatusUnauthorized, "Yaroqsiz token")
				return
			}
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ClaimsFromContext(ctx context.Context) (*JWTClaims, bool) {
	claims, ok := ctx.Value(UserContextKey).(*JWTClaims)
	return claims, ok
}
