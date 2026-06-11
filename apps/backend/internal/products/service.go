package products

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

var ErrNotFound = errors.New("Mahsulot topilmadi")

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
	hub   pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, c *cache.Cache, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, cache: c, hub: hub}
}

func (s *Service) CatalogSummary(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	where, args := s.buildWhere(companyID, q)
	var productCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Product" p WHERE `+where, args...).Scan(&productCount); err != nil {
		return nil, err
	}
	variantWhere := `pv."companyId" = $1 AND pv.status <> 'ARCHIVED'`
	variantArgs := []any{companyID}
	if cat := strings.TrimSpace(q["categoryId"]); cat != "" {
		variantWhere += ` AND p."categoryId" = $2`
		variantArgs = append(variantArgs, cat)
	}
	var variantCount int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE `+variantWhere+` AND p.status <> 'ARCHIVED'
	`, variantArgs...).Scan(&variantCount)
	if err != nil {
		return nil, err
	}
	return map[string]any{"productCount": productCount, "variantCount": variantCount}, nil
}

func (s *Service) buildWhere(companyID string, q map[string]string) (string, []any) {
	parts := []string{`p."companyId" = $1`, `p.status <> 'ARCHIVED'`}
	args := []any{companyID}
	n := 2
	if st := strings.TrimSpace(q["status"]); st != "" {
		parts = append(parts, fmt.Sprintf(`p.status = $%d`, n))
		args = append(args, st)
		n++
	}
	if cat := strings.TrimSpace(q["categoryId"]); cat != "" {
		parts = append(parts, fmt.Sprintf(`p."categoryId" = $%d`, n))
		args = append(args, cat)
		n++
	}
	if search := strings.TrimSpace(q["search"]); search != "" {
		parts = append(parts, fmt.Sprintf(`(p.name ILIKE '%%' || $%d || '%%' OR EXISTS (
			SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p.id AND (pv.sku ILIKE '%%' || $%d || '%%' OR pv.barcode ILIKE '%%' || $%d || '%%')
		))`, n, n, n))
		args = append(args, search)
	}
	return strings.Join(parts, " AND "), args
}

func (s *Service) countActiveWarehouses(ctx context.Context, companyID string) (int, error) {
	key := cache.ActiveWarehouseCountKey(companyID)
	if s.cache != nil {
		var cached int
		if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
			return cached, nil
		}
	}
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "Warehouse"
		WHERE "companyId" = $1 AND status = 'ACTIVE'
	`, companyID).Scan(&count)
	if err != nil {
		return 0, err
	}
	if s.cache != nil {
		_ = s.cache.SetJSON(ctx, key, count, 2*time.Minute)
	}
	return count, nil
}

func (s *Service) effectiveWarehouseID(ctx context.Context, companyID, warehouseID string) string {
	warehouseID = strings.TrimSpace(warehouseID)
	if warehouseID == "" {
		return ""
	}
	if count, err := s.countActiveWarehouses(ctx, companyID); err == nil && count == 1 {
		return ""
	}
	return warehouseID
}

func (s *Service) bumpCatalogCaches(ctx context.Context, companyID string) {
	if s.cache == nil {
		return
	}
	s.cache.InvalidateProductsList(ctx, companyID)
	s.cache.InvalidateVariantsSearch(ctx, companyID)
}

