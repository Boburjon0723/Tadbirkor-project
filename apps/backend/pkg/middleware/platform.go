package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

func RequirePlatformAdmin(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
				return
			}
			var email, login string
			err := pool.QueryRow(r.Context(), `SELECT COALESCE(email,''), COALESCE(login,'') FROM "User" WHERE id = $1`, claims.Sub).Scan(&email, &login)
			if err != nil || !isPlatformAdminUser(email, login) {
				httpx.Error(w, http.StatusForbidden, "Platforma administratori huquqi yo'q")
				return
			}
			if pinRequired() && !verifyPlatformAdminPin(r.Header.Get("X-Platform-Admin-Pin")) {
				httpx.Error(w, http.StatusForbidden, "Admin panel paroli noto'g'ri yoki kiritilmagan")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func IsPlatformAdminUser(email, login string) bool {
	return isPlatformAdminUser(email, login)
}

func PlatformAdminPinRequired() bool { return pinRequired() }

func VerifyPlatformAdminPin(input string) bool { return verifyPlatformAdminPin(input) }

func isPlatformAdminUser(email, login string) bool {
	emails := envList("PLATFORM_ADMIN_EMAILS", "PLATFORM_ADMIN_EMAIL", "ADMIN_EMAILS", "ADMIN_EMAIL")
	logins := envList("PLATFORM_ADMIN_LOGINS", "ADMIN_LOGINS", "ADMIN_LOGIN")
	if len(emails) == 0 && len(logins) == 0 {
		return false
	}
	e := strings.ToLower(strings.TrimSpace(email))
	l := strings.ToLower(strings.TrimSpace(login))
	if e != "" {
		for _, a := range emails {
			if a == e {
				return true
			}
		}
	}
	if l != "" {
		for _, a := range logins {
			if a == l {
				return true
			}
		}
	}
	return false
}

func envList(keys ...string) []string {
	out := []string{}
	for _, key := range keys {
		for _, part := range strings.FieldsFunc(os.Getenv(key), func(r rune) bool {
			return r == ',' || r == ';' || r == ' ' || r == '\n'
		}) {
			v := strings.ToLower(strings.TrimSpace(part))
			if v != "" {
				out = append(out, v)
			}
		}
	}
	return out
}

func platformAdminPin() string {
	for _, key := range []string{"PLATFORM_ADMIN_PIN", "ADMIN_PIN", "ADMIN_PASSWORD"} {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}

func pinRequired() bool {
	return len(platformAdminPin()) >= 4
}

func verifyPlatformAdminPin(input string) bool {
	expected := platformAdminPin()
	if expected == "" || len(expected) < 4 {
		return true
	}
	a := []byte(strings.TrimSpace(input))
	b := []byte(expected)
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}
