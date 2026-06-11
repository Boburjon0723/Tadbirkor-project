package partnerledger

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type variantRow struct {
	ID, ProductID, Name string
	SKU, Barcode        *string
	SalePrice, PurchasePrice float64
	Currency, ProductName, Unit string
	StockQty float64
	ImageURL, CategoryID, CategoryName *string
}

func (r *Repository) CountSaleCatalog(ctx context.Context, companyID, warehouseID, search string) (int, error) {
	where, args := saleCatalogWhere(companyID, warehouseID, search)
	var n int
	err := r.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT COUNT(*)::int
		FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		JOIN "StockBalance" sb ON sb."productVariantId" = v.id AND sb."warehouseId" = $2
		WHERE %s
	`, where), args...).Scan(&n)
	return n, err
}

func (r *Repository) ListSaleCatalog(ctx context.Context, companyID, warehouseID, search string, page, limit int) ([]map[string]any, error) {
	where, args := saleCatalogWhere(companyID, warehouseID, search)
	skip := (page - 1) * limit
	args = append(args, limit, skip)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT v.id, v."productId", p.name, v.name, v.sku, v.barcode, v."salePrice", v.currency,
		       p."imageUrl", c.id, c.name, sb.quantity, COALESCE(p.unit, 'dona')
		FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		LEFT JOIN "ProductCategory" c ON c.id = p."categoryId"
		JOIN "StockBalance" sb ON sb."productVariantId" = v.id AND sb."warehouseId" = $2
		WHERE %s
		ORDER BY v."updatedAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var v variantRow
		var sku, barcode, imageURL, catID, catName *string
		if err := rows.Scan(&v.ID, &v.ProductID, &v.ProductName, &v.Name, &sku, &barcode,
			&v.SalePrice, &v.Currency, &imageURL, &catID, &catName, &v.StockQty, &v.Unit); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": v.ID, "productId": v.ProductID, "productName": v.ProductName, "name": v.Name,
			"sku": sku, "barcode": barcode, "salePrice": v.SalePrice,
			"currency": normalizeCurrencyPtr(v.Currency), "image": imageURL,
			"categoryId": catID, "categoryName": catName, "stockQty": v.StockQty, "unit": v.Unit,
		})
	}
	return out, rows.Err()
}

func saleCatalogWhere(companyID, warehouseID, search string) (string, []any) {
	args := []any{companyID, warehouseID}
	where := `v."companyId" = $1 AND v.status = 'ACTIVE' AND p.status <> 'ARCHIVED'`
	if strings.TrimSpace(search) != "" {
		q := "%" + strings.TrimSpace(search) + "%"
		where += fmt.Sprintf(` AND (
			v.barcode ILIKE $%d OR v.sku ILIKE $%d OR v.name ILIKE $%d OR p.name ILIKE $%d
		)`, len(args)+1, len(args)+1, len(args)+1, len(args)+1)
		args = append(args, q)
	}
	return where, args
}

func normalizeCurrencyPtr(c string) string {
	if c == "" {
		return "UZS"
	}
	return NormalizeCurrency(c)
}

func (r *Repository) LoadVariantsByIDs(ctx context.Context, companyID string, ids []string) (map[string]variantRow, error) {
	if len(ids) == 0 {
		return map[string]variantRow{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT v.id, v."productId", v.name, v.sku, v.barcode, v."salePrice", v."purchasePrice",
		       COALESCE(v.currency, 'UZS'), p.name, COALESCE(p.unit, 'dona')
		FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		WHERE v."companyId" = $1 AND v.id = ANY($2)
	`, companyID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]variantRow{}
	for rows.Next() {
		var v variantRow
		var sku, barcode *string
		if err := rows.Scan(&v.ID, &v.ProductID, &v.Name, &sku, &barcode,
			&v.SalePrice, &v.PurchasePrice, &v.Currency, &v.ProductName, &v.Unit); err != nil {
			return nil, err
		}
		v.SKU = sku
		v.Barcode = barcode
		out[v.ID] = v
	}
	return out, rows.Err()
}

