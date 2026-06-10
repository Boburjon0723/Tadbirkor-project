package reports

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

func (s *Service) resolvePosReportWarehouseID(
	ctx context.Context,
	companyID, userID string,
	requestedID *string,
) (*string, error) {
	sc, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return nil, err
	}
	req := ""
	if requestedID != nil {
		req = strings.TrimSpace(*requestedID)
	}

	if !sc.All {
		if len(sc.WarehouseIDs) == 0 {
			return nil, scope.ErrNoWarehouseAssigned
		}
		if req != "" && !sc.Allowed(req) {
			return nil, fmt.Errorf("Ushbu ombor POS hisobotiga ruxsat yo'q")
		}
		if req != "" {
			return &req, nil
		}
		if sc.DefaultWarehouseID != nil && strings.TrimSpace(*sc.DefaultWarehouseID) != "" {
			x := strings.TrimSpace(*sc.DefaultWarehouseID)
			return &x, nil
		}
		x := sc.WarehouseIDs[0]
		return &x, nil
	}
	if req == "" {
		return nil, nil
	}
	return &req, nil
}

func (s *Service) GetPosSummary(
	ctx context.Context,
	companyID, userID string,
	query ReportQueryInput,
) (map[string]any, error) {
	if err := s.companies.AssertModuleEnabled(ctx, companyID, "POS"); err != nil {
		return nil, err
	}

	warehouseID, err := s.resolvePosReportWarehouseID(ctx, companyID, userID, query.WarehouseID)
	if err != nil {
		return nil, err
	}

	sql := `
		SELECT ps.id,
		       COALESCE(ps.currency, 'UZS'),
		       COALESCE(ps.subtotal, 0)::float8,
		       COALESCE(ps."discountAmount", 0)::float8,
		       COALESCE(ps."totalAmount", 0)::float8
		FROM "PosSale" ps
		WHERE ps."companyId" = $1
		  AND ps.status = 'COMPLETED'`
	args := []any{companyID}
	n := 2
	if warehouseID != nil {
		sql += fmt.Sprintf(` AND ps."warehouseId" = $%d`, n)
		args = append(args, *warehouseID)
		n++
	}
	if from := parseDateForFilter(query.DateFrom, false); from != nil {
		sql += fmt.Sprintf(` AND ps."completedAt" >= $%d`, n)
		args = append(args, *from)
		n++
	}
	if to := parseDateForFilter(query.DateTo, true); to != nil {
		sql += fmt.Sprintf(` AND ps."completedAt" <= $%d`, n)
		args = append(args, *to)
	}

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	grossSales := newBucket()
	discounts := newBucket()
	netSales := newBucket()
	cashSales := newBucket()
	cardSales := newBucket()
	creditSales := newBucket()

	receiptsCount := 0
	itemsSold := 0.0
	saleIDs := make([]string, 0, 128)
	saleCurrency := map[string]string{}

	for rows.Next() {
		var saleID, currency string
		var subtotal, discount, total float64
		if err := rows.Scan(&saleID, &currency, &subtotal, &discount, &total); err != nil {
			return nil, err
		}
		cur := normCurrency(currency)
		bucketAdd(&grossSales, cur, subtotal)
		bucketAdd(&discounts, cur, discount)
		bucketAdd(&netSales, cur, total)
		receiptsCount++
		saleIDs = append(saleIDs, saleID)
		saleCurrency[saleID] = cur
	}

	if len(saleIDs) > 0 {
		itemRows, err := s.pool.Query(ctx, `
			SELECT "saleId", COALESCE(SUM(quantity), 0)::float8
			FROM "PosSaleItem"
			WHERE "saleId" = ANY($1)
			GROUP BY "saleId"
		`, saleIDs)
		if err == nil {
			for itemRows.Next() {
				var saleID string
				var qty float64
				if err := itemRows.Scan(&saleID, &qty); err == nil {
					itemsSold += qty
				}
			}
			itemRows.Close()
		}

		paymentRows, err := s.pool.Query(ctx, `
			SELECT "saleId", method, COALESCE(amount, 0)::float8
			FROM "PosSalePayment"
			WHERE "saleId" = ANY($1)
		`, saleIDs)
		if err == nil {
			for paymentRows.Next() {
				var saleID, method string
				var amount float64
				if err := paymentRows.Scan(&saleID, &method, &amount); err == nil {
					cur := saleCurrency[saleID]
					switch strings.ToUpper(method) {
					case "CREDIT":
						bucketAdd(&creditSales, cur, amount)
					case "CARD":
						bucketAdd(&cardSales, cur, amount)
					default:
						bucketAdd(&cashSales, cur, amount)
					}
				}
			}
			paymentRows.Close()
		}
	}

	openReceivablesTotal := newBucket()
	recRows, err := s.pool.Query(ctx, `
		SELECT COALESCE(currency, 'UZS'), COALESCE(SUM("remainingAmount"), 0)::float8
		FROM "RetailReceivable"
		WHERE "companyId" = $1
		  AND status IN ('OPEN', 'PARTIAL')
		GROUP BY currency
	`, companyID)
	if err == nil {
		for recRows.Next() {
			var currency string
			var amount float64
			if err := recRows.Scan(&currency, &amount); err == nil {
				bucketAdd(&openReceivablesTotal, currency, amount)
			}
		}
		recRows.Close()
	}

	return map[string]any{
		"source":               "POS_SALE",
		"receiptsCount":        receiptsCount,
		"itemsSold":            round2(itemsSold),
		"grossSales":           roundedBucket(grossSales),
		"discounts":            roundedBucket(discounts),
		"netSales":             roundedBucket(netSales),
		"cashSales":            roundedBucket(cashSales),
		"cardSales":            roundedBucket(cardSales),
		"creditSales":          roundedBucket(creditSales),
		"openReceivablesTotal": roundedBucket(openReceivablesTotal),
	}, nil
}

