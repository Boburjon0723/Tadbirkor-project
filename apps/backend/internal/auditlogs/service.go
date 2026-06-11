package auditlogs

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("Audit log topilmadi")

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type ListQuery struct {
	Action     string
	EntityType string
	UserID     string
	DateFrom   string
	DateTo     string
	Limit      int
	Offset     int
}

func (s *Service) FindAll(ctx context.Context, companyID string, q ListQuery) ([]map[string]any, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	sql := `
		SELECT id, "companyId", "userId", action, "entityType", "entityId", "oldData", "newData", "createdAt"
		FROM "AuditLog"
		WHERE "companyId" = $1
	`
	args := []any{companyID}
	n := 2
	if q.Action != "" {
		sql += ` AND action = $` + itoa(n)
		args = append(args, q.Action)
		n++
	}
	if q.EntityType != "" {
		sql += ` AND "entityType" = $` + itoa(n)
		args = append(args, q.EntityType)
		n++
	}
	if q.UserID != "" {
		sql += ` AND "userId" = $` + itoa(n)
		args = append(args, q.UserID)
		n++
	}
	if q.DateFrom != "" {
		sql += ` AND "createdAt" >= $` + itoa(n)
		args = append(args, q.DateFrom)
		n++
	}
	if q.DateTo != "" {
		sql += ` AND "createdAt" < ($` + itoa(n) + `::date + interval '1 day')`
		args = append(args, q.DateTo)
		n++
	}
	sql += ` ORDER BY "createdAt" DESC LIMIT $` + itoa(n) + ` OFFSET $` + itoa(n+1)
	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs, err := scanLogs(rows)
	if err != nil {
		return nil, err
	}
	return s.attachUserMeta(ctx, logs)
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, "companyId", "userId", action, "entityType", "entityId", "oldData", "newData", "createdAt"
		FROM "AuditLog" WHERE id = $1 AND "companyId" = $2
	`, id, companyID)
	log, err := scanLogRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	withUser, err := s.attachUserMeta(ctx, []map[string]any{log})
	if err != nil || len(withUser) == 0 {
		return nil, err
	}
	return withUser[0], nil
}

func (s *Service) GetStats(ctx context.Context, companyID string) (map[string]any, error) {
	today := time.Now().Truncate(24 * time.Hour)
	var totalToday, priceUpdates, stockActions int
	err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM "AuditLog" WHERE "companyId" = $1 AND "createdAt" >= $2),
			(SELECT COUNT(*)::int FROM "AuditLog" WHERE "companyId" = $1 AND (
				action IN ('product.price_updated', 'pos.price_override')
				OR (action = 'product.updated' AND "newData" ? 'salePrice')
				OR (action = 'product.updated' AND "newData" ? 'purchasePrice')
			)),
			(SELECT COUNT(*)::int FROM "AuditLog" WHERE "companyId" = $1 AND (
				action IN ('stock.in', 'stock.out', 'stock.adjusted')
				OR "entityType" IN ('STOCK_MOVEMENT', 'STOCK_BALANCE')
			))
	`, companyID, today).Scan(&totalToday, &priceUpdates, &stockActions)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"totalToday":   totalToday,
		"priceUpdates": priceUpdates,
		"stockActions": stockActions,
	}, nil
}

func (s *Service) attachUserMeta(ctx context.Context, logs []map[string]any) ([]map[string]any, error) {
	ids := map[string]struct{}{}
	for _, l := range logs {
		if uid, ok := l["userId"].(string); ok && uid != "" {
			ids[uid] = struct{}{}
		}
	}
	if len(ids) == 0 {
		for i := range logs {
			logs[i]["user"] = nil
		}
		return logs, nil
	}
	userIDs := make([]string, 0, len(ids))
	for id := range ids {
		userIDs = append(userIDs, id)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, "fullName", login, phone FROM "User" WHERE id = ANY($1)
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byID := map[string]map[string]any{}
	for rows.Next() {
		var id string
		var fullName, login, phone *string
		if err := rows.Scan(&id, &fullName, &login, &phone); err != nil {
			return nil, err
		}
		byID[id] = map[string]any{"id": id, "fullName": fullName, "login": login, "phone": phone}
	}
	for i, l := range logs {
		uid, _ := l["userId"].(string)
		if u, ok := byID[uid]; ok {
			logs[i]["user"] = u
		} else {
			logs[i]["user"] = nil
		}
		logs[i]["orderSummary"] = nil
	}
	return logs, rows.Err()
}

func scanLogs(rows pgx.Rows) ([]map[string]any, error) {
	out := []map[string]any{}
	for rows.Next() {
		item, err := scanLogFromRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func scanLogRow(row pgx.Row) (map[string]any, error) {
	var id, companyID, userID, action, entityType, entityID string
	var oldData, newData []byte
	var createdAt time.Time
	err := row.Scan(&id, &companyID, &userID, &action, &entityType, &entityID, &oldData, &newData, &createdAt)
	if err != nil {
		return nil, err
	}
	return mapLog(id, companyID, userID, action, entityType, entityID, oldData, newData, createdAt), nil
}

func scanLogFromRows(rows pgx.Rows) (map[string]any, error) {
	var id, companyID, userID, action, entityType, entityID string
	var oldData, newData []byte
	var createdAt time.Time
	err := rows.Scan(&id, &companyID, &userID, &action, &entityType, &entityID, &oldData, &newData, &createdAt)
	if err != nil {
		return nil, err
	}
	return mapLog(id, companyID, userID, action, entityType, entityID, oldData, newData, createdAt), nil
}

func mapLog(id, companyID, userID, action, entityType, entityID string, oldData, newData []byte, createdAt time.Time) map[string]any {
	return map[string]any{
		"id": id, "companyId": companyID, "userId": userID,
		"action": action, "entityType": entityType, "entityId": entityID,
		"oldData": parseJSON(oldData), "newData": parseJSON(newData),
		"createdAt": createdAt,
	}
}

func parseJSON(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	var v any
	if json.Unmarshal(b, &v) == nil {
		return v
	}
	return nil
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
