package reports

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/internal/expenses"
	"github.com/tadbirkor/axis-erp/backend/internal/income"
	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
)

var allowedDebtStatuses = map[string]struct{}{
	"OPEN":    {},
	"PARTIAL": {},
	"CLOSED":  {},
	"PAID":    {},
}

type Service struct {
	pool      *pgxpool.Pool
	companies *companies.Service
	income    *income.Service
	expenses  *expenses.Service
	payroll   *payroll.DataService
}

func NewService(
	pool *pgxpool.Pool,
	companiesSvc *companies.Service,
	incomeSvc *income.Service,
	expensesSvc *expenses.Service,
	payrollSvc *payroll.DataService,
) *Service {
	return &Service{
		pool:      pool,
		companies: companiesSvc,
		income:    incomeSvc,
		expenses:  expensesSvc,
		payroll:   payrollSvc,
	}
}

func (s *Service) assertMovementCountWithinLimit(
	ctx context.Context,
	sql string,
	args []any,
	label string,
) error {
	var count int
	if err := s.pool.QueryRow(ctx, sql, args...).Scan(&count); err != nil {
		return err
	}
	maxRows := getReportMaxMovementRows()
	if count > maxRows {
		return fmt.Errorf(
			"%s: %d ta ombor harakati (limit %d). Sana oralig'ini qisqartiring yoki ombor filtri qo'ying",
			label,
			count,
			maxRows,
		)
	}
	return nil
}

func (s *Service) resolveDebtStatusFilter(status *string) (string, bool, error) {
	if status == nil || strings.TrimSpace(*status) == "" {
		return "", false, nil
	}
	normalized := strings.ToUpper(strings.TrimSpace(*status))
	if _, ok := allowedDebtStatuses[normalized]; !ok {
		return "", false, errors.New("Noto'g'ri qarz holati. Ruxsat etilgan: OPEN, PARTIAL, CLOSED, PAID")
	}
	return normalized, true, nil
}

func (s *Service) GetCostSummary(ctx context.Context, companyID string, query ReportQueryInput) (map[string]any, error) {
	rng, err := parseReportDateRange(query)
	if err != nil {
		return nil, err
	}

	warehouseID := firstNonEmpty(query.WarehouseID)
	whereTail := ""
	args := []any{companyID, rng.GTE, rng.LTE}
	if warehouseID != nil {
		whereTail = ` AND sm."warehouseId" = $4`
		args = append(args, *warehouseID)
	}

	inCountSQL := `
		SELECT COUNT(*)::int
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'IN'
		  AND sm."sourceType" = 'GOODS_RECEIPT'` + whereTail
	outCountSQL := `
		SELECT COUNT(*)::int
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail

	if err := s.assertMovementCountWithinLimit(ctx, inCountSQL, args, "Kirim"); err != nil {
		return nil, err
	}
	if err := s.assertMovementCountWithinLimit(ctx, outCountSQL, args, "Sotuv"); err != nil {
		return nil, err
	}

	inSQL := `
		SELECT COALESCE(pv.currency, 'UZS'), COALESCE(pv."purchasePrice", 0)::float8, ABS(sm.quantity)::float8
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'IN'
		  AND sm."sourceType" = 'GOODS_RECEIPT'` + whereTail
	outSQL := `
		SELECT COALESCE(pv.currency, 'UZS'), COALESCE(pv."salePrice", 0)::float8, ABS(sm.quantity)::float8
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail

	purchase := newBucket()
	sales := newBucket()

	var purchaseMovements int
	inRows, err := s.pool.Query(ctx, inSQL, args...)
	if err != nil {
		return nil, err
	}
	for inRows.Next() {
		var currency string
		var price, qty float64
		if err := inRows.Scan(&currency, &price, &qty); err != nil {
			inRows.Close()
			return nil, err
		}
		bucketAdd(&purchase, currency, qty*price)
		purchaseMovements++
	}
	inRows.Close()

	var salesMovements int
	outRows, err := s.pool.Query(ctx, outSQL, args...)
	if err != nil {
		return nil, err
	}
	for outRows.Next() {
		var currency string
		var price, qty float64
		if err := outRows.Scan(&currency, &price, &qty); err != nil {
			outRows.Close()
			return nil, err
		}
		bucketAdd(&sales, currency, qty*price)
		salesMovements++
	}
	outRows.Close()

	balanceWhere := `sb."companyId" = $1 AND w.status <> 'ARCHIVED'`
	balanceArgs := []any{companyID}
	if warehouseID != nil {
		balanceWhere += ` AND sb."warehouseId" = $2`
		balanceArgs = append(balanceArgs, *warehouseID)
	}
	balanceSQL := `
		SELECT COALESCE(pv.currency, 'UZS'), COALESCE(pv."purchasePrice", 0)::float8, COALESCE(sb.quantity, 0)::float8
		FROM "StockBalance" sb
		JOIN "Warehouse" w ON w.id = sb."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sb."productVariantId"
		WHERE ` + balanceWhere

	inventory := newBucket()
	var stockLines int
	bRows, err := s.pool.Query(ctx, balanceSQL, balanceArgs...)
	if err != nil {
		return nil, err
	}
	for bRows.Next() {
		var currency string
		var price, qty float64
		if err := bRows.Scan(&currency, &price, &qty); err != nil {
			bRows.Close()
			return nil, err
		}
		bucketAdd(&inventory, currency, qty*price)
		stockLines++
	}
	bRows.Close()

	purchaseR := roundedBucket(purchase)
	salesR := roundedBucket(sales)
	inventoryR := roundedBucket(inventory)
	profit := currencyBucket{
		UZS: round2(salesR.UZS - purchaseR.UZS),
		USD: round2(salesR.USD - purchaseR.USD),
	}

	marginUZS := 0.0
	marginUSD := 0.0
	if salesR.UZS > 0 {
		marginUZS = round2((salesR.UZS - purchaseR.UZS) / salesR.UZS * 100)
	}
	if salesR.USD > 0 {
		marginUSD = round2((salesR.USD - purchaseR.USD) / salesR.USD * 100)
	}

	return map[string]any{
		"period": map[string]any{
			"from":      rng.DateFrom,
			"to":        rng.DateTo,
			"days":      rng.Days,
			"defaulted": rng.Defaulted,
			"capped":    rng.Capped,
		},
		"warehouseId": func() any {
			if warehouseID == nil {
				return nil
			}
			return *warehouseID
		}(),
		"purchase": purchaseR,
		"sales":    salesR,
		"profit":   profit,
		"margin": currencyBucket{
			UZS: marginUZS,
			USD: marginUSD,
		},
		"inventoryValue": inventoryR,
		"counts": map[string]any{
			"purchaseMovements": purchaseMovements,
			"salesMovements":    salesMovements,
			"stockLines":        stockLines,
		},
	}, nil
}