func (s *Service) GetPosTopProducts(
	ctx context.Context,
	companyID, userID string,
	query ReportQueryInput,
) ([]map[string]any, error) {
	if err := s.companies.AssertModuleEnabled(ctx, companyID, "POS"); err != nil {
		return nil, err
	}

	warehouseID, err := s.resolvePosReportWarehouseID(ctx, companyID, userID, query.WarehouseID)
	if err != nil {
		return nil, err
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	sql := `
		SELECT i."productVariantId",
		       i."productNameSnapshot",
		       COALESCE(SUM(i.quantity), 0)::float8,
		       COALESCE(SUM(i."lineTotal"), 0)::float8,
		       COALESCE(MAX(ps.currency), 'UZS')
		FROM "PosSaleItem" i
		JOIN "PosSale" ps ON ps.id = i."saleId"
		WHERE ps."companyId" = $1
		  AND ps.status = 'COMPLETED'`
	args := []any{companyID}
	n := 2
	if warehouseID != nil {
		sql += fmt.Sprintf(` AND ps."warehouseId" = $%d`, n)
		args = append(args, *warehouseID)
		n++
	}
	if from := parseDateForFilter(query.DateFrom, false); from != nil {
		sql += fmt.Sprintf(` AND ps."completedAt" >= $%d`, n)
		args = append(args, *from)
		n++
	}
	if to := parseDateForFilter(query.DateTo, true); to != nil {
		sql += fmt.Sprintf(` AND ps."completedAt" <= $%d`, n)
		args = append(args, *to)
	}
	sql += `
		GROUP BY i."productVariantId", i."productNameSnapshot"
	`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type row struct {
		ProductVariantID string
		Name             string
		Qty              float64
		Revenue          float64
		Currency         string
	}
	items := make([]row, 0, 64)
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.ProductVariantID, &r.Name, &r.Qty, &r.Revenue, &r.Currency); err != nil {
			return nil, err
		}
		r.Currency = normCurrency(r.Currency)
		items = append(items, r)
	}

	sort.Slice(items, func(i, j int) bool { return items[i].Revenue > items[j].Revenue })
	if len(items) > limit {
		items = items[:limit]
	}

	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, map[string]any{
			"productVariantId": item.ProductVariantID,
			"name":             item.Name,
			"qty":              round2(item.Qty),
			"revenue":          round2(item.Revenue),
			"currency":         item.Currency,
		})
	}
	return out, nil
}
