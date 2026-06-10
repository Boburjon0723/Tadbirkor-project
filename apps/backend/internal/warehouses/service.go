package warehouses

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

var ErrNotFound = errors.New("Ombor topilmadi")

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) FindAll(ctx context.Context, companyID, userID string) ([]map[string]any, error) {
	whScope, _ := scope.ForUser(ctx, s.pool, companyID, userID)
	base := `
		SELECT id, "companyId", name, address, "fieldConfig", status, "createdAt", "updatedAt"
		FROM "Warehouse"
		WHERE "companyId" = $1 AND status <> 'ARCHIVED'
	`
	var rows pgx.Rows
	var err error
	if !whScope.All {
		if len(whScope.WarehouseIDs) == 0 {
			return []map[string]any{}, nil
		}
		rows, err = s.pool.Query(ctx, base+` AND id = ANY($2) ORDER BY "createdAt" DESC`, companyID, whScope.WarehouseIDs)
	} else {
		rows, err = s.pool.Query(ctx, base+` ORDER BY "createdAt" DESC`, companyID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWarehouses(rows)
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT w.id, w."companyId", w.name, w.address, w."fieldConfig", w.status, w."createdAt", w."updatedAt",
		       (SELECT COUNT(*)::int FROM "StockBalance" sb WHERE sb."warehouseId" = w.id) AS stock_count,
		       (SELECT COUNT(*)::int FROM "StockMovement" sm WHERE sm."warehouseId" = w.id) AS movement_count
		FROM "Warehouse" w WHERE w.id = $1 AND w."companyId" = $2
	`, id, companyID)
	wh, err := scanWarehouseRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return wh, err
}

func scanWarehouses(rows pgx.Rows) ([]map[string]any, error) {
	out := []map[string]any{}
	for rows.Next() {
		item, err := scanWarehouseFromRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func scanWarehouseRow(row pgx.Row) (map[string]any, error) {
	var id, companyID, name, status string
	var address *string
	var fieldConfig []byte
	var createdAt, updatedAt any
	var stockCount, movementCount *int
	err := row.Scan(&id, &companyID, &name, &address, &fieldConfig, &status, &createdAt, &updatedAt, &stockCount, &movementCount)
	if err != nil {
		return nil, err
	}
	m := baseWarehouse(id, companyID, name, address, fieldConfig, status, createdAt, updatedAt)
	if stockCount != nil {
		m["_count"] = map[string]any{"stockBalances": *stockCount, "movements": *movementCount}
	}
	return m, nil
}

func scanWarehouseFromRows(rows pgx.Rows) (map[string]any, error) {
	var id, companyID, name, status string
	var address *string
	var fieldConfig []byte
	var createdAt, updatedAt any
	if err := rows.Scan(&id, &companyID, &name, &address, &fieldConfig, &status, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return baseWarehouse(id, companyID, name, address, fieldConfig, status, createdAt, updatedAt), nil
}

func baseWarehouse(id, companyID, name string, address *string, fieldConfig []byte, status string, createdAt, updatedAt any) map[string]any {
	var fc any = nil
	if len(fieldConfig) > 0 {
		_ = json.Unmarshal(fieldConfig, &fc)
	}
	return map[string]any{
		"id": id, "companyId": companyID, "name": name, "address": address,
		"fieldConfig": fc, "status": status, "createdAt": createdAt, "updatedAt": updatedAt,
	}
}
