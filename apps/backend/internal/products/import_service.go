package products

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

func (s *Service) ImportPreview(ctx context.Context, companyID string, file []byte, warehouseID, importMode string) (map[string]any, error) {
	if err := s.ensureActiveWarehouse(ctx, companyID); err != nil {
		return nil, err
	}
	parsed, err := parseImportExcelFile(file)
	if err != nil {
		return nil, err
	}
	return s.buildImportPreview(ctx, companyID, warehouseID, importMode, parsed)
}

func (s *Service) ImportConfirm(ctx context.Context, companyID, userID string, input ImportConfirmInput, defaultWarehouseID string) (map[string]any, error) {
	if err := s.ensureActiveWarehouse(ctx, companyID); err != nil {
		return nil, err
	}
	return s.enqueueImport(ctx, companyID, userID, input.Rows, input, defaultWarehouseID)
}

func (s *Service) GetImportJobStatus(ctx context.Context, companyID, jobID string) (map[string]any, error) {
	var status string
	var total, processed, success, failed int
	var errMsg *string
	var startedAt, finishedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT status, "totalRows", "processedRows", "successRows", "failedRows", "errorMessage", "startedAt", "finishedAt"
		FROM "ProductImportJob" WHERE id = $1 AND "companyId" = $2
	`, jobID, companyID).Scan(&status, &total, &processed, &success, &failed, &errMsg, &startedAt, &finishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": jobID, "status": status, "totalRows": total, "processedRows": processed,
		"successRows": success, "failedRows": failed, "errorMessage": errMsg,
		"startedAt": startedAt, "finishedAt": finishedAt,
	}, nil
}

func (s *Service) GetImportJobFailures(ctx context.Context, companyID, jobID string, limit int) (map[string]any, error) {
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	var exists string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "ProductImportJob" WHERE id = $1 AND "companyId" = $2`, jobID, companyID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT sr."rowIndex", sr."errorMessage", sr.payload
		FROM "ProductImportStagingRow" sr
		WHERE sr."jobId" = $1 AND sr.status = 'FAILED'
		ORDER BY sr."rowIndex" ASC LIMIT $2
	`, jobID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	failures := []map[string]any{}
	for rows.Next() {
		var idx int
		var msg *string
		var payload []byte
		if err := rows.Scan(&idx, &msg, &payload); err != nil {
			return nil, err
		}
		item := map[string]any{}
		_ = json.Unmarshal(payload, &item)
		failures = append(failures, map[string]any{
			"rowIndex": idx,
			"name":     strMap(item, "name"),
			"sku":      strMap(item, "sku"),
			"barcode":  strMap(item, "barcode"),
			"error":    deref(msg),
		})
	}
	return map[string]any{"jobId": jobID, "failures": failures}, rows.Err()
}

func (s *Service) CancelImportJob(ctx context.Context, companyID, jobID string) (map[string]any, error) {
	var status string
	err := s.pool.QueryRow(ctx, `SELECT status FROM "ProductImportJob" WHERE id = $1 AND "companyId" = $2`, jobID, companyID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == "COMPLETED" || status == "CANCELLED" {
		return map[string]any{"jobId": jobID, "status": status}, nil
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE "ProductImportJob"
		SET status = 'CANCELLED', "errorMessage" = 'Foydalanuvchi tomonidan bekor qilindi', "finishedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $1
	`, jobID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"jobId": jobID, "status": "CANCELLED"}, nil
}

type byteReader struct {
	b   []byte
	off int
}

func (r *byteReader) Read(p []byte) (int, error) {
	if r.off >= len(r.b) {
		return 0, io.EOF
	}
	n := copy(p, r.b[r.off:])
	r.off += n
	return n, nil
}

