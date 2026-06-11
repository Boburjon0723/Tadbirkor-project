package variants

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

var (
	ErrNotFound         = errors.New("Variant topilmadi")
	ErrProductNotFound  = errors.New("Mahsulot topilmadi")
	ErrDuplicateSKU     = errors.New("Bunday SKU mavjud")
	ErrDuplicateBarcode = errors.New("Bunday Barcode mavjud")
	ErrNotActive        = errors.New("Faqat ACTIVE variant webga chiqarilishi mumkin")
	ErrUnauthorized     = errors.New("Storefront token noto'g'ri")
)

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

func (s *Service) bumpCatalogCaches(ctx context.Context, companyID string) {
	if s.cache == nil {
		return
	}
	s.cache.InvalidateProductsList(ctx, companyID)
	s.cache.InvalidateVariantsSearch(ctx, companyID)
}

func attrsJSON(attrs map[string]any) any {
	if len(attrs) == 0 {
		return nil
	}
	b, _ := json.Marshal(attrs)
	return b
}

func roundQty(n float64) float64 {
	return math.Max(0, math.Round(n*1000)/1000)
}

func (s *Service) FindAll(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pv.id, pv."productId", pv.name, pv.sku, pv.barcode, pv."salePrice", pv."purchasePrice",
		       pv.currency, pv.status, pv."createdAt", p.id, p.name
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv."companyId" = $1
		ORDER BY pv."createdAt" DESC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanVariantRows(rows, true)
}

func (s *Service) Search(ctx context.Context, companyID string, q map[string]string) ([]map[string]any, error) {
	query := strings.TrimSpace(q["query"])
	sku := strings.TrimSpace(q["sku"])
	barcode := strings.TrimSpace(q["barcode"])
	searchKey := fmt.Sprintf("%s%s:%s:%s", cache.VariantsSearchPrefix(companyID), query, sku, barcode)
	if s.cache != nil {
		var cached []map[string]any
		if ok, _ := s.cache.GetJSON(ctx, searchKey, &cached); ok {
			return cached, nil
		}
	}
	sql := `
		SELECT pv.id, pv."productId", pv.name, pv.sku, pv.barcode, pv."salePrice", pv."purchasePrice",
		       pv.currency, pv.status, pv."createdAt", p.id, p.name
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv."companyId" = $1
	`
	args := []any{companyID}
	n := 2
	if sku != "" {
		sql += fmt.Sprintf(` AND pv.sku = $%d`, n)
		args = append(args, sku)
		n++
	}
	if barcode != "" {
		sql += fmt.Sprintf(` AND pv.barcode = $%d`, n)
		args = append(args, barcode)
		n++
	}
	if query != "" {
		sql += fmt.Sprintf(` AND (pv.name ILIKE '%%' || $%d || '%%' OR p.name ILIKE '%%' || $%d || '%%' OR pv.sku ILIKE '%%' || $%d || '%%' OR pv.barcode ILIKE '%%' || $%d || '%%')`, n, n, n, n)
		args = append(args, query)
	}
	sql += ` ORDER BY pv."updatedAt" DESC LIMIT 50`
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := scanVariantRows(rows, true)
	if err != nil {
		return nil, err
	}
	if s.cache != nil {
		_ = s.cache.SetJSON(ctx, searchKey, out, 15*time.Second)
	}
	return out, nil
}

