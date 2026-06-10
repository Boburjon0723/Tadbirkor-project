package pos

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
)

var (
	ErrVariantNotFound = errors.New("Mahsulot varianti topilmadi")
	ErrVariantInactive = errors.New("Variant aktiv emas")
	ErrMixedCurrency   = errors.New("Bitta chekda turli valyutali mahsulotlar bo'lmaydi")
)

type resolvedItem struct {
	ProductVariantID    string
	ProductNameSnapshot string
	SkuSnapshot         *string
	BarcodeSnapshot     *string
	Quantity            float64
	ListPrice           float64
	UnitPrice           float64
	LineTotal           float64
	Currency            string
}

type priceContext struct {
	perms  []string
	maxPct float64
}

func round2(n float64) float64 {
	return math.Round(n*100) / 100
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (s *Service) loadPriceContext(ctx context.Context, companyID, userID string, q rowQuerier) (priceContext, error) {
	var role string
	var grant, deny []string
	var maxPct *float64
	err := q.QueryRow(ctx, `
		SELECT cu.role, cu."grantPermissions", cu."denyPermissions", c."posMaxDiscountPercent"
		FROM "CompanyUser" cu
		JOIN "Company" c ON c.id = cu."companyId"
		WHERE cu."companyId" = $1 AND cu."userId" = $2 LIMIT 1
	`, companyID, userID).Scan(&role, &grant, &deny, &maxPct)
	if err != nil {
		return priceContext{perms: permissions.Effective("SALES", nil, nil), maxPct: 15}, nil
	}
	max := 15.0
	if maxPct != nil {
		max = *maxPct
	}
	return priceContext{perms: permissions.Effective(role, grant, deny), maxPct: max}, nil
}

func (ctx priceContext) validatePrice(listPrice, unitPrice float64, label string) error {
	if unitPrice < 0 {
		return errors.New("Narx manfiy bo'lishi mumkin emas")
	}
	if unitPrice >= listPrice-0.001 {
		return nil
	}
	for _, p := range ctx.perms {
		if p == "pos.override_price" {
			return nil
		}
	}
	hasChange := false
	for _, p := range ctx.perms {
		if p == "pos.change_price" {
			hasChange = true
			break
		}
	}
	if !hasChange {
		return fmt.Errorf("«%s»: narxni o'zgartirish ruxsati yo'q", label)
	}
	discountPct := 0.0
	if listPrice > 0 {
		discountPct = ((listPrice - unitPrice) / listPrice) * 100
	}
	if discountPct > ctx.maxPct+0.01 {
		return fmt.Errorf("«%s»: chegirma %.1f%% — ruxsat %.0f%% gacha", label, discountPct, ctx.maxPct)
	}
	return nil
}

func (s *Service) resolveItems(ctx context.Context, tx pgx.Tx, companyID, userID string, items []SaleItemInput, pctx *priceContext) ([]resolvedItem, error) {
	if len(items) == 0 {
		return nil, nil
	}
	ctxPrice := *pctx
	if pctx == nil {
		var err error
		ctxPrice, err = s.loadPriceContext(ctx, companyID, userID, tx)
		if err != nil {
			return nil, err
		}
	}
	out := make([]resolvedItem, 0, len(items))
	for _, it := range items {
		var id, name, currency string
		var sku, barcode *string
		var salePrice float64
		var productName, status *string
		err := tx.QueryRow(ctx, `
			SELECT pv.id, pv.name, pv.sku, pv.barcode, pv."salePrice", pv.currency, pv.status, p.name
			FROM "ProductVariant" pv
			JOIN "Product" p ON p.id = pv."productId"
			WHERE pv.id = $1 AND pv."companyId" = $2
		`, it.ProductVariantID, companyID).Scan(&id, &name, &sku, &barcode, &salePrice, &currency, &status, &productName)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", ErrVariantNotFound, it.ProductVariantID)
		}
		if err != nil {
			return nil, err
		}
		if status != nil && *status != "ACTIVE" {
			return nil, fmt.Errorf("%w: %s", ErrVariantInactive, name)
		}
		listPrice := salePrice
		unitPrice := listPrice
		if it.UnitPrice != nil {
			unitPrice = *it.UnitPrice
		}
		label := name
		if productName != nil && *productName != "" {
			label = *productName + " — " + name
		}
		if err := ctxPrice.validatePrice(listPrice, unitPrice, label); err != nil {
			return nil, err
		}
		qty := it.Quantity
		if qty <= 0 {
			return nil, errors.New("Miqdor 0 dan katta bo'lishi kerak")
		}
		if currency == "" {
			currency = "UZS"
		}
		out = append(out, resolvedItem{
			ProductVariantID: id, ProductNameSnapshot: label,
			SkuSnapshot: sku, BarcodeSnapshot: barcode,
			Quantity: qty, ListPrice: listPrice, UnitPrice: unitPrice,
			LineTotal: round2(unitPrice * qty), Currency: currency,
		})
	}
	return out, nil
}

func calcTotals(resolved []resolvedItem, discountAmount float64) (subtotal, total, discount float64, err error) {
	subtotal = 0
	for _, it := range resolved {
		subtotal += it.LineTotal
	}
	subtotal = round2(subtotal)
	discount = round2(math.Max(0, discountAmount))
	if discount > subtotal {
		discount = subtotal
	}
	total = round2(subtotal - discount)
	return subtotal, total, discount, nil
}

func resolveCurrency(resolved []resolvedItem) (string, error) {
	if len(resolved) == 0 {
		return "UZS", nil
	}
	cur := resolved[0].Currency
	for _, it := range resolved[1:] {
		if it.Currency != cur {
			return "", ErrMixedCurrency
		}
	}
	return cur, nil
}

func (s *Service) generateSaleNumber(ctx context.Context, tx pgx.Tx, companyID string) (string, error) {
	var dateStr string
	if err := tx.QueryRow(ctx, `SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD')`).Scan(&dateStr); err != nil {
		return "", err
	}
	var lockKey int64
	if err := tx.QueryRow(ctx, `SELECT hashtextextended($1, 0)`, companyID+"|pos|"+dateStr).Scan(&lockKey); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockKey); err != nil {
		return "", err
	}
	var count int
	err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "PosSale"
		WHERE "companyId" = $1
		  AND "createdAt" >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
		  AND "createdAt" < date_trunc('day', NOW() AT TIME ZONE 'UTC') + interval '1 day'
	`, companyID).Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("POS-%s-%06d", dateStr, count+1), nil
}
