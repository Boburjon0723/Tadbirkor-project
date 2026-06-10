package middleware

import (
	"net/http"

	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

func RequirePermission(required string) func(http.Handler) http.Handler {
	return RequireAllPermissions(required)
}

func RequireAllPermissions(required ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
				return
			}
			perms := permissions.Effective(claims.Role, nil, nil)
			for _, req := range required {
				if !hasPermission(perms, req) {
					httpx.Error(w, http.StatusForbidden, "Ruxsat yo'q")
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireAnyPermission(required ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
				return
			}
			perms := permissions.Effective(claims.Role, nil, nil)
			for _, req := range required {
				if hasPermission(perms, req) {
					next.ServeHTTP(w, r)
					return
				}
			}
			httpx.Error(w, http.StatusForbidden, "Ruxsat yo'q")
		})
	}
}

func hasPermission(perms []string, required string) bool {
	for _, p := range perms {
		if p == required {
			return true
		}
	}
	return false
}
