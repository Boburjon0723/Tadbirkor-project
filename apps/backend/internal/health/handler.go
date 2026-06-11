package health

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

type Handler struct {
	Pool      *pgxpool.Pool
	Cache     *cache.Cache
	StartTime time.Time
}

func (h *Handler) Deep(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	dbStatus := "ok"
	var one int
	if err := h.Pool.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
		dbStatus = "error"
	}

	redisStatus := "skip"
	switch ping := h.Cache.Ping(ctx); ping {
	case "PONG":
		redisStatus = "ok"
	case "memory-only":
		redisStatus = "skip"
	default:
		if strings.HasPrefix(ping, "error:") {
			redisStatus = "error"
		}
	}

	ok := dbStatus == "ok" && (redisStatus == "ok" || redisStatus == "skip")
	status := http.StatusOK
	if !ok {
		status = http.StatusServiceUnavailable
	}

	httpx.JSON(w, status, map[string]any{
		"ok":        ok,
		"service":   "backend-go",
		"db":        dbStatus,
		"redis":     redisStatus,
		"uptimeSec": int(time.Since(h.StartTime).Seconds()),
	})
}
