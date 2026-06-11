package pos

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
	"github.com/tadbirkor/axis-erp/backend/pkg/tashkent"
)

var (
	ErrNotFound     = errors.New("Sotuv topilmadi")
	ErrBadWarehouse = errors.New("warehouseId majburiy")
	ErrForbiddenWH  = errors.New("Bu ombor sizga biriktirilmagan")
)

type Service struct {
	pool       *pgxpool.Pool
	cache      *cache.Cache
	hub        pkgrealtime.Hub
	catalogTTL time.Duration
}

func NewService(pool *pgxpool.Pool, c *cache.Cache, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	ttlMs, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("POS_CATALOG_CACHE_TTL_MS")))
	if ttlMs <= 0 {
		ttlMs = 30_000
	}
	return &Service{pool: pool, cache: c, hub: hub, catalogTTL: time.Duration(ttlMs) * time.Millisecond}
}

func (s *Service) assertWarehouseScope(ctx context.Context, companyID, userID, warehouseID string) error {
	whScope, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return err
	}
	if !whScope.Allowed(warehouseID) {
		return ErrForbiddenWH
	}
	return nil
}

func (s *Service) FindAll(ctx context.Context, companyID string, q map[string]string) ([]map[string]any, error) {
	sql := `
		SELECT ps.id, ps."saleNumber", ps.status, ps."totalAmount", ps.currency, ps."createdAt",
		       w.id, w.name, u.id, u."fullName",
		       (SELECT COUNT(*)::int FROM "PosSaleItem" i WHERE i."saleId" = ps.id)
		FROM "PosSale" ps
		JOIN "Warehouse" w ON w.id = ps."warehouseId"
		JOIN "User" u ON u.id = ps."cashierId"
		WHERE ps."companyId" = $1
	`
	args := []any{companyID}
	n := 2
	if st := strings.TrimSpace(q["status"]); st != "" {
		sql += fmt.Sprintf(` AND ps.status = $%d`, n)
		args = append(args, st)
		n++
	}
	if wh := strings.TrimSpace(q["warehouseId"]); wh != "" {
		sql += fmt.Sprintf(` AND ps."warehouseId" = $%d`, n)
		args = append(args, wh)
		n++
	}
	sql += ` ORDER BY ps."createdAt" DESC LIMIT 200`
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, saleNumber, status, currency string
		var total float64
		var createdAt time.Time
		var wID, wName, uID, uName string
		var itemCount int
		if err := rows.Scan(&id, &saleNumber, &status, &total, &currency, &createdAt, &wID, &wName, &uID, &uName, &itemCount); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "saleNumber": saleNumber, "status": status, "totalAmount": total,
			"currency": currency, "createdAt": createdAt,
			"warehouse": map[string]any{"id": wID, "name": wName},
			"cashier":   map[string]any{"id": uID, "fullName": uName},
			"_count":    map[string]any{"items": itemCount},
		})
	}
	return out, rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, "saleNumber", status, subtotal, "discountAmount", "totalAmount", currency,
		       "warehouseId", "cashierId", "completedAt", "createdAt"
		FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID)
	var saleID, saleNumber, status, currency string
	var subtotal, discount, total float64
	var warehouseID, cashierID string
	var completedAt *time.Time
	var createdAt time.Time
	if err := row.Scan(&saleID, &saleNumber, &status, &subtotal, &discount, &total, &currency, &warehouseID, &cashierID, &completedAt, &createdAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return map[string]any{
		"id": saleID, "saleNumber": saleNumber, "status": status,
		"subtotal": subtotal, "discountAmount": discount, "totalAmount": total,
		"currency": currency, "warehouseId": warehouseID, "cashierId": cashierID,
		"completedAt": completedAt, "createdAt": createdAt,
	}, nil
}

func (s *Service) QuickSearch(ctx context.Context, companyID, userID, query, warehouseID string) ([]map[string]any, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return []map[string]any{}, nil
	}
	if warehouseID != "" {
		if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
			return nil, err
		}
	}
	rows, err := s.pool.Query(ctx, `
		SELECT pv.id, pv."productId", p.name, pv.name, pv.sku, pv.barcode, pv."salePrice", pv.currency, p.unit
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv."companyId" = $1 AND pv.status = 'ACTIVE' AND p.status <> 'ARCHIVED'
		  AND (pv.barcode = $2 OR LOWER(pv.sku) = LOWER($2) OR pv.name ILIKE '%' || $2 || '%' OR p.name ILIKE '%' || $2 || '%')
		ORDER BY pv."updatedAt" DESC LIMIT 25
	`, companyID, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return s.mapVariantsWithStock(ctx, rows, warehouseID)
}