func (s *Service) GetDailyBreakdown(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	rng, err := parseReportDateRange(query)
	if err != nil {
		return nil, err
	}

	warehouseID := firstNonEmpty(query.WarehouseID)
	whereTail := ""
	args := []any{companyID, rng.GTE, rng.LTE}
	if warehouseID != nil {
		whereTail = ` AND sm."warehouseId" = $4`
		args = append(args, *warehouseID)
	}

	inCountSQL := `
		SELECT COUNT(*)::int
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'IN'
		  AND sm."sourceType" = 'GOODS_RECEIPT'` + whereTail
	outCountSQL := `
		SELECT COUNT(*)::int
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail
	if err := s.assertMovementCountWithinLimit(ctx, inCountSQL, args, "Kunlik kirim"); err != nil {
		return nil, err
	}
	if err := s.assertMovementCountWithinLimit(ctx, outCountSQL, args, "Kunlik sotuv"); err != nil {
		return nil, err
	}

	type dayRow struct {
		Date     string
		Purchase currencyBucket
		Sales    currencyBucket
	}
	dayMap := map[string]*dayRow{}
	cursor := startOfUTCDay(rng.GTE)
	end := startOfUTCDay(rng.LTE)
	for !cursor.After(end) {
		key := cursor.Format("2006-01-02")
		dayMap[key] = &dayRow{
			Date:     key,
			Purchase: newBucket(),
			Sales:    newBucket(),
		}
		cursor = cursor.AddDate(0, 0, 1)
	}

	inSQL := `
		SELECT DATE(sm."createdAt"), COALESCE(pv.currency, 'UZS'), COALESCE(pv."purchasePrice", 0)::float8, ABS(sm.quantity)::float8
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'IN'
		  AND sm."sourceType" = 'GOODS_RECEIPT'` + whereTail
	outSQL := `
		SELECT DATE(sm."createdAt"), COALESCE(pv.currency, 'UZS'), COALESCE(pv."salePrice", 0)::float8, ABS(sm.quantity)::float8
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail

	inRows, err := s.pool.Query(ctx, inSQL, args...)
	if err != nil {
		return nil, err
	}
	for inRows.Next() {
		var day time.Time
		var currency string
		var price, qty float64
		if err := inRows.Scan(&day, &currency, &price, &qty); err != nil {
			inRows.Close()
			return nil, err
		}
		key := day.UTC().Format("2006-01-02")
		if _, ok := dayMap[key]; !ok {
			dayMap[key] = &dayRow{Date: key, Purchase: newBucket(), Sales: newBucket()}
		}
		bucketAdd(&dayMap[key].Purchase, currency, qty*price)
	}
	inRows.Close()

	outRows, err := s.pool.Query(ctx, outSQL, args...)
	if err != nil {
		return nil, err
	}
	for outRows.Next() {
		var day time.Time
		var currency string
		var price, qty float64
		if err := outRows.Scan(&day, &currency, &price, &qty); err != nil {
			outRows.Close()
			return nil, err
		}
		key := day.UTC().Format("2006-01-02")
		if _, ok := dayMap[key]; !ok {
			dayMap[key] = &dayRow{Date: key, Purchase: newBucket(), Sales: newBucket()}
		}
		bucketAdd(&dayMap[key].Sales, currency, qty*price)
	}
	outRows.Close()

	keys := make([]string, 0, len(dayMap))
	for k := range dayMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	result := make([]map[string]any, 0, len(keys))
	for _, key := range keys {
		row := dayMap[key]
		purchase := roundedBucket(row.Purchase)
		sales := roundedBucket(row.Sales)
		result = append(result, map[string]any{
			"date":     row.Date,
			"purchase": purchase,
			"sales":    sales,
			"profit": currencyBucket{
				UZS: round2(sales.UZS - purchase.UZS),
				USD: round2(sales.USD - purchase.USD),
			},
		})
	}
	return result, nil
}

