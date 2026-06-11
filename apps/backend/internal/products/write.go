package products

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

var (
	ErrBadInput       = errors.New("Noto'g'ri ma'lumot")
	ErrCategoryNF     = errors.New("Kategoriya topilmadi")
	ErrDuplicateSKU   = errors.New("Bunday SKU mavjud")
	ErrDuplicateBarcode = errors.New("Bunday Barcode mavjud")
	ErrNoWarehouse    = errors.New("Faol ombor topilmadi")
)

func roundQty(n float64) float64 {
	return math.Max(0, math.Round(n*1000)/1000)
}

func (s *Service) ensureActiveWarehouse(ctx context.Context, companyID string) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM "Warehouse" WHERE "companyId" = $1 AND status = 'ACTIVE' LIMIT 1
	`, companyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNoWarehouse
	}
	return err
}

func (s *Service) assertCategory(ctx context.Context, tx pgx.Tx, companyID, categoryID string) error {
	var id string
	err := tx.QueryRow(ctx, `SELECT id FROM "ProductCategory" WHERE id = $1 AND "companyId" = $2`, categoryID, companyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrCategoryNF
	}
	return err
}

func (s *Service) assertBarcodeFree(ctx context.Context, tx pgx.Tx, companyID, barcode, excludeID string) error {
	barcode = strings.TrimSpace(barcode)
	if barcode == "" {
		return nil
	}
	var id string
	q := `SELECT id FROM "ProductVariant" WHERE "companyId" = $1 AND barcode = $2`
	args := []any{companyID, barcode}
	if excludeID != "" {
		q += ` AND id <> $3`
		args = append(args, excludeID)
	}
	err := tx.QueryRow(ctx, q, args...).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err == nil {
		return ErrDuplicateBarcode
	}
	return err
}

func (s *Service) assertSKUFree(ctx context.Context, tx pgx.Tx, companyID, sku, excludeID string) error {
	sku = strings.TrimSpace(sku)
	if sku == "" {
		return nil
	}
	var id string
	q := `SELECT id FROM "ProductVariant" WHERE "companyId" = $1 AND sku = $2`
	args := []any{companyID, sku}
	if excludeID != "" {
		q += ` AND id <> $3`
		args = append(args, excludeID)
	}
	err := tx.QueryRow(ctx, q, args...).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err == nil {
		return ErrDuplicateSKU
	}
	return err
}

func attrsJSON(attrs map[string]any) any {
	if len(attrs) == 0 {
		return nil
	}
	b, _ := json.Marshal(attrs)
	return b
}

func (s *Service) createVariantWithStock(
	ctx context.Context, tx pgx.Tx, companyID, userID, productID, unit string,
	v VariantInput, index int, canonicalSKU string,
) error {
	barcode := ""
	if v.Barcode != nil {
		barcode = strings.TrimSpace(*v.Barcode)
	}
	if err := s.assertBarcodeFree(ctx, tx, companyID, barcode, ""); err != nil {
		return err
	}
	sku := (*string)(nil)
	if index == 0 && canonicalSKU != "" {
		sku = &canonicalSKU
		if err := s.assertSKUFree(ctx, tx, companyID, canonicalSKU, ""); err != nil {
			return err
		}
	}
	if v.SKU != nil && strings.TrimSpace(*v.SKU) != "" && index == 0 {
		skuVal := strings.TrimSpace(*v.SKU)
		sku = &skuVal
		if err := s.assertSKUFree(ctx, tx, companyID, skuVal, ""); err != nil {
			return err
		}
	}
	currency := "UZS"
	if v.Currency != nil && *v.Currency != "" {
		currency = *v.Currency
	}
	purchase := 0.0
	if v.PurchasePrice != nil {
		purchase = *v.PurchasePrice
	}
	var variantID string
	err := tx.QueryRow(ctx, `
		INSERT INTO "ProductVariant"
		(id, "companyId", "productId", name, sku, barcode, "salePrice", "purchasePrice", currency, "attributesJson", status, "createdBy", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, NOW(), NOW())
		RETURNING id
	`, companyID, productID, v.Name, sku, nullIfEmpty(barcode), v.SalePrice, purchase, currency, attrsJSON(v.Attributes), userID).Scan(&variantID)
	if err != nil {
		return err
	}

	initial := 0.0
	if v.InitialStock != nil {
		initial = roundQty(*v.InitialStock)
	}
	whID := ""
	if v.WarehouseID != nil {
		whID = strings.TrimSpace(*v.WarehouseID)
	}
	if whID == "" || initial <= 0 {
		return nil
	}
	var wh string
	err = tx.QueryRow(ctx, `SELECT id FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'`, whID, companyID).Scan(&wh)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("Tanlangan ombor topilmadi yoki nofaol")
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "StockBalance" (id, "companyId", "warehouseId", "productVariantId", quantity, "reservedQuantity", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW())
	`, companyID, whID, variantID, initial)
	if err != nil {
		return err
	}
	_, err = stock.RecordOneInTx(ctx, tx, companyID, userID, stock.Line{
		WarehouseID: whID, ProductVariantID: variantID, Quantity: initial, Note: "INITIAL_STOCK",
	}, "PRODUCT_INITIAL")
	return err
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// updateExistingVariantTx — yuborilmagan maydonlarni (nil) bazadagi qiymatda qoldiradi.
func (s *Service) updateExistingVariantTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, productID string,
	v VariantInput,
	index int,
	canonicalSKU string,
) error {
	vid := strings.TrimSpace(*v.ID)
	var oldSale float64
	var oldPurchase *float64
	if err := tx.QueryRow(ctx, `
		SELECT "salePrice", "purchasePrice" FROM "ProductVariant"
		WHERE id = $1 AND "companyId" = $2 AND "productId" = $3
	`, vid, companyID, productID).Scan(&oldSale, &oldPurchase); err != nil {
		return err
	}
	sets := []string{`name = $1`, `"updatedAt" = NOW()`}
	args := []any{v.Name}
	n := 2

	if index == 0 {
		if canonicalSKU != "" {
			if err := s.assertSKUFree(ctx, tx, companyID, canonicalSKU, vid); err != nil {
				return err
			}
			sets = append(sets, fmt.Sprintf(`sku = $%d`, n))
			args = append(args, canonicalSKU)
			n++
		} else if v.SKU != nil {
			skuVal := strings.TrimSpace(*v.SKU)
			if skuVal != "" {
				if err := s.assertSKUFree(ctx, tx, companyID, skuVal, vid); err != nil {
					return err
				}
			}
			sets = append(sets, fmt.Sprintf(`sku = $%d`, n))
			args = append(args, nullIfEmpty(skuVal))
			n++
		}
	}

	if v.Barcode != nil {
		barcode := strings.TrimSpace(*v.Barcode)
		if err := s.assertBarcodeFree(ctx, tx, companyID, barcode, vid); err != nil {
			return err
		}
		sets = append(sets, fmt.Sprintf(`barcode = $%d`, n))
		args = append(args, nullIfEmpty(barcode))
		n++
	}

	sets = append(sets, fmt.Sprintf(`"salePrice" = $%d`, n))
	args = append(args, v.SalePrice)
	n++

	if v.PurchasePrice != nil {
		sets = append(sets, fmt.Sprintf(`"purchasePrice" = $%d`, n))
		args = append(args, *v.PurchasePrice)
		n++
	}

	if v.Currency != nil && strings.TrimSpace(*v.Currency) != "" {
		sets = append(sets, fmt.Sprintf(`currency = $%d`, n))
		args = append(args, strings.TrimSpace(*v.Currency))
		n++
	}

	if v.Attributes != nil {
		sets = append(sets, fmt.Sprintf(`"attributesJson" = $%d`, n))
		args = append(args, attrsJSON(v.Attributes))
		n++
	}

	status := "ACTIVE"
	if v.Status != nil && strings.TrimSpace(*v.Status) != "" {
		status = strings.TrimSpace(*v.Status)
	}
	sets = append(sets, fmt.Sprintf(`status = $%d`, n))
	args = append(args, status)
	n++

	args = append(args, vid, companyID, productID)
	sql := fmt.Sprintf(
		`UPDATE "ProductVariant" SET %s WHERE id = $%d AND "companyId" = $%d AND "productId" = $%d`,
		strings.Join(sets, ", "),
		n,
		n+1,
		n+2,
	)
	_, err := tx.Exec(ctx, sql, args...)
	if err != nil {
		return err
	}

	saleChanged := v.SalePrice != oldSale
	purchaseChanged := v.PurchasePrice != nil && ((oldPurchase == nil && *v.PurchasePrice != 0) || (oldPurchase != nil && *v.PurchasePrice != *oldPurchase))
	if saleChanged || purchaseChanged {
		newData := map[string]any{
			"productId":        productID,
			"productVariantId": vid,
			"variantName":      v.Name,
		}
		oldData := map[string]any{"salePrice": oldSale}
		newData["salePrice"] = v.SalePrice
		if oldPurchase != nil {
			oldData["purchasePrice"] = *oldPurchase
		}
		if v.PurchasePrice != nil {
			newData["purchasePrice"] = *v.PurchasePrice
		} else if oldPurchase != nil {
			newData["purchasePrice"] = *oldPurchase
		}
		auditNew, _ := json.Marshal(newData)
		auditOld, _ := json.Marshal(oldData)
		_, err = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "oldData", "createdAt")
			VALUES (gen_random_uuid()::text, $1, $2, 'product.price_updated', 'PRODUCT_VARIANT', $3, $4, $5, NOW())
		`, companyID, userID, vid, string(auditNew), string(auditOld))
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) Create(ctx context.Context, companyID, userID string, in CreateInput) (map[string]any, error) {
	if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.CategoryID) == "" || strings.TrimSpace(in.Unit) == "" {
		return nil, ErrBadInput
	}
	if in.Type == "" {
		in.Type = "GOODS"
	}
	if err := s.ensureActiveWarehouse(ctx, companyID); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := s.assertCategory(ctx, tx, companyID, in.CategoryID); err != nil {
		return nil, err
	}

	var productID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "Product" (id, "companyId", name, "categoryId", description, "imageUrl", unit, type, status, "createdBy", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, NOW(), NOW())
		RETURNING id
	`, companyID, in.Name, in.CategoryID, in.Description, in.ImageURL, in.Unit, in.Type, userID).Scan(&productID)
	if err != nil {
		return nil, err
	}

	canonicalSKU := ""
	if len(in.Variants) > 0 && in.Variants[0].SKU != nil {
		canonicalSKU = strings.TrimSpace(*in.Variants[0].SKU)
	}

	if len(in.Variants) > 0 {
		for i, v := range in.Variants {
			if err := s.createVariantWithStock(ctx, tx, companyID, userID, productID, in.Unit, v, i, canonicalSKU); err != nil {
				return nil, err
			}
		}
	} else {
		_, err = tx.Exec(ctx, `
			INSERT INTO "ProductVariant" (id, "companyId", "productId", name, "salePrice", status, "createdBy", "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, 0, 'ACTIVE', $4, NOW(), NOW())
		`, companyID, productID, fmt.Sprintf("Default / %s", in.Name), userID)
		if err != nil {
			return nil, err
		}
	}

	_, _ = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'product.created', 'PRODUCT', $3,
		        jsonb_build_object('name', $4, 'categoryId', $5, 'type', $6, 'unit', $7), NOW())
	`, companyID, userID, productID, in.Name, in.CategoryID, in.Type, in.Unit)

	initialWarehouse := ""
	for _, v := range in.Variants {
		if v.InitialStock != nil && *v.InitialStock > 0 {
			if v.WarehouseID != nil && strings.TrimSpace(*v.WarehouseID) != "" {
				initialWarehouse = strings.TrimSpace(*v.WarehouseID)
				break
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if initialWarehouse != "" {
		pkgrealtime.NotifyInventory(ctx, s.hub, s.cache, companyID, map[string]any{
			"productId":   productID,
			"warehouseId": initialWarehouse,
			"reason":      "product.created",
		})
	} else {
		s.bumpCatalogCaches(ctx, companyID)
	}
	return s.FindOne(ctx, productID, companyID, initialWarehouse)
}

func (s *Service) Update(ctx context.Context, id, companyID, userID string, in UpdateInput) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID, ""); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if in.CategoryID != nil {
		if err := s.assertCategory(ctx, tx, companyID, *in.CategoryID); err != nil {
			return nil, err
		}
	}

	sets := []string{`"updatedAt" = NOW()`}
	args := []any{}
	n := 1
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf(`%s = $%d`, col, n))
		args = append(args, val)
		n++
	}
	if in.Name != nil {
		add("name", *in.Name)
	}
	if in.CategoryID != nil {
		add(`"categoryId"`, *in.CategoryID)
	}
	if in.Description != nil {
		add("description", *in.Description)
	}
	if in.ImageURL != nil {
		add(`"imageUrl"`, *in.ImageURL)
	}
	if in.Unit != nil {
		add("unit", *in.Unit)
	}
	if in.Type != nil {
		add("type", *in.Type)
	}
	if in.Status != nil {
		add("status", *in.Status)
	}
	args = append(args, id, companyID)
	_, err = tx.Exec(ctx, fmt.Sprintf(`UPDATE "Product" SET %s WHERE id = $%d AND "companyId" = $%d`, strings.Join(sets, ", "), n, n+1), args...)
	if err != nil {
		return nil, err
	}

	if len(in.Variants) > 0 {
		unit := "dona"
		if in.Unit != nil {
			unit = *in.Unit
		}
		canonicalSKU := ""
		if in.Variants[0].SKU != nil {
			canonicalSKU = strings.TrimSpace(*in.Variants[0].SKU)
		}
		for i, v := range in.Variants {
			if v.ID != nil && strings.TrimSpace(*v.ID) != "" {
				if err := s.updateExistingVariantTx(ctx, tx, companyID, userID, id, v, i, canonicalSKU); err != nil {
					return nil, err
				}
				continue
			}
			if err := s.createVariantWithStock(ctx, tx, companyID, userID, id, unit, v, i, canonicalSKU); err != nil {
				return nil, err
			}
		}
	}

	for _, variantID := range in.RemovedVariantIDs {
		if err := s.removeVariantOnUpdate(ctx, tx, companyID, userID, id, variantID); err != nil {
			return nil, err
		}
	}

	if len(in.StockAdjustments) > 0 {
		if err := s.applyStockAdjustmentsInTx(ctx, tx, companyID, userID, id, in.StockAdjustments); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if len(in.StockAdjustments) > 0 {
		primaryWarehouse := strings.TrimSpace(in.StockAdjustments[0].WarehouseID)
		payload := map[string]any{"productId": id, "reason": "product.updated"}
		if primaryWarehouse != "" {
			payload["warehouseId"] = primaryWarehouse
		}
		pkgrealtime.NotifyInventory(ctx, s.hub, s.cache, companyID, payload)
	} else {
		s.bumpCatalogCaches(ctx, companyID)
	}

	warehouseID := ""
	if len(in.StockAdjustments) > 0 {
		warehouseID = strings.TrimSpace(in.StockAdjustments[0].WarehouseID)
	}
	return s.FindOne(ctx, id, companyID, warehouseID)
}