func (s *Service) listActiveWarehouses(ctx context.Context, companyID string) ([]map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name FROM "Warehouse" WHERE "companyId" = $1 AND status = 'ACTIVE'`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out = append(out, map[string]string{"id": id, "name": name})
	}
	return out, rows.Err()
}

func matchWarehouse(warehouses []map[string]string, name string) string {
	key := strings.ToLower(strings.TrimSpace(name))
	if key == "" && len(warehouses) == 1 {
		return warehouses[0]["id"]
	}
	for _, w := range warehouses {
		if strings.ToLower(w["name"]) == key {
			return w["id"]
		}
	}
	if len(warehouses) > 0 && key == "" {
		return warehouses[0]["id"]
	}
	return ""
}

func (s *Service) executeImportRows(ctx context.Context, companyID, userID, jobID string, rows []ImportRow, mode, defaultWH string, acc *importLedgerAccumulator) (success, failed int, errs []map[string]any) {
	catCache := map[string]string{}
	for i, row := range rows {
		wh := strings.TrimSpace(row.WarehouseID)
		if wh == "" {
			wh = defaultWH
		}
		if wh == "" {
			warehouses, _ := s.listActiveWarehouses(ctx, companyID)
			wh = matchWarehouse(warehouses, "")
		}
		if strings.EqualFold(strings.TrimSpace(row.RowAction), "skip") && !strings.EqualFold(strings.TrimSpace(row.StockAction), "apply") {
			continue
		}
		err := s.importOneRowWithLedger(ctx, companyID, userID, row, wh, mode, acc, catCache)
		if err != nil {
			if mapped := mapProductWriteErr(err); mapped != err {
				err = mapped
			}
			failed++
			errs = append(errs, map[string]any{"rowNumber": i + 1, "message": err.Error(), "name": row.Name})
			_ = s.insertImportStagingFailure(ctx, jobID, i, row, err.Error())
		} else {
			success++
		}
	}
	return success, failed, errs
}

func (s *Service) insertImportStagingFailure(ctx context.Context, jobID string, rowIndex int, row ImportRow, msg string) error {
	payload, _ := json.Marshal(map[string]any{
		"name": row.Name, "sku": row.SKU, "barcode": row.Barcode,
	})
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "ProductImportStagingRow" (id, "jobId", "rowIndex", payload, status, "errorMessage", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, 'FAILED', $4, NOW(), NOW())
		ON CONFLICT ("jobId", "rowIndex") DO UPDATE SET
			payload = EXCLUDED.payload, status = 'FAILED', "errorMessage" = EXCLUDED."errorMessage", "updatedAt" = NOW()
	`, jobID, rowIndex, payload, msg)
	return err
}