func (s *Service) GetTopProducts(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	rng, err := parseReportDateRange(query)
	if err != nil {
		return nil, err
	}

	warehouseID := firstNonEmpty(query.WarehouseID)
	whereTail := ""
	args := []any{companyID, rng.GTE, rng.LTE}
	if warehouseID != nil {
		whereTail = ` AND sm."warehouseId" = $4`
		args = append(args, *warehouseID)
	}

	countSQL := `
		SELECT COUNT(*)::int
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail
	if err := s.assertMovementCountWithinLimit(ctx, countSQL, args, "Top mahsulotlar"); err != nil {
		return nil, err
	}

	sql := `
		SELECT sm."productVariantId",
		       COALESCE(p.name, '—'),
		       COALESCE(pv.name, ''),
		       pv.sku,
		       COALESCE(pv.currency, 'UZS'),
		       COALESCE(pv."salePrice", 0)::float8,
		       ABS(sm.quantity)::float8
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm."createdAt" <= $3
		  AND w.status <> 'ARCHIVED'
		  AND sm.type = 'OUT'` + whereTail

	type agg struct {
		ProductVariantID string
		ProductName      string
		VariantName      string
		SKU              *string
		Currency         string
		Quantity         float64
		Revenue          float64
	}
	aggMap := map[string]*agg{}
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var variantID, productName, variantName, currency string
		var sku *string
		var salePrice, qty float64
		if err := rows.Scan(&variantID, &productName, &variantName, &sku, &currency, &salePrice, &qty); err != nil {
			rows.Close()
			return nil, err
		}
		item, ok := aggMap[variantID]
		if !ok {
			item = &agg{
				ProductVariantID: variantID,
				ProductName:      productName,
				VariantName:      variantName,
				SKU:              sku,
				Currency:         normCurrency(currency),
			}
			aggMap[variantID] = item
		}
		item.Quantity += qty
		item.Revenue += qty * salePrice
	}
	rows.Close()

	limit := query.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	flat := make([]*agg, 0, len(aggMap))
	for _, v := range aggMap {
		flat = append(flat, v)
	}
	sort.Slice(flat, func(i, j int) bool { return flat[i].Quantity > flat[j].Quantity })
	if len(flat) > limit {
		flat = flat[:limit]
	}

	out := make([]map[string]any, 0, len(flat))
	for _, v := range flat {
		out = append(out, map[string]any{
			"productVariantId": v.ProductVariantID,
			"productName":      v.ProductName,
			"variantName":      v.VariantName,
			"sku":              v.SKU,
			"currency":         v.Currency,
			"quantity":         round2(v.Quantity),
			"revenue":          round2(v.Revenue),
		})
	}
	return out, nil
}

func (s *Service) GetStockReport(ctx context.Context, companyID string, query ReportQueryInput) (map[string]any, error) {
	sql := `
		SELECT w.name,
		       p.name,
		       pv.name,
		       pv.sku,
		       COALESCE(sb.quantity, 0)::float8,
		       COALESCE(pv."purchasePrice", 0)::float8,
		       COALESCE(pv."salePrice", 0)::float8
		FROM "StockBalance" sb
		JOIN "Warehouse" w ON w.id = sb."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sb."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE sb."companyId" = $1`
	args := []any{companyID}
	n := 2
	if query.WarehouseID != nil && strings.TrimSpace(*query.WarehouseID) != "" {
		sql += fmt.Sprintf(` AND sb."warehouseId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.WarehouseID))
		n++
	}
	if query.ProductVariantID != nil && strings.TrimSpace(*query.ProductVariantID) != "" {
		sql += fmt.Sprintf(` AND sb."productVariantId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.ProductVariantID))
	}
	sql += ` ORDER BY w.name ASC, p.name ASC, pv.name ASC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := make([]map[string]any, 0, 256)
	totalQty := 0.0
	totalVal := 0.0
	for rows.Next() {
		var warehouse, product, variant string
		var sku *string
		var qty, purchasePrice, salePrice float64
		if err := rows.Scan(&warehouse, &product, &variant, &sku, &qty, &purchasePrice, &salePrice); err != nil {
			return nil, err
		}
		inventoryValue := qty * purchasePrice
		totalQty += qty
		totalVal += inventoryValue
		data = append(data, map[string]any{
			"warehouse":      warehouse,
			"product":        product,
			"variant":        variant,
			"sku":            sku,
			"quantity":       qty,
			"purchasePrice":  purchasePrice,
			"salePrice":      salePrice,
			"inventoryValue": round2(inventoryValue),
		})
	}

	return map[string]any{
		"summary": map[string]any{
			"totalItems":    len(data),
			"totalQuantity": round2(totalQty),
			"totalValue":    round2(totalVal),
		},
		"data": data,
	}, nil
}

func (s *Service) GetStockMovementReport(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	rng, err := parseReportDateRange(query)
	if err != nil {
		return nil, err
	}

	whereSQL := `
		sm."companyId" = $1
		AND sm."createdAt" >= $2
		AND sm."createdAt" <= $3`
	args := []any{companyID, rng.GTE, rng.LTE}
	n := 4
	if query.WarehouseID != nil && strings.TrimSpace(*query.WarehouseID) != "" {
		whereSQL += fmt.Sprintf(` AND sm."warehouseId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.WarehouseID))
		n++
	}
	if query.ProductVariantID != nil && strings.TrimSpace(*query.ProductVariantID) != "" {
		whereSQL += fmt.Sprintf(` AND sm."productVariantId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.ProductVariantID))
	}
	if err := s.assertMovementCountWithinLimit(
		ctx,
		`SELECT COUNT(*)::int FROM "StockMovement" sm WHERE `+whereSQL,
		args,
		"Ombor harakatlari",
	); err != nil {
		return nil, err
	}

	sql := `
		SELECT sm."createdAt",
		       sm.type,
		       w.name,
		       p.name,
		       pv.name,
		       sm.quantity::float8,
		       sm."sourceType",
		       sm.note
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE ` + whereSQL + `
		ORDER BY sm."createdAt" DESC
		LIMIT ` + fmt.Sprintf("%d", getReportMaxMovementRows())
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]any, 0, 512)
	for rows.Next() {
		var date time.Time
		var mType, warehouse, product, variant, sourceType string
		var quantity float64
		var note *string
		if err := rows.Scan(&date, &mType, &warehouse, &product, &variant, &quantity, &sourceType, &note); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{
			"date":       date,
			"type":       mType,
			"warehouse":  warehouse,
			"product":    product,
			"variant":    variant,
			"quantity":   quantity,
			"sourceType": sourceType,
			"note":       note,
		})
	}
	return result, nil
}