func (r *Repository) ListWarehouseVariants(ctx context.Context, companyID, warehouseID string) ([]variantRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT v.id, v."productId", v.name, v.sku, v.barcode, v."salePrice", v."purchasePrice",
		       COALESCE(v.currency, 'UZS'), p.name, COALESCE(p.unit, 'dona'), sb.quantity
		FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		JOIN "StockBalance" sb ON sb."productVariantId" = v.id AND sb."warehouseId" = $2
		WHERE v."companyId" = $1 AND v.status = 'ACTIVE' AND p.status <> 'ARCHIVED'
	`, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []variantRow{}
	for rows.Next() {
		var v variantRow
		var sku, barcode *string
		if err := rows.Scan(&v.ID, &v.ProductID, &v.Name, &sku, &barcode,
			&v.SalePrice, &v.PurchasePrice, &v.Currency, &v.ProductName, &v.Unit, &v.StockQty); err != nil {
			return nil, err
		}
		v.SKU = sku
		v.Barcode = barcode
		out = append(out, v)
	}
	return out, rows.Err()
}

type movementLineRow struct {
	Quantity, SalePrice, PurchasePrice float64
	Currency, ProductName, VariantName, SKU, Barcode, Unit, WarehouseName string
}

func (r *Repository) LoadMovementsByBatch(ctx context.Context, companyID, batchID string) ([]movementLineRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT m.quantity, v."salePrice", v."purchasePrice", COALESCE(v.currency, 'UZS'),
		       p.name, v.name, COALESCE(v.sku, ''), COALESCE(v.barcode, ''),
		       COALESCE(p.unit, 'dona'), w.name
		FROM "StockMovement" m
		JOIN "ProductVariant" v ON v.id = m."productVariantId"
		JOIN "Product" p ON p.id = v."productId"
		JOIN "Warehouse" w ON w.id = m."warehouseId"
		WHERE m."companyId" = $1 AND m."sourceId" = $2 AND m.type = 'OUT'
		ORDER BY m."createdAt" ASC
	`, companyID, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMovementLines(rows)
}

func (r *Repository) LoadMovementByID(ctx context.Context, companyID, movementID, movementType string) ([]movementLineRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT m.quantity, v."salePrice", v."purchasePrice", COALESCE(v.currency, 'UZS'),
		       p.name, v.name, COALESCE(v.sku, ''), COALESCE(v.barcode, ''),
		       COALESCE(p.unit, 'dona'), w.name
		FROM "StockMovement" m
		JOIN "ProductVariant" v ON v.id = m."productVariantId"
		JOIN "Product" p ON p.id = v."productId"
		JOIN "Warehouse" w ON w.id = m."warehouseId"
		WHERE m."companyId" = $1 AND m.id = $2 AND m.type = $3
		ORDER BY m."createdAt" ASC
	`, companyID, movementID, movementType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMovementLines(rows)
}

func scanMovementLines(rows pgx.Rows) ([]movementLineRow, error) {
	out := []movementLineRow{}
	for rows.Next() {
		var m movementLineRow
		if err := rows.Scan(&m.Quantity, &m.SalePrice, &m.PurchasePrice, &m.Currency,
			&m.ProductName, &m.VariantName, &m.SKU, &m.Barcode, &m.Unit, &m.WarehouseName); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) GetContactBrief(ctx context.Context, companyID, contactID string) (name string, telegramChatID *string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT name, "telegramChatId" FROM "PartnerLedgerContact"
		WHERE id = $1 AND "companyId" = $2 AND "isActive" = true
	`, contactID, companyID).Scan(&name, &telegramChatID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrContactNotFound
	}
	return name, telegramChatID, err
}