func (s *Service) GetCatalog(ctx context.Context, companyID, userID string, q map[string]string) (map[string]any, error) {
	warehouseID := strings.TrimSpace(q["warehouseId"])
	if warehouseID == "" {
		return nil, ErrBadWarehouse
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	search := strings.TrimSpace(q["search"])
	limit, _ := strconv.Atoi(q["limit"])
	if limit <= 0 {
		limit = 80
	}
	if limit > 200 {
		limit = 200
	}
	page, _ := strconv.Atoi(q["page"])
	if page <= 0 {
		page = 1
	}
	skip := (page - 1) * limit
	cacheKey := cache.PosCatalogPrefix(companyID, warehouseID) + fmt.Sprintf("%s:%d:%d", search, page, limit)
	var cached map[string]any
	if ok, _ := s.cache.GetJSON(ctx, cacheKey, &cached); ok {
		return cached, nil
	}
	countSQL := `
		SELECT COUNT(*)::int FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		JOIN "StockBalance" sb ON sb."productVariantId" = pv.id AND sb."warehouseId" = $2
		WHERE pv."companyId" = $1 AND pv.status = 'ACTIVE' AND p.status <> 'ARCHIVED' AND sb.quantity > 0
	`
	listSQL := `
		SELECT pv.id, pv."productId", p.name, pv.name, pv.sku, pv.barcode, pv."salePrice", pv.currency, p.unit, p."imageUrl", p."categoryId", c.name, sb.quantity
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "ProductCategory" c ON c.id = p."categoryId"
		JOIN "StockBalance" sb ON sb."productVariantId" = pv.id AND sb."warehouseId" = $2
		WHERE pv."companyId" = $1 AND pv.status = 'ACTIVE' AND p.status <> 'ARCHIVED' AND sb.quantity > 0
	`
	args := []any{companyID, warehouseID}
	if search != "" {
		filter := ` AND (pv.barcode ILIKE '%' || $3 || '%' OR pv.sku ILIKE '%' || $3 || '%' OR pv.name ILIKE '%' || $3 || '%' OR p.name ILIKE '%' || $3 || '%')`
		countSQL += filter
		listSQL += filter
		args = append(args, search)
	}
	var total int
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, err
	}
	listSQL += ` ORDER BY pv."updatedAt" DESC LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(skip)
	rows, err := s.pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, productID, productName, variantName string
		var sku, barcode, currency, unit, image, categoryID, categoryName *string
		var salePrice, qty float64
		if err := rows.Scan(&id, &productID, &productName, &variantName, &sku, &barcode, &salePrice, &currency, &unit, &image, &categoryID, &categoryName, &qty); err != nil {
			return nil, err
		}
		u := "dona"
		if unit != nil && *unit != "" {
			u = *unit
		}
		items = append(items, map[string]any{
			"id": id, "productId": productID, "productName": productName, "name": variantName,
			"sku": sku, "barcode": barcode, "salePrice": salePrice, "currency": currency, "unit": u,
			"image": image, "categoryId": categoryID, "categoryName": categoryName, "quantity": qty,
		})
	}
	result := map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}
	_ = s.cache.SetJSON(ctx, cacheKey, result, s.catalogTTL)
	return result, nil
}

func (s *Service) SummaryToday(ctx context.Context, companyID, cashierID string) (map[string]any, error) {
	dr := tashkent.DayRangeNow()
	args := []any{companyID, dr.Start, dr.End}
	cashierFilter := ""
	if cashierID != "" {
		cashierFilter = ` AND "cashierId" = $4`
		args = append(args, cashierID)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT status, currency, COALESCE(SUM("totalAmount"),0)::float8, COALESCE(SUM("discountAmount"),0)::float8, COUNT(*)::int
		FROM "PosSale"
		WHERE "companyId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3`+cashierFilter+`
		GROUP BY status, currency
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	completedTotal := map[string]float64{}
	completedDiscount := map[string]float64{}
	completedCount := 0
	voidedTotal := map[string]float64{}
	voidedCount := 0
	draftCount := 0
	for rows.Next() {
		var status, currency string
		var total, discount float64
		var cnt int
		if err := rows.Scan(&status, &currency, &total, &discount, &cnt); err != nil {
			return nil, err
		}
		if currency == "" {
			currency = "UZS"
		}
		switch status {
		case "COMPLETED":
			completedTotal[currency] += total
			completedDiscount[currency] += discount
			completedCount += cnt
		case "VOIDED":
			voidedTotal[currency] += total
			voidedCount += cnt
		case "DRAFT":
			draftCount += cnt
		}
	}
	return map[string]any{
		"date": dr.DateLabel, "timezone": "Asia/Tashkent",
		"completed": map[string]any{
			"count": completedCount, "totalByCurrency": completedTotal, "discountByCurrency": completedDiscount,
		},
		"voided": map[string]any{"count": voidedCount, "totalByCurrency": voidedTotal},
		"draft":  map[string]any{"count": draftCount},
	}, nil
}

func (s *Service) mapVariantsWithStock(ctx context.Context, rows pgx.Rows, warehouseID string) ([]map[string]any, error) {
	out := []map[string]any{}
	ids := []string{}
	type rowData struct {
		m map[string]any
		id string
	}
	buffer := []rowData{}
	for rows.Next() {
		var id, productID, productName, variantName string
		var sku, barcode, currency, unit *string
		var salePrice float64
		if err := rows.Scan(&id, &productID, &productName, &variantName, &sku, &barcode, &salePrice, &currency, &unit); err != nil {
			return nil, err
		}
		u := "dona"
		if unit != nil && *unit != "" {
			u = *unit
		}
		m := map[string]any{
			"id": id, "productId": productID, "productName": productName, "name": variantName,
			"sku": sku, "barcode": barcode, "salePrice": salePrice, "currency": currency, "unit": u,
		}
		buffer = append(buffer, rowData{m: m, id: id})
		ids = append(ids, id)
	}
	stock := map[string]float64{}
	if warehouseID != "" && len(ids) > 0 {
		sbRows, err := s.pool.Query(ctx, `SELECT "productVariantId", quantity FROM "StockBalance" WHERE "warehouseId" = $1 AND "productVariantId" = ANY($2)`, warehouseID, ids)
		if err == nil {
			for sbRows.Next() {
				var vid string
				var qty float64
				if err := sbRows.Scan(&vid, &qty); err == nil {
					stock[vid] = qty
				}
			}
			sbRows.Close()
		}
	}
	for _, item := range buffer {
		if warehouseID != "" {
			item.m["stock"] = stock[item.id]
		} else {
			item.m["stock"] = nil
		}
		out = append(out, item.m)
	}
	return out, rows.Err()
}