func (s *Service) GetDebtorsReport(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	status, hasStatus, err := s.resolveDebtStatusFilter(query.Status)
	if err != nil {
		return nil, err
	}

	sql := `
		SELECT de.id,
		       d.name,
		       de."receiptId",
		       COALESCE(de.amount, 0)::float8,
		       COALESCE(de."remainingAmount", 0)::float8,
		       de.status,
		       de."createdAt"
		FROM "DebtEntry" de
		LEFT JOIN "Company" d ON d.id = de."debtorId"
		WHERE de."creditorId" = $1`
	args := []any{companyID}
	n := 2
	if query.PartnerCompanyID != nil && strings.TrimSpace(*query.PartnerCompanyID) != "" {
		sql += fmt.Sprintf(` AND de."debtorId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.PartnerCompanyID))
		n++
	}
	if hasStatus {
		sql += fmt.Sprintf(` AND de.status = $%d`, n)
		args = append(args, status)
	} else {
		sql += ` AND de.status IN ('OPEN', 'PARTIAL')`
	}
	sql += ` ORDER BY de."createdAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]any, 0, 128)
	for rows.Next() {
		var id, partner, debtStatus string
		var receiptID *string
		var amount, remaining float64
		var createdAt time.Time
		if err := rows.Scan(&id, &partner, &receiptID, &amount, &remaining, &debtStatus, &createdAt); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{
			"id":              id,
			"partner":         partner,
			"receiptNumber":   shortID(receiptID, "N/A"),
			"amount":          amount,
			"remainingAmount": remaining,
			"status":          debtStatus,
			"createdAt":       createdAt,
		})
	}
	return result, nil
}

func (s *Service) GetCreditorsReport(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	status, hasStatus, err := s.resolveDebtStatusFilter(query.Status)
	if err != nil {
		return nil, err
	}

	sql := `
		SELECT de.id,
		       c.name,
		       de."receiptId",
		       COALESCE(de.amount, 0)::float8,
		       COALESCE(de."remainingAmount", 0)::float8,
		       de.status,
		       de."createdAt"
		FROM "DebtEntry" de
		LEFT JOIN "Company" c ON c.id = de."creditorId"
		WHERE de."debtorId" = $1`
	args := []any{companyID}
	n := 2
	if query.PartnerCompanyID != nil && strings.TrimSpace(*query.PartnerCompanyID) != "" {
		sql += fmt.Sprintf(` AND de."creditorId" = $%d`, n)
		args = append(args, strings.TrimSpace(*query.PartnerCompanyID))
		n++
	}
	if hasStatus {
		sql += fmt.Sprintf(` AND de.status = $%d`, n)
		args = append(args, status)
	} else {
		sql += ` AND de.status IN ('OPEN', 'PARTIAL')`
	}
	sql += ` ORDER BY de."createdAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]any, 0, 128)
	for rows.Next() {
		var id, partner, debtStatus string
		var receiptID *string
		var amount, remaining float64
		var createdAt time.Time
		if err := rows.Scan(&id, &partner, &receiptID, &amount, &remaining, &debtStatus, &createdAt); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{
			"id":              id,
			"partner":         partner,
			"receiptNumber":   shortID(receiptID, "N/A"),
			"amount":          amount,
			"remainingAmount": remaining,
			"status":          debtStatus,
			"createdAt":       createdAt,
		})
	}
	return result, nil
}

func (s *Service) GetPartnersBalanceReport(ctx context.Context, companyID string) ([]map[string]any, error) {
	claims := map[string]float64{}
	liabilities := map[string]float64{}

	claimRows, err := s.pool.Query(ctx, `
		SELECT "debtorId", COALESCE(SUM("remainingAmount"), 0)::float8
		FROM "DebtEntry"
		WHERE "creditorId" = $1
		GROUP BY "debtorId"
	`, companyID)
	if err != nil {
		return nil, err
	}
	for claimRows.Next() {
		var partnerID string
		var amount float64
		if err := claimRows.Scan(&partnerID, &amount); err != nil {
			claimRows.Close()
			return nil, err
		}
		claims[partnerID] = amount
	}
	claimRows.Close()

	liabilityRows, err := s.pool.Query(ctx, `
		SELECT "creditorId", COALESCE(SUM("remainingAmount"), 0)::float8
		FROM "DebtEntry"
		WHERE "debtorId" = $1
		GROUP BY "creditorId"
	`, companyID)
	if err != nil {
		return nil, err
	}
	for liabilityRows.Next() {
		var partnerID string
		var amount float64
		if err := liabilityRows.Scan(&partnerID, &amount); err != nil {
			liabilityRows.Close()
			return nil, err
		}
		liabilities[partnerID] = amount
	}
	liabilityRows.Close()

	partnersRows, err := s.pool.Query(ctx, `
		SELECT p."partnerCompanyId", c.name
		FROM "Partner" p
		JOIN "Company" c ON c.id = p."partnerCompanyId"
		WHERE p."ownerCompanyId" = $1
		ORDER BY c.name ASC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer partnersRows.Close()

	out := make([]map[string]any, 0, 64)
	for partnersRows.Next() {
		var partnerID, partnerName string
		if err := partnersRows.Scan(&partnerID, &partnerName); err != nil {
			return nil, err
		}
		claim := claims[partnerID]
		liability := liabilities[partnerID]
		out = append(out, map[string]any{
			"partnerId":       partnerID,
			"partnerName":     partnerName,
			"claimAmount":     claim,
			"liabilityAmount": liability,
			"netBalance":      claim - liability,
		})
	}
	return out, nil
}

func (s *Service) GetPartnerDetailedBalance(
	ctx context.Context,
	companyID, partnerCompanyID string,
	query ReportQueryInput,
) (map[string]any, error) {
	sql := `
		SELECT de."createdAt",
		       de.id,
		       de."receiptId",
		       r."orderId",
		       de."creditorId",
		       de."debtorId",
		       COALESCE(de.amount, 0)::float8,
		       COALESCE(de.currency, 'UZS')
		FROM "DebtEntry" de
		LEFT JOIN "Receipt" r ON r.id = de."receiptId"
		WHERE (
			(de."creditorId" = $1 AND de."debtorId" = $2) OR
			(de."creditorId" = $2 AND de."debtorId" = $1)
		)`
	args := []any{companyID, partnerCompanyID}
	n := 3
	if from := parseDateForFilter(query.DateFrom, false); from != nil {
		sql += fmt.Sprintf(` AND de."createdAt" >= $%d`, n)
		args = append(args, *from)
		n++
	}
	if to := parseDateForFilter(query.DateTo, true); to != nil {
		sql += fmt.Sprintf(` AND de."createdAt" <= $%d`, n)
		args = append(args, *to)
	}
	sql += ` ORDER BY de."createdAt" ASC`

	transactions := make([]map[string]any, 0, 256)
	debtRows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	for debtRows.Next() {
		var createdAt time.Time
		var debtID, creditorID, debtorID, currency string
		var receiptID, orderID *string
		var amount float64
		if err := debtRows.Scan(&createdAt, &debtID, &receiptID, &orderID, &creditorID, &debtorID, &amount, &currency); err != nil {
			debtRows.Close()
			return nil, err
		}
		description := "Qarz " + shortID(&debtID, debtID)
		if orderID != nil && strings.TrimSpace(*orderID) != "" {
			description = "Buyurtma ORD-" + shortID(orderID, "")
		} else if receiptID != nil && strings.TrimSpace(*receiptID) != "" {
			description = "Qabul RCP-" + shortID(receiptID, "")
		}
		debit := 0.0
		credit := 0.0
		if creditorID == companyID {
			debit = amount
		}
		if debtorID == companyID {
			credit = amount
		}
		transactions = append(transactions, map[string]any{
			"date":        createdAt,
			"description": description,
			"debit":       debit,
			"credit":      credit,
			"currency":    normCurrency(currency),
		})
	}
	debtRows.Close()

	paymentRows, err := s.pool.Query(ctx, `
		SELECT dpr."createdAt",
		       dpr.amount::float8,
		       dpr.notes,
		       de."creditorId",
		       de."debtorId",
		       COALESCE(de.currency, 'UZS')
		FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.status = 'CONFIRMED'
		  AND (
			(de."creditorId" = $1 AND de."debtorId" = $2) OR
			(de."creditorId" = $2 AND de."debtorId" = $1)
		  )
		ORDER BY dpr."createdAt" ASC
	`, companyID, partnerCompanyID)
	if err != nil {
		return nil, err
	}
	for paymentRows.Next() {
		var createdAt time.Time
		var amount float64
		var notes *string
		var creditorID, debtorID, currency string
		if err := paymentRows.Scan(&createdAt, &amount, &notes, &creditorID, &debtorID, &currency); err != nil {
			paymentRows.Close()
			return nil, err
		}
		debit := 0.0
		credit := 0.0
		if creditorID == partnerCompanyID {
			debit = amount
		}
		if debtorID == partnerCompanyID {
			credit = amount
		}
		note := "Tasdiqlangan"
		if notes != nil && strings.TrimSpace(*notes) != "" {
			note = strings.TrimSpace(*notes)
		}
		transactions = append(transactions, map[string]any{
			"date":        createdAt,
			"description": "To'lov (" + note + ")",
			"debit":       debit,
			"credit":      credit,
			"currency":    normCurrency(currency),
		})
	}
	paymentRows.Close()

	sort.Slice(transactions, func(i, j int) bool {
		left := transactions[i]["date"].(time.Time)
		right := transactions[j]["date"].(time.Time)
		return left.Before(right)
	})

	partner, err := s.getCompanyIdentity(ctx, partnerCompanyID)
	if err != nil {
		return nil, errors.New("Kompaniya yoki hamkor topilmadi")
	}
	myCompany, err := s.getCompanyIdentity(ctx, companyID)
	if err != nil {
		return nil, errors.New("Kompaniya yoki hamkor topilmadi")
	}

	return map[string]any{
		"transactions": transactions,
		"partner":      partner,
		"myCompany":    myCompany,
	}, nil
}

func (s *Service) getCompanyIdentity(ctx context.Context, companyID string) (map[string]any, error) {
	var name string
	var tin, address, phone *string
	err := s.pool.QueryRow(ctx, `
		SELECT name, tin, address, phone
		FROM "Company"
		WHERE id = $1
	`, companyID).Scan(&name, &tin, &address, &phone)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		return nil, err
	}
	return map[string]any{
		"name":    name,
		"tin":     tin,
		"address": address,
		"phone":   phone,
	}, nil
}