func (s *Service) Remove(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	product, err := s.FindOne(ctx, id, companyID, "")
	if err != nil {
		return nil, err
	}
	variantIDs := []string{}
	if vars, ok := product["variants"].([]map[string]any); ok {
		for _, v := range vars {
			if vid, ok := v["id"].(string); ok {
				variantIDs = append(variantIDs, vid)
			}
		}
	}
	if len(variantIDs) == 0 {
		return nil, ErrNotFound
	}

	var deps int
	_ = s.pool.QueryRow(ctx, `
		SELECT (
			(SELECT COUNT(*)::int FROM "StockMovement" WHERE "productVariantId" = ANY($1)) +
			(SELECT COUNT(*)::int FROM "StockBalance" WHERE "productVariantId" = ANY($1) AND quantity > 0) +
			(SELECT COUNT(*)::int FROM "B2BOrderItem" WHERE "productVariantId" = ANY($1)) +
			(SELECT COUNT(*)::int FROM "DispatchItem" WHERE "productVariantId" = ANY($1))
		)
	`, variantIDs).Scan(&deps)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if deps > 0 {
		_, err = tx.Exec(ctx, `UPDATE "ProductVariant" SET status = 'ARCHIVED', "updatedAt" = NOW() WHERE "productId" = $1`, id)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx, `UPDATE "Product" SET status = 'ARCHIVED', "updatedAt" = NOW() WHERE id = $1`, id)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		archived, _ := s.FindOne(ctx, id, companyID, "")
		return map[string]any{
			"action":  "archived",
			"message": "Mahsulotda ombor/qoldiq yoki buyurtma tarixi bor — arxivlandi.",
			"product": archived,
		}, nil
	}

	_, err = tx.Exec(ctx, `DELETE FROM "ProductVariant" WHERE "productId" = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `DELETE FROM "Product" WHERE id = $1 AND "companyId" = $2`, id, companyID)
	if err != nil {
		return nil, err
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'product.deleted', 'PRODUCT', $3, NOW())
	`, companyID, userID, id)
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"action": "deleted", "success": true}, nil
}