func strMap(m map[string]any, key string) string {
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func importRowExcelQty(row ImportRow) *float64 {
	if row.InitialStockRaw != nil {
		return row.InitialStockRaw
	}
	if row.InitialStock != nil {
		return row.InitialStock
	}
	if row.Quantity > 0 {
		q := row.Quantity
		return &q
	}
	return nil
}

func (s *Service) importOneRowWithLedger(ctx context.Context, companyID, userID string, row ImportRow, warehouseID, mode string, acc *importLedgerAccumulator, catCache map[string]string) error {
	return s.importOneRow(ctx, companyID, userID, row, warehouseID, mode, acc, catCache)
}

func (s *Service) importOneRow(ctx context.Context, companyID, userID string, row ImportRow, warehouseID, mode string, acc *importLedgerAccumulator, catCache map[string]string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	categoryID, err := s.ensureCategory(ctx, tx, companyID, row.Category, catCache)
	if err != nil {
		return err
	}
	unit := row.Unit
	if unit == "" {
		unit = "dona"
	}
	var productID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM "Product" WHERE "companyId" = $1 AND lower(name) = lower($2) LIMIT 1
	`, companyID, row.Name).Scan(&productID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			INSERT INTO "Product" (id, "companyId", name, "categoryId", unit, status, "createdAt", "updatedAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE', NOW(), NOW()) RETURNING id
		`, companyID, row.Name, categoryID, unit).Scan(&productID)
	}
	if err != nil {
		return err
	}

	vn := strings.TrimSpace(row.VariantName)
	if vn == "" {
		vn = strings.TrimSpace(row.Variant)
	}
	variantName := resolveImportVariantDisplayName(row.Name, vn, strings.TrimSpace(row.Color))
	currency := row.Currency
	if currency == "" {
		currency = "UZS"
	}
	var variantID string
	if row.ExistingVariantID != nil && strings.TrimSpace(*row.ExistingVariantID) != "" {
		variantID = strings.TrimSpace(*row.ExistingVariantID)
	} else if strings.TrimSpace(row.VariantID) != "" {
		variantID = strings.TrimSpace(row.VariantID)
	}
	if variantID != "" {
		err = tx.QueryRow(ctx, `SELECT id FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2`, variantID, companyID).Scan(&variantID)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			UPDATE "ProductVariant"
			SET "purchasePrice" = $2, "salePrice" = $3, currency = $4,
			    sku = COALESCE(NULLIF($5,''), sku), barcode = COALESCE(NULLIF($6,''), barcode),
			    status = 'ACTIVE', "updatedAt" = NOW()
			WHERE id = $1
		`, variantID, row.PurchasePrice, row.SalePrice, currency, row.SKU, row.Barcode)
		if err != nil {
			return err
		}
	} else {
		q := `SELECT id FROM "ProductVariant" WHERE "companyId" = $1 AND "productId" = $2 AND lower(name) = lower($3) LIMIT 1`
		err = tx.QueryRow(ctx, q, companyID, productID, variantName).Scan(&variantID)
		if errors.Is(err, pgx.ErrNoRows) && strings.TrimSpace(row.SKU) != "" {
			err = tx.QueryRow(ctx, `
				SELECT id FROM "ProductVariant"
				WHERE "companyId" = $1 AND lower(sku) = lower($2)
				LIMIT 1
			`, companyID, strings.TrimSpace(row.SKU)).Scan(&variantID)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `
				INSERT INTO "ProductVariant" (
					id, "companyId", "productId", name, sku, barcode, "purchasePrice", "salePrice", currency, status, "createdAt", "updatedAt"
				) VALUES (gen_random_uuid(), $1, $2, $3, NULLIF($4,''), NULLIF($5,''), $6, $7, $8, 'ACTIVE', NOW(), NOW())
				RETURNING id
			`, companyID, productID, variantName, row.SKU, row.Barcode, row.PurchasePrice, row.SalePrice, currency).Scan(&variantID)
		} else {
			_, err = tx.Exec(ctx, `
				UPDATE "ProductVariant"
				SET "purchasePrice" = $2, "salePrice" = $3, currency = $4,
				    sku = COALESCE(NULLIF($5,''), sku), barcode = COALESCE(NULLIF($6,''), barcode),
				    status = 'ACTIVE', "updatedAt" = NOW()
				WHERE id = $1
			`, variantID, row.PurchasePrice, row.SalePrice, currency, row.SKU, row.Barcode)
		}
		if err != nil {
			return err
		}
	}

	applyStock := strings.TrimSpace(row.StockAction) == "" || strings.EqualFold(row.StockAction, "apply")
	if excelQty := importRowExcelQty(row); applyStock && excelQty != nil && warehouseID != "" {
		var current float64
		_ = tx.QueryRow(ctx, `
			SELECT COALESCE(quantity, 0)::float8 FROM "StockBalance"
			WHERE "companyId" = $1 AND "warehouseId" = $2 AND "productVariantId" = $3
		`, companyID, warehouseID, variantID).Scan(&current)
		newQty := computeTargetStock(current, *excelQty, mode)
		delta := newQty - current
		if math.Abs(delta) > 1e-9 {
			if delta < 0 && current+delta < -1e-9 {
				return fmt.Errorf(
					"Omborda yetarli qoldiq yo'q. Mavjud: %v, chiqim: %v (Excel: %v, rejim: %s)",
					current, math.Abs(delta), *excelQty, mode,
				)
			}
			line := stock.Line{
				WarehouseID:      warehouseID,
				ProductVariantID: variantID,
				Quantity:         math.Abs(delta),
				Note:             fmt.Sprintf("Excel import (%s)", mode),
			}
			if delta > 0 {
				_, err = stock.RecordOneInTx(ctx, tx, companyID, userID, line, "ADJUSTMENT")
			} else {
				_, err = stock.RecordOneOutInTx(ctx, tx, companyID, userID, "ADJUSTMENT", line)
			}
			if err != nil {
				return err
			}
			if acc != nil && delta > 0 {
				label := row.Name
				if variantName != "" && !strings.EqualFold(variantName, "Asosiy") {
					label += " / " + variantName
				}
				trackImportStockInbound(acc, delta, row.PurchasePrice, currency, label)
			}
		}
	}
	_ = userID
	return tx.Commit(ctx)
}

func (s *Service) ensureCategory(ctx context.Context, tx pgx.Tx, companyID, name string, catCache map[string]string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Boshqa"
	}
	cacheKey := strings.ToLower(name)
	if catCache != nil {
		if id, ok := catCache[cacheKey]; ok {
			return id, nil
		}
	}
	var id string
	err := tx.QueryRow(ctx, `SELECT id FROM "ProductCategory" WHERE "companyId" = $1 AND lower(name) = lower($2) LIMIT 1`, companyID, name).Scan(&id)
	if err == nil {
		if catCache != nil {
			catCache[cacheKey] = id
		}
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO "ProductCategory" (id, "companyId", name, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id
	`, companyID, name).Scan(&id)
	if err == nil {
		if catCache != nil {
			catCache[cacheKey] = id
		}
		if s.cache != nil {
			s.cache.DelByPrefix(ctx, cache.CategoriesPrefix(companyID))
			s.cache.InvalidateProductsList(ctx, companyID)
		}
	}
	return id, err
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
