package realtime

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
)

type jwtClaims struct {
	Sub       string `json:"sub"`
	CompanyID string `json:"companyId"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

func extractHandshakeToken(hs *socketio.Handshake) string {
	if hs != nil && hs.Auth != nil {
		if t, ok := hs.Auth["token"].(string); ok && strings.TrimSpace(t) != "" {
			return strings.TrimSpace(t)
		}
	}
	if hs != nil && hs.Headers != nil {
		header := hs.Headers.Header()
		if auth := header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			return strings.TrimSpace(auth[7:])
		}
		if cookie := header.Get("Cookie"); cookie != "" {
			return cookieToken(cookie, "access_token")
		}
	}
	return ""
}

func cookieToken(cookieHeader, name string) string {
	if cookieHeader == "" {
		return ""
	}
	req := &http.Request{Header: http.Header{"Cookie": {cookieHeader}}}
	if c, err := req.Cookie(name); err == nil {
		return strings.TrimSpace(c.Value)
	}
	return ""
}

func verifyJWT(secret, token string) (*jwtClaims, error) {
	claims := &jwtClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil || !parsed.Valid {
		return nil, err
	}
	return claims, nil
}

func authMiddleware(secret, cookieName string, requireCompany bool) func(*socketio.Socket, func(*socketio.ExtendedError)) {
	return func(s *socketio.Socket, next func(*socketio.ExtendedError)) {
		token := extractHandshakeToken(s.Handshake())
		if token == "" && cookieName != "" {
			if hs := s.Handshake(); hs != nil && hs.Headers != nil {
				if cookie := hs.Headers.Header().Get("Cookie"); cookie != "" {
					token = cookieToken(cookie, cookieName)
				}
			}
		}
		if token == "" {
			next(socketio.NewExtendedError("authentication error", map[string]any{"message": "no token"}))
			return
		}
		claims, err := verifyJWT(secret, token)
		if err != nil {
			next(socketio.NewExtendedError("authentication error", map[string]any{"message": "invalid token"}))
			return
		}
		if requireCompany && strings.TrimSpace(claims.CompanyID) == "" {
			next(socketio.NewExtendedError("authentication error", map[string]any{"message": "no company"}))
			return
		}
		if !requireCompany && strings.TrimSpace(claims.Sub) == "" {
			next(socketio.NewExtendedError("authentication error", map[string]any{"message": "no user"}))
			return
		}
		s.SetData(map[string]any{
			"userId":    claims.Sub,
			"companyId": claims.CompanyID,
			"role":      claims.Role,
		})
		next(nil)
	}
}
