package categories

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

var ErrNotFound = errors.New("Kategoriya topilmadi")

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

func (s *Service) cacheKey(companyID, warehouseID string) string {
	wh := warehouseID
	if wh == "" {
		wh = "*"
	}
	return cache.CategoriesPrefix(companyID) + wh
}

func (s *Service) FindAll(ctx context.Context, companyID, warehouseID string) ([]map[string]any, error) {
	key := s.cacheKey(companyID, warehouseID)
	var cached []map[string]any
	if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
		return cached, nil
	}

	sql := `
		SELECT c.id, c.name, c.status, c."parentId", c."warehouseId", c."createdAt", c."updatedAt",
		       p.id, p.name, w.id, w.name
		FROM "ProductCategory" c
		LEFT JOIN "ProductCategory" p ON p.id = c."parentId"
		LEFT JOIN "Warehouse" w ON w.id = c."warehouseId"
		WHERE c."companyId" = $1 AND c.status <> 'ARCHIVED'
	`
	args := []any{companyID}
	if strings.TrimSpace(warehouseID) != "" {
		sql += ` AND c."warehouseId" = $2`
		args = append(args, warehouseID)
	}
	sql += ` ORDER BY c."createdAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id, name, status string
		var parentID, warehouseIDCol *string
		var createdAt, updatedAt time.Time
		var pID, pName, wID, wName *string
		if err := rows.Scan(&id, &name, &status, &parentID, &warehouseIDCol, &createdAt, &updatedAt,
			&pID, &pName, &wID, &wName); err != nil {
			return nil, err
		}
		row := map[string]any{
			"id": id, "name": name, "status": status, "parentId": parentID,
			"warehouseId": warehouseIDCol, "createdAt": createdAt, "updatedAt": updatedAt,
		}
		if pID != nil {
			row["parent"] = map[string]any{"id": *pID, "name": *pName}
		}
		if wID != nil {
			row["warehouse"] = map[string]any{"id": *wID, "name": *wName}
		}
		out = append(out, row)
	}
	_ = s.cache.SetJSON(ctx, key, out, 5*time.Minute)
	return out, rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	var name, status string
	var parentID, warehouseID *string
	var createdAt, updatedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT name, status, "parentId", "warehouseId", "createdAt", "updatedAt"
		FROM "ProductCategory" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&name, &status, &parentID, &warehouseID, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	childRows, err := s.pool.Query(ctx, `
		SELECT id, name, status FROM "ProductCategory" WHERE "parentId" = $1 AND "companyId" = $2
	`, id, companyID)
	if err != nil {
		return nil, err
	}
	defer childRows.Close()
	children := []map[string]any{}
	for childRows.Next() {
		var cid, cname, cstatus string
		if err := childRows.Scan(&cid, &cname, &cstatus); err != nil {
			return nil, err
		}
		children = append(children, map[string]any{"id": cid, "name": cname, "status": cstatus})
	}

	result := map[string]any{
		"id": id, "name": name, "status": status, "parentId": parentID,
		"warehouseId": warehouseID, "createdAt": createdAt, "updatedAt": updatedAt,
		"children": children,
	}
	if parentID != nil {
		var pName string
		if err := s.pool.QueryRow(ctx, `SELECT name FROM "ProductCategory" WHERE id = $1`, *parentID).Scan(&pName); err == nil {
			result["parent"] = map[string]any{"id": *parentID, "name": pName}
		}
	}
	if warehouseID != nil {
		var wName string
		if err := s.pool.QueryRow(ctx, `SELECT name FROM "Warehouse" WHERE id = $1`, *warehouseID).Scan(&wName); err == nil {
			result["warehouse"] = map[string]any{"id": *warehouseID, "name": wName}
		}
	}
	return result, nil
}
