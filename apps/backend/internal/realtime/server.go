package realtime

import (
	"net/http"
	"strings"

	"github.com/tadbirkor/axis-erp/backend/internal/config"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"
)

// Server — Socket.IO /inventory va /notifications namespace serveri.
type Server struct {
	hub           *socketHub
	socketHandler http.Handler
}

func New(cfg config.Config) *Server {
	opts := socketio.DefaultServerOptions()
	opts.SetCors(socketCors(cfg.CORSOrigins))

	server := socketio.NewServer(nil, opts)
	hub := &socketHub{server: server}

	inv := server.Of("/inventory", nil)
	inv.Use(authMiddleware(cfg.JWTSecret, cfg.AuthCookieName, true))
	inv.On("connection", onInventoryConnect(hub))

	notif := server.Of("/notifications", nil)
	notif.Use(authMiddleware(cfg.JWTSecret, cfg.AuthCookieName, false))
	notif.On("connection", onNotificationsConnect(hub))

	return &Server{
		hub:           hub,
		socketHandler: server.ServeHandler(nil),
	}
}

func (s *Server) Hub() pkgrealtime.Hub {
	if s == nil || s.hub == nil {
		return pkgrealtime.Noop
	}
	return s.hub
}

// Wrap — REST API bilan bir portda /socket.io marshrutini birlashtiradi.
func (s *Server) Wrap(api http.Handler) http.Handler {
	if s == nil || s.socketHandler == nil {
		return api
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/socket.io") {
			s.socketHandler.ServeHTTP(w, r)
			return
		}
		api.ServeHTTP(w, r)
	})
}

func onInventoryConnect(hub *socketHub) func(...any) {
	return func(clients ...any) {
		if len(clients) == 0 {
			return
		}
		client, ok := clients[0].(*socketio.Socket)
		if !ok {
			return
		}
		data, _ := client.Data().(map[string]any)
		companyID, _ := data["companyId"].(string)
		if companyID != "" {
			client.Join(hub.companyRoom(companyID))
		}
	}
}

func onNotificationsConnect(hub *socketHub) func(...any) {
	return func(clients ...any) {
		if len(clients) == 0 {
			return
		}
		client, ok := clients[0].(*socketio.Socket)
		if !ok {
			return
		}
		data, _ := client.Data().(map[string]any)
		userID, _ := data["userId"].(string)
		if userID != "" {
			client.Join(hub.userRoom(userID))
		}
	}
}

func socketCors(origins []string) *types.Cors {
	allowed := map[string]struct{}{}
	for _, o := range origins {
		allowed[strings.TrimSpace(o)] = struct{}{}
	}
	return &types.Cors{
		Origin: func(origin string, cb func(error, bool)) {
			if origin == "" {
				cb(nil, true)
				return
			}
			if _, ok := allowed[origin]; ok {
				cb(nil, true)
				return
			}
			cb(nil, false)
		},
		Credentials: true,
	}
}
