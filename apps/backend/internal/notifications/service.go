package notifications

import (
	"context"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

type Service struct {
	pool     *pgxpool.Pool
	hub      pkgrealtime.Hub
	delivery *DeliveryService
}

func NewService(pool *pgxpool.Pool, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, hub: hub}
}

func (s *Service) SetDelivery(d *DeliveryService) {
	s.delivery = d
}

func (s *Service) FindAll(ctx context.Context, userID string, page, limit int) (map[string]any, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	var total int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Notification" WHERE "userId" = $1`, userID).Scan(&total)
	rows, err := s.pool.Query(ctx, `
		SELECT id, title, message, type, "moduleKey", "eventKey", "isRead", "createdAt"
		FROM "Notification"
		WHERE "userId" = $1
		ORDER BY "createdAt" DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, title, message, ntype string
		var moduleKey, eventKey *string
		var isRead bool
		var createdAt any
		if err := rows.Scan(&id, &title, &message, &ntype, &moduleKey, &eventKey, &isRead, &createdAt); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": id, "title": title, "message": message, "type": ntype,
			"moduleKey": moduleKey, "eventKey": eventKey, "isRead": isRead, "createdAt": createdAt,
		})
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": offset+len(items) < total,
	}, nil
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (map[string]int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Notification" WHERE "userId" = $1 AND "isRead" = false`, userID).Scan(&count)
	return map[string]int{"count": count}, err
}

func (s *Service) MarkRead(ctx context.Context, id, userID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Notification" SET "isRead" = true WHERE id = $1 AND "userId" = $2`, id, userID)
	if err == nil && s.hub != nil {
		s.hub.EmitToUser(userID, "notification:updated", map[string]any{"id": id, "isRead": true})
	}
	return err
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Notification" SET "isRead" = true WHERE "userId" = $1 AND "isRead" = false`, userID)
	if err == nil && s.hub != nil {
		s.hub.EmitToUser(userID, "notification:all_read", map[string]any{"success": true})
	}
	return err
}

func ParsePageLimit(pageStr, limitStr string) (int, int) {
	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	return page, limit
}
