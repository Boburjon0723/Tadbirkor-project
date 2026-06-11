package middleware

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

var permPool *pgxpool.Pool

// ConfigurePermissions — JWT dagi rol + CompanyUser grant/deny ni middleware da hisoblash.
func ConfigurePermissions(pool *pgxpool.Pool) {
	permPool = pool
}

func resolvePermissions(ctx context.Context, claims *JWTClaims) []string {
	if permPool == nil {
		return permissions.Effective(claims.Role, nil, nil)
	}
	var role string
	var grant, deny []string
	err := permPool.QueryRow(ctx, `
		SELECT role, "grantPermissions", "denyPermissions" FROM "CompanyUser"
		WHERE "companyId" = $1 AND "userId" = $2 LIMIT 1
	`, claims.CompanyID, claims.Sub).Scan(&role, &grant, &deny)
	if err != nil {
		return permissions.Effective(claims.Role, nil, nil)
	}
	if role == "" {
		role = claims.Role
	}
	return permissions.Effective(role, grant, deny)
}

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
			perms := resolvePermissions(r.Context(), claims)
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
			perms := resolvePermissions(r.Context(), claims)
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