func (s *Service) FindAll(ctx context.Context, companyID string, q map[string]string) (any, error) {
	where, args := s.buildWhere(companyID, q)
	warehouseID := s.effectiveWarehouseID(ctx, companyID, q["warehouseId"])
	limit, _ := strconv.Atoi(q["limit"])
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	page, _ := strconv.Atoi(q["page"])
	if page <= 0 {
		page = 1
	}
	skip := (page - 1) * limit

	search := strings.TrimSpace(q["search"])
	status := strings.TrimSpace(q["status"])
	categoryID := strings.TrimSpace(q["categoryId"])
	listKey := fmt.Sprintf("%s%s:%s:%s:%s:%d:%d", cache.ProductsListPrefix(companyID), warehouseID, search, status, categoryID, page, limit)
	if s.cache != nil {
		var cached map[string]any
		if ok, _ := s.cache.GetJSON(ctx, listKey, &cached); ok {
			return cached, nil
		}
	}

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Product" p WHERE `+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	sql := `
		SELECT p.id, p.name, p.unit, p.status, p."imageUrl", p."categoryId", p."createdAt", p."updatedAt"
		FROM "Product" p WHERE ` + where + ` ORDER BY p."updatedAt" DESC LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(skip)

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	productIDs := []string{}
	items := []map[string]any{}
	for rows.Next() {
		var id, name, unit, status string
		var image, categoryID *string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &unit, &status, &image, &categoryID, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		productIDs = append(productIDs, id)
		items = append(items, map[string]any{
			"id": id, "name": name, "unit": unit, "status": status,
			"imageUrl": image, "categoryId": categoryID,
			"createdAt": createdAt, "updatedAt": updatedAt, "variants": []map[string]any{},
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(productIDs) > 0 {
		if err := s.attachVariants(ctx, items, productIDs, companyID, warehouseID); err != nil {
			return nil, err
		}
	}
	result := map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}
	if s.cache != nil {
		_ = s.cache.SetJSON(ctx, listKey, result, 45*time.Second)
	}
	return result, nil
}

func (s *Service) attachVariants(ctx context.Context, items []map[string]any, productIDs []string, companyID, warehouseID string) error {
	rows, err := s.pool.Query(ctx, `
		SELECT pv.id, pv."productId", pv.name, pv.sku, pv.barcode, pv."salePrice", pv.currency, pv.status
		FROM "ProductVariant" pv
		WHERE pv."companyId" = $1 AND pv."productId" = ANY($2) AND pv.status <> 'ARCHIVED'
		ORDER BY pv."createdAt" ASC
	`, companyID, productIDs)
	if err != nil {
		return err
	}
	defer rows.Close()

	byProduct := map[string][]map[string]any{}
	variantIDs := []string{}
	for rows.Next() {
		var id, productID, name, currency, status string
		var sku, barcode *string
		var salePrice float64
		if err := rows.Scan(&id, &productID, &name, &sku, &barcode, &salePrice, &currency, &status); err != nil {
			return err
		}
		variantIDs = append(variantIDs, id)
		byProduct[productID] = append(byProduct[productID], map[string]any{
			"id": id, "name": name, "sku": sku, "barcode": barcode,
			"salePrice": salePrice, "currency": currency, "status": status,
		})
	}
	stockMap := map[string]float64{}
	if warehouseID != "" && len(variantIDs) > 0 {
		sbRows, err := s.pool.Query(ctx, `
			SELECT "productVariantId", quantity FROM "StockBalance"
			WHERE "warehouseId" = $1 AND "productVariantId" = ANY($2)
		`, warehouseID, variantIDs)
		if err == nil {
			for sbRows.Next() {
				var vid string
				var qty float64
				if err := sbRows.Scan(&vid, &qty); err == nil {
					stockMap[vid] = qty
				}
			}
			sbRows.Close()
		}
	}
	for i := range items {
		pid := items[i]["id"].(string)
		variants := byProduct[pid]
		if warehouseID != "" {
			for j := range variants {
				vid := variants[j]["id"].(string)
				qty := stockMap[vid]
				variants[j]["stockBalances"] = []map[string]any{
					{"warehouseId": warehouseID, "quantity": qty},
				}
			}
		}
		items[i]["variants"] = variants
	}
	return rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID, warehouseID string) (map[string]any, error) {
	var name, unit, status string
	var image, categoryID, description *string
	var createdAt, updatedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT name, unit, status, "imageUrl", "categoryId", description, "createdAt", "updatedAt"
		FROM "Product" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&name, &unit, &status, &image, &categoryID, &description, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	item := map[string]any{
		"id": id, "name": name, "unit": unit, "status": status,
		"imageUrl": image, "categoryId": categoryID, "description": description,
		"createdAt": createdAt, "updatedAt": updatedAt, "variants": []map[string]any{},
	}
	items := []map[string]any{item}
	if err := s.attachVariants(ctx, items, []string{id}, companyID, warehouseID); err != nil {
		return nil, err
	}
	return items[0], nil
}
