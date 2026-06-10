package stock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DispatchLine struct {
	ProductVariantID string
	Quantity         float64
	Label            string
}

func warehouseSkipsDispatchStockGuard(fieldConfig []byte) bool {
	if len(fieldConfig) == 0 {
		return false
	}
	var fc map[string]any
	if err := json.Unmarshal(fieldConfig, &fc); err != nil {
		return false
	}
	v, ok := fc["showTotalStock"]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && !b
}

// AssertDispatchStockAvailable — jo'natma yuborishdan oldin ombor qoldig'ini tekshiradi.
func AssertDispatchStockAvailable(
	ctx context.Context,
	client queryRower,
	companyID, warehouseID string,
	lines []DispatchLine,
) error {
	if len(lines) == 0 {
		return nil
	}

	var whName string
	var fieldConfig []byte
	err := client.QueryRow(ctx, `
		SELECT name, "fieldConfig" FROM "Warehouse" WHERE id = $1 AND "companyId" = $2
	`, warehouseID, companyID).Scan(&whName, &fieldConfig)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrWarehouseNF
	}
	if err != nil {
		return err
	}
	if warehouseSkipsDispatchStockGuard(fieldConfig) {
		return nil
	}

	aggregated := map[string]struct {
		qty   float64
		label string
	}{}
	for _, line := range lines {
		if line.Quantity <= 0 {
			continue
		}
		prev := aggregated[line.ProductVariantID]
		label := line.Label
		if label == "" {
			label = prev.label
		}
		if label == "" {
			label = line.ProductVariantID
		}
		aggregated[line.ProductVariantID] = struct {
			qty   float64
			label string
		}{prev.qty + line.Quantity, label}
	}
	if len(aggregated) == 0 {
		return nil
	}

	variantIDs := make([]string, 0, len(aggregated))
	for id := range aggregated {
		variantIDs = append(variantIDs, id)
	}

	rows, err := client.Query(ctx, `
		SELECT "productVariantId", quantity
		FROM "StockBalance"
		WHERE "companyId" = $1 AND "warehouseId" = $2 AND "productVariantId" = ANY($3)
	`, companyID, warehouseID, variantIDs)
	if err != nil {
		return err
	}
	defer rows.Close()

	available := map[string]float64{}
	for rows.Next() {
		var variantID string
		var qty float64
		if err := rows.Scan(&variantID, &qty); err != nil {
			return err
		}
		available[variantID] = qty
	}
	if err := rows.Err(); err != nil {
		return err
	}

	shortages := []string{}
	for variantID, row := range aggregated {
		avail := available[variantID]
		if avail < row.qty {
			shortages = append(shortages, fmt.Sprintf("%s: kerak %g, omborda %g", row.label, row.qty, avail))
		}
	}
	if len(shortages) > 0 {
		wh := whName
		if wh == "" {
			wh = "Ombor"
		}
		return fmt.Errorf("«%s» omborida yetarli qoldiq yo'q — %s", wh, strings.Join(shortages, "; "))
	}
	return nil
}

type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// poolQueryRower adapts pgxpool.Pool
type poolQueryRower struct{ pool *pgxpool.Pool }

func (p poolQueryRower) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return p.pool.QueryRow(ctx, sql, args...)
}
func (p poolQueryRower) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return p.pool.Query(ctx, sql, args...)
}

// txQueryRower adapts pgx.Tx
type txQueryRower struct{ tx pgx.Tx }

func (t txQueryRower) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return t.tx.QueryRow(ctx, sql, args...)
}
func (t txQueryRower) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return t.tx.Query(ctx, sql, args...)
}

func PoolQueryRower(pool *pgxpool.Pool) queryRower { return poolQueryRower{pool} }
func TxQueryRower(tx pgx.Tx) queryRower            { return txQueryRower{tx} }

func AssertDispatchStockAvailablePool(ctx context.Context, pool *pgxpool.Pool, companyID, warehouseID string, lines []DispatchLine) error {
	return AssertDispatchStockAvailable(ctx, PoolQueryRower(pool), companyID, warehouseID, lines)
}

func AssertDispatchStockAvailableTx(ctx context.Context, tx pgx.Tx, companyID, warehouseID string, lines []DispatchLine) error {
	return AssertDispatchStockAvailable(ctx, TxQueryRower(tx), companyID, warehouseID, lines)
}