func (r *Repository) ListCatalogVariantsForTemplate(ctx context.Context, companyID, warehouseID string, limit int) ([]variantRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT v.sku, v.barcode, p.name, v.name, v."salePrice", COALESCE(v.currency, 'UZS'),
		       sb.quantity, COALESCE(p.unit, 'dona')
		FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		JOIN "StockBalance" sb ON sb."productVariantId" = v.id AND sb."warehouseId" = $2
		WHERE v."companyId" = $1 AND v.status = 'ACTIVE' AND p.status <> 'ARCHIVED'
		ORDER BY p.name ASC
		LIMIT $3
	`, companyID, warehouseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []variantRow{}
	for rows.Next() {
		var v variantRow
		var sku, barcode *string
		if err := rows.Scan(&sku, &barcode, &v.ProductName, &v.Name, &v.SalePrice, &v.Currency, &v.StockQty, &v.Unit); err != nil {
			return nil, err
		}
		v.SKU = sku
		v.Barcode = barcode
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *Repository) GetContactName(ctx context.Context, companyID, contactID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `
		SELECT name FROM "PartnerLedgerContact" WHERE id = $1 AND "companyId" = $2
	`, contactID, companyID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrContactNotFound
	}
	return name, err
}

func (r *Repository) ListContactOperationsForExport(ctx context.Context, companyID, contactID string) ([]operationRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT o.id, o."companyId", o."contactId", o.type, o.amount, o.currency, o."operationDate",
		       o.notes, o."sourceType", o."sourceId", o.quantity, o."productSummary", o."reversedById",
		       o."createdAt", o."updatedAt", o."createdById", u."fullName", u.login
		FROM "PartnerLedgerOperation" o
		JOIN "User" u ON u.id = o."createdById"
		WHERE o."companyId" = $1 AND o."contactId" = $2
		ORDER BY o."operationDate" DESC, o."createdAt" DESC
	`, companyID, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []operationRow{}
	for rows.Next() {
		var o operationRow
		var qty *float64
		if err := rows.Scan(
			&o.ID, &o.CompanyID, &o.ContactID, &o.Type, &o.Amount, &o.Currency, &o.OperationDate,
			&o.Notes, &o.SourceType, &o.SourceID, &qty, &o.ProductSummary, &o.ReversedByID,
			&o.CreatedAt, &o.UpdatedAt, &o.CreatedByID, &o.CreatedByName, &o.CreatedByLogin,
		); err != nil {
			return nil, err
		}
		if qty != nil {
			o.Quantity = *qty
		} else {
			o.QuantityNull = true
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (r *Repository) LoadSaleMovementsForContact(ctx context.Context, companyID string, batchIDs []string) ([]struct {
	BatchID, WarehouseName, ProductName, VariantName, SKU, Unit, Currency string
	Quantity, SalePrice float64
}, error) {
	if len(batchIDs) == 0 {
		return nil, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT m."sourceId", w.name, p.name, v.name, COALESCE(v.sku, ''), COALESCE(p.unit, 'dona'),
		       COALESCE(v.currency, 'UZS'), m.quantity, v."salePrice"
		FROM "StockMovement" m
		JOIN "ProductVariant" v ON v.id = m."productVariantId"
		JOIN "Product" p ON p.id = v."productId"
		JOIN "Warehouse" w ON w.id = m."warehouseId"
		WHERE m."companyId" = $1 AND m."sourceId" = ANY($2) AND m.type = 'OUT'
		ORDER BY m."sourceId" ASC, m."createdAt" ASC
	`, companyID, batchIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type row struct {
		BatchID, WarehouseName, ProductName, VariantName, SKU, Unit, Currency string
		Quantity, SalePrice float64
	}
	out := []struct {
		BatchID, WarehouseName, ProductName, VariantName, SKU, Unit, Currency string
		Quantity, SalePrice float64
	}{}
	for rows.Next() {
		var item row
		var sourceID *string
		if err := rows.Scan(&sourceID, &item.WarehouseName, &item.ProductName, &item.VariantName,
			&item.SKU, &item.Unit, &item.Currency, &item.Quantity, &item.SalePrice); err != nil {
			return nil, err
		}
		if sourceID != nil {
			item.BatchID = *sourceID
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