func (s *Service) GetB2BOrdersReport(ctx context.Context, companyID string, query ReportQueryInput) ([]map[string]any, error) {
	sql := `
		SELECT o.id,
		       o."createdAt",
		       o.status,
		       o."buyerCompanyId",
		       o."sellerCompanyId",
		       b.name,
		       sl.name,
		       COALESCE((SELECT COUNT(*) FROM "B2BOrderItem" i WHERE i."orderId" = o.id), 0)::int,
		       COALESCE((
		         SELECT SUM(i.quantity::float8 * COALESCE(i."expectedPrice", 0)::float8)
		         FROM "B2BOrderItem" i
		         WHERE i."orderId" = o.id
		       ), 0)::float8
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" sl ON sl.id = o."sellerCompanyId"
		WHERE (o."buyerCompanyId" = $1 OR o."sellerCompanyId" = $1)`
	args := []any{companyID}
	n := 2

	if query.Status != nil && strings.TrimSpace(*query.Status) != "" {
		sql += fmt.Sprintf(` AND o.status = $%d`, n)
		args = append(args, strings.ToUpper(strings.TrimSpace(*query.Status)))
		n++
	}
	if query.PartnerCompanyID != nil && strings.TrimSpace(*query.PartnerCompanyID) != "" {
		partnerID := strings.TrimSpace(*query.PartnerCompanyID)
		sql += fmt.Sprintf(` AND ((o."buyerCompanyId" = $1 AND o."sellerCompanyId" = $%d) OR (o."sellerCompanyId" = $1 AND o."buyerCompanyId" = $%d))`, n, n)
		args = append(args, partnerID)
		n++
	}
	if from := parseDateForFilter(query.DateFrom, false); from != nil {
		sql += fmt.Sprintf(` AND o."createdAt" >= $%d`, n)
		args = append(args, *from)
		n++
	}
	if to := parseDateForFilter(query.DateTo, true); to != nil {
		sql += fmt.Sprintf(` AND o."createdAt" <= $%d`, n)
		args = append(args, *to)
	}
	sql += ` ORDER BY o."createdAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]map[string]any, 0, 128)
	for rows.Next() {
		var id, status, buyerID, sellerID, buyerName, sellerName string
		var createdAt time.Time
		var itemCount int
		var totalAmount float64
		if err := rows.Scan(
			&id,
			&createdAt,
			&status,
			&buyerID,
			&sellerID,
			&buyerName,
			&sellerName,
			&itemCount,
			&totalAmount,
		); err != nil {
			return nil, err
		}
		orderType := "INCOMING"
		partner := sellerName
		if sellerID == companyID {
			orderType = "OUTGOING"
			partner = buyerName
		}
		out = append(out, map[string]any{
			"id":          id,
			"date":        createdAt,
			"type":        orderType,
			"partner":     partner,
			"status":      status,
			"itemCount":   itemCount,
			"totalAmount": round2(totalAmount),
		})
	}
	return out, nil
}

func (s *Service) GetB2BOrdersAnalytics(ctx context.Context, companyID string, days int) (map[string]any, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	start := startOfUTCDay(time.Now().UTC().AddDate(0, 0, -days+1))

	currency := "UZS"
	var usdExists bool
	if err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM "B2BOrder" o
			JOIN "B2BOrderItem" i ON i."orderId" = o.id
			WHERE (o."buyerCompanyId" = $1 OR o."sellerCompanyId" = $1)
			  AND o."createdAt" >= $2
			  AND UPPER(COALESCE(i."expectedCurrency", 'UZS')) = 'USD'
		)
	`, companyID, start).Scan(&usdExists); err != nil {
		return nil, err
	}
	if usdExists {
		currency = "USD"
	}

	type dayStat struct {
		Count  int
		Volume float64
	}
	daily := map[string]*dayStat{}
	for i := 0; i < days; i++ {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		daily[day] = &dayStat{}
	}

	rows, err := s.pool.Query(ctx, `
		SELECT DATE(o."createdAt"),
		       COUNT(DISTINCT o.id)::int,
		       COALESCE(SUM(
		         CASE
		           WHEN UPPER(COALESCE(i."expectedCurrency", 'UZS')) = $3
		           THEN i.quantity::float8 * COALESCE(i."expectedPrice", 0)::float8
		           ELSE 0
		         END
		       ), 0)::float8
		FROM "B2BOrder" o
		LEFT JOIN "B2BOrderItem" i ON i."orderId" = o.id
		WHERE (o."buyerCompanyId" = $1 OR o."sellerCompanyId" = $1)
		  AND o."createdAt" >= $2
		GROUP BY DATE(o."createdAt")
	`, companyID, start, currency)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day time.Time
		var count int
		var volume float64
		if err := rows.Scan(&day, &count, &volume); err != nil {
			rows.Close()
			return nil, err
		}
		key := day.UTC().Format("2006-01-02")
		if _, ok := daily[key]; !ok {
			daily[key] = &dayStat{}
		}
		daily[key].Count = count
		daily[key].Volume = round2(volume)
	}
	rows.Close()

	keys := make([]string, 0, len(daily))
	for k := range daily {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	data := make([]map[string]any, 0, len(keys))
	for _, key := range keys {
		data = append(data, map[string]any{
			"date":   key,
			"count":  daily[key].Count,
			"volume": daily[key].Volume,
		})
	}

	return map[string]any{
		"currency": currency,
		"data":     data,
	}, nil
}