func scanVariantRows(rows pgx.Rows, withProduct bool) ([]map[string]any, error) {
	out := []map[string]any{}
	for rows.Next() {
		var id, productID, name, currency, status string
		var sku, barcode *string
		var salePrice, purchasePrice float64
		var createdAt time.Time
		var pID, pName string
		if withProduct {
			if err := rows.Scan(&id, &productID, &name, &sku, &barcode, &salePrice, &purchasePrice, &currency, &status, &createdAt, &pID, &pName); err != nil {
				return nil, err
			}
		}
		m := map[string]any{
			"id": id, "productId": productID, "name": name, "sku": sku, "barcode": barcode,
			"salePrice": salePrice, "purchasePrice": purchasePrice, "currency": currency,
			"status": status, "createdAt": createdAt,
			"product": map[string]any{"id": pID, "name": pName},
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	var productID, name, currency, status string
	var sku, barcode *string
	var salePrice, purchasePrice float64
	var createdAt, updatedAt time.Time
	var published *bool
	err := s.pool.QueryRow(ctx, `
		SELECT "productId", name, sku, barcode, "salePrice", "purchasePrice", currency, status, "createdAt", "updatedAt",
		       "isPublishedToWebsite"
		FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&productID, &name, &sku, &barcode, &salePrice, &purchasePrice, &currency, &status, &createdAt, &updatedAt, &published)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var pName, pStatus string
	_ = s.pool.QueryRow(ctx, `SELECT name, status FROM "Product" WHERE id = $1`, productID).Scan(&pName, &pStatus)

	balRows, err := s.pool.Query(ctx, `
		SELECT sb.id, sb."warehouseId", sb.quantity, sb."reservedQuantity", w.name
		FROM "StockBalance" sb
		JOIN "Warehouse" w ON w.id = sb."warehouseId"
		WHERE sb."productVariantId" = $1
	`, id)
	if err != nil {
		return nil, err
	}
	defer balRows.Close()
	balances := []map[string]any{}
	for balRows.Next() {
		var bid, whID, whName string
		var qty, reserved float64
		if err := balRows.Scan(&bid, &whID, &qty, &reserved, &whName); err != nil {
			return nil, err
		}
		balances = append(balances, map[string]any{
			"id": bid, "warehouseId": whID, "quantity": qty, "reservedQuantity": reserved,
			"warehouse": map[string]any{"id": whID, "name": whName},
		})
	}

	return map[string]any{
		"id": id, "productId": productID, "name": name, "sku": sku, "barcode": barcode,
		"salePrice": salePrice, "purchasePrice": purchasePrice, "currency": currency, "status": status,
		"createdAt": createdAt, "updatedAt": updatedAt, "isPublishedToWebsite": published,
		"product": map[string]any{"id": productID, "name": pName, "status": pStatus},
		"stockBalances": balances,
	}, nil
}

func (s *Service) assertUnique(ctx context.Context, tx pgx.Tx, companyID, sku, barcode, excludeID string) error {
	if sku = strings.TrimSpace(sku); sku != "" {
		var id string
		q := `SELECT id FROM "ProductVariant" WHERE "companyId" = $1 AND sku = $2`
		args := []any{companyID, sku}
		if excludeID != "" {
			q += ` AND id <> $3`
			args = append(args, excludeID)
		}
		if err := tx.QueryRow(ctx, q, args...).Scan(&id); err == nil {
			return ErrDuplicateSKU
		}
	}
	if barcode = strings.TrimSpace(barcode); barcode != "" {
		var id string
		q := `SELECT id FROM "ProductVariant" WHERE "companyId" = $1 AND barcode = $2`
		args := []any{companyID, barcode}
		if excludeID != "" {
			q += ` AND id <> $3`
			args = append(args, excludeID)
		}
		if err := tx.QueryRow(ctx, q, args...).Scan(&id); err == nil {
			return ErrDuplicateBarcode
		}
	}
	return nil
}

func (s *Service) Create(ctx context.Context, companyID, productID, userID string, in CreateInput) (map[string]any, error) {
	var pid string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "Product" WHERE id = $1 AND "companyId" = $2`, productID, companyID).Scan(&pid)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProductNotFound
	}
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	barcode := ""
	if in.Barcode != nil {
		barcode = *in.Barcode
	}
	sku := ""
	if in.SKU != nil {
		sku = *in.SKU
	}
	if err := s.assertUnique(ctx, tx, companyID, sku, barcode, ""); err != nil {
		return nil, err
	}

	currency := "UZS"
	if in.Currency != nil {
		currency = *in.Currency
	}
	purchase := 0.0
	if in.PurchasePrice != nil {
		purchase = *in.PurchasePrice
	}
	status := "ACTIVE"
	if in.Status != nil {
		status = *in.Status
	}

	var variantID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "ProductVariant"
		(id, "companyId", "productId", name, sku, barcode, "salePrice", "purchasePrice", currency, "attributesJson", status, "createdBy", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id
	`, companyID, productID, in.Name, nullStr(sku), nullStr(barcode), in.SalePrice, purchase, currency, attrsJSON(in.Attributes), status, userID).Scan(&variantID)
	if err != nil {
		return nil, err
	}

	initial := 0.0
	if in.InitialStock != nil {
		initial = roundQty(*in.InitialStock)
	}
	whID := ""
	if in.WarehouseID != nil {
		whID = strings.TrimSpace(*in.WarehouseID)
	}
	if whID == "" && initial > 0 {
		_ = tx.QueryRow(ctx, `SELECT id FROM "Warehouse" WHERE "companyId" = $1 AND status = 'ACTIVE' LIMIT 1`, companyID).Scan(&whID)
	}
	if whID != "" && initial > 0 {
		_, _ = tx.Exec(ctx, `
			INSERT INTO "StockBalance" (id, "companyId", "warehouseId", "productVariantId", quantity, "reservedQuantity", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW())
		`, companyID, whID, variantID, initial)
		_, _ = stock.RecordOneInTx(ctx, tx, companyID, userID, stock.Line{
			WarehouseID: whID, ProductVariantID: variantID, Quantity: initial, Note: "INITIAL_STOCK",
		}, "PRODUCT_INITIAL")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.bumpCatalogCaches(ctx, companyID)
	return s.FindOne(ctx, variantID, companyID)
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}

func (s *Service) Update(ctx context.Context, id, companyID, _ string, in UpdateInput) (map[string]any, error) {
	current, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	barcode := ""
	if in.Barcode != nil {
		barcode = *in.Barcode
	} else if current["barcode"] != nil {
		barcode = fmt.Sprint(current["barcode"])
	}
	sku := ""
	if in.SKU != nil {
		sku = *in.SKU
	} else if current["sku"] != nil {
		sku = fmt.Sprint(current["sku"])
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := s.assertUnique(ctx, tx, companyID, sku, barcode, id); err != nil {
		return nil, err
	}

	name := current["name"].(string)
	if in.Name != nil {
		name = *in.Name
	}
	salePrice := current["salePrice"].(float64)
	if in.SalePrice != nil {
		salePrice = *in.SalePrice
	}
	purchase := current["purchasePrice"].(float64)
	if in.PurchasePrice != nil {
		purchase = *in.PurchasePrice
	}
	currency := current["currency"].(string)
	if in.Currency != nil {
		currency = *in.Currency
	}
	status := current["status"].(string)
	if in.Status != nil {
		status = *in.Status
	}

	_, err = tx.Exec(ctx, `
		UPDATE "ProductVariant" SET name = $1, sku = $2, barcode = $3, "salePrice" = $4, "purchasePrice" = $5,
		       currency = $6, "attributesJson" = COALESCE($7, "attributesJson"), status = $8, "updatedAt" = NOW()
		WHERE id = $9 AND "companyId" = $10
	`, name, nullStr(sku), nullStr(barcode), salePrice, purchase, currency, attrsJSON(in.Attributes), status, id, companyID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.bumpCatalogCaches(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) UpdatePrice(ctx context.Context, id, companyID, _ string, in UpdatePriceInput) (map[string]any, error) {
	current, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	purchase := current["purchasePrice"].(float64)
	if in.PurchasePrice != nil {
		purchase = *in.PurchasePrice
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE "ProductVariant" SET "salePrice" = $1, "purchasePrice" = $2, "updatedAt" = NOW()
		WHERE id = $3 AND "companyId" = $4
	`, in.SalePrice, purchase, id, companyID)
	if err != nil {
		return nil, err
	}
	s.bumpCatalogCaches(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Publish(ctx context.Context, id, companyID string, in PublishInput) (map[string]any, error) {
	v, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if v["status"] != "ACTIVE" {
		return nil, ErrNotActive
	}
	if prod, ok := v["product"].(map[string]any); ok && prod["status"] != "ACTIVE" {
		return nil, errors.New("Mahsulot nofaol, avval mahsulotni faollashtiring")
	}
	var publishedAt any = nil
	if in.IsPublishedToWebsite {
		publishedAt = time.Now()
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE "ProductVariant" SET "isPublishedToWebsite" = $1, "publishedAt" = $2, "updatedAt" = NOW()
		WHERE id = $3
	`, in.IsPublishedToWebsite, publishedAt, id)
	if err != nil {
		return nil, err
	}
	s.bumpCatalogCaches(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Remove(ctx context.Context, id, companyID, _ string) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	var movCount int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "StockMovement" WHERE "productVariantId" = $1`, id).Scan(&movCount)
	if movCount > 0 {
		_, err := s.pool.Exec(ctx, `UPDATE "ProductVariant" SET status = 'ARCHIVED', "updatedAt" = NOW() WHERE id = $1`, id)
		if err != nil {
			return nil, err
		}
		s.bumpCatalogCaches(ctx, companyID)
		return s.FindOne(ctx, id, companyID)
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2`, id, companyID)
	if err != nil {
		return nil, err
	}
	s.bumpCatalogCaches(ctx, companyID)
	return map[string]any{"id": id, "deleted": true}, nil
}

func (s *Service) GetWebsiteCatalog(ctx context.Context, companyID, storefrontToken, search string) ([]map[string]any, error) {
	var dbToken *string
	err := s.pool.QueryRow(ctx, `SELECT "storefrontToken" FROM "Company" WHERE id = $1`, companyID).Scan(&dbToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if dbToken == nil || *dbToken == "" {
		return nil, errForbiddenStorefront("Storefront ochilmagan")
	}
	if *dbToken != storefrontToken {
		return nil, ErrUnauthorized
	}

	q := `
		SELECT pv.id, pv."productId", p.name, p.description, pv.name, pv.sku, pv.barcode,
		       pv."salePrice"::float8, pv.currency, p.unit,
		       COALESCE(SUM(sb.quantity), 0)::float8,
		       COALESCE(SUM(sb."reservedQuantity"), 0)::float8
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "StockBalance" sb ON sb."productVariantId" = pv.id
		WHERE pv."companyId" = $1
		  AND pv.status = 'ACTIVE'
		  AND pv."isPublishedToWebsite" = true
		  AND p.status = 'ACTIVE'
	`
	args := []any{companyID}
	if strings.TrimSpace(search) != "" {
		q += ` AND p.name ILIKE $2`
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}
	q += `
		GROUP BY pv.id, p.id
		ORDER BY pv."updatedAt" DESC
	`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, productID, productName string
		var description, variantName, sku, barcode, unit *string
		var salePrice, totalStock, totalReserved float64
		var currency string
		if err := rows.Scan(&id, &productID, &productName, &description, &variantName, &sku, &barcode,
			&salePrice, &currency, &unit, &totalStock, &totalReserved); err != nil {
			return nil, err
		}
		available := totalStock - totalReserved
		if available < 0 {
			available = 0
		}
		out = append(out, map[string]any{
			"id":                 id,
			"productId":          productID,
			"productName":        productName,
			"productDescription": description,
			"variantName":        variantName,
			"sku":                sku,
			"barcode":            barcode,
			"salePrice":          salePrice,
			"currency":           currency,
			"unit":               unit,
			"stockAvailable":     roundQty(available),
		})
	}
	return out, rows.Err()
}

type storefrontError struct{ msg string }

func (e storefrontError) Error() string { return e.msg }

func errForbiddenStorefront(msg string) error { return storefrontError{msg: msg} }