func (s *Service) GetStockMovementAnalytics(ctx context.Context, companyID string, days int) (map[string]any, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	start := startOfUTCDay(time.Now().UTC().AddDate(0, 0, -days+1))

	type dayStat struct {
		In  float64
		Out float64
	}
	daily := map[string]*dayStat{}
	for i := 0; i < days; i++ {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		daily[day] = &dayStat{}
	}

	rows, err := s.pool.Query(ctx, `
		SELECT DATE("createdAt"), type, COALESCE(SUM(quantity), 0)::float8
		FROM "StockMovement"
		WHERE "companyId" = $1
		  AND "createdAt" >= $2
		GROUP BY DATE("createdAt"), type
	`, companyID, start)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day time.Time
		var movementType string
		var qty float64
		if err := rows.Scan(&day, &movementType, &qty); err != nil {
			rows.Close()
			return nil, err
		}
		key := day.UTC().Format("2006-01-02")
		if _, ok := daily[key]; !ok {
			daily[key] = &dayStat{}
		}
		if movementType == "IN" {
			daily[key].In += qty
		}
		if movementType == "OUT" {
			daily[key].Out += qty
		}
	}
	rows.Close()

	keys := make([]string, 0, len(daily))
	for k := range daily {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	dailyOut := make([]map[string]any, 0, len(keys))
	for _, key := range keys {
		dailyOut = append(dailyOut, map[string]any{
			"date": key,
			"in":   round2(daily[key].In),
			"out":  round2(daily[key].Out),
		})
	}

	topRows, err := s.pool.Query(ctx, `
		SELECT p.name, COALESCE(SUM(sm.quantity), 0)::float8 AS qty
		FROM "StockMovement" sm
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE sm."companyId" = $1
		  AND sm."createdAt" >= $2
		  AND sm.type = 'OUT'
		GROUP BY p.name
		ORDER BY qty DESC
		LIMIT 5
	`, companyID, start)
	if err != nil {
		return nil, err
	}
	defer topRows.Close()

	top := make([]map[string]any, 0, 5)
	for topRows.Next() {
		var name string
		var qty float64
		if err := topRows.Scan(&name, &qty); err != nil {
			return nil, err
		}
		top = append(top, map[string]any{
			"name":  name,
			"value": round2(qty),
		})
	}

	return map[string]any{
		"daily":       dailyOut,
		"topProducts": top,
	}, nil
}

func shortID(v *string, fallback string) string {
	if v == nil || strings.TrimSpace(*v) == "" {
		return fallback
	}
	id := strings.TrimSpace(*v)
	if len(id) > 8 {
		id = id[:8]
	}
	return strings.ToUpper(id)
}

func decodeJSONItems(raw []byte) []map[string]any {
	if len(raw) == 0 {
		return nil
	}
	var out []map[string]any
	_ = json.Unmarshal(raw, &out)
	return out
}
