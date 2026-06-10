package stock

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ReservationItem struct {
	ProductVariantID string
	WarehouseID      string
	Quantity         float64
}

type CreateReservationResult struct {
	Success     bool
	FailedItems []struct {
		ProductVariantID string
		Reason           string
	}
}

type FulfillmentLine struct {
	ProductVariantID string
	Quantity         float64
}

type PartialReservationResult struct {
	Success     bool
	IsFull      bool
	ReservedAny bool
	FailedItems []struct {
		ProductVariantID string
		Reason           string
	}
}

func HasActiveReservations(ctx context.Context, client queryRower, orderID string) (bool, error) {
	var count int
	err := client.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "StockReservation" WHERE "orderId" = $1 AND status = 'ACTIVE'
	`, orderID).Scan(&count)
	return count > 0, err
}

func GetActiveReservationWarehouse(ctx context.Context, client queryRower, orderID string) (string, error) {
	var warehouseID string
	err := client.QueryRow(ctx, `
		SELECT "warehouseId" FROM "StockReservation"
		WHERE "orderId" = $1 AND status = 'ACTIVE'
		LIMIT 1
	`, orderID).Scan(&warehouseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return warehouseID, err
}

func getFreeStock(ctx context.Context, client queryRower, companyID, warehouseID, variantID string) (onHand, reserved, blocked, free float64, err error) {
	err = client.QueryRow(ctx, `
		SELECT COALESCE(quantity, 0), COALESCE("reservedQuantity", 0), COALESCE("blockedQuantity", 0)
		FROM "StockBalance"
		WHERE "companyId" = $1 AND "warehouseId" = $2 AND "productVariantId" = $3
	`, companyID, warehouseID, variantID).Scan(&onHand, &reserved, &blocked)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, 0, 0, nil
	}
	if err != nil {
		return 0, 0, 0, 0, err
	}
	free = onHand - reserved - blocked
	if free < 0 {
		free = 0
	}
	return onHand, reserved, blocked, free, nil
}

func CreateReservationTx(
	ctx context.Context,
	tx pgx.Tx,
	orderID, companyID string,
	items []ReservationItem,
) (CreateReservationResult, error) {
	client := txQueryRower{tx}
	result := CreateReservationResult{Success: true}

	for _, item := range items {
		if item.ProductVariantID == "" || item.Quantity <= 0 {
			continue
		}
		_, reserved, blocked, free, err := getFreeStock(ctx, client, companyID, item.WarehouseID, item.ProductVariantID)
		if err != nil {
			return result, err
		}
		if blocked > 0 {
			result.Success = false
			result.FailedItems = append(result.FailedItems, struct {
				ProductVariantID string
				Reason           string
			}{item.ProductVariantID, fmt.Sprintf("Inventarizatsiya bloki mavjud (%g dona bloklangan)", blocked)})
			continue
		}
		if free < item.Quantity {
			result.Success = false
			result.FailedItems = append(result.FailedItems, struct {
				ProductVariantID string
				Reason           string
			}{item.ProductVariantID, fmt.Sprintf("Yetarli qoldiq yo'q: kerak %g, erkin %g", item.Quantity, free)})
			continue
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO "StockReservation" (
				id, "companyId", "warehouseId", "productVariantId", "orderId", quantity, status, "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
		`, uuid.NewString(), companyID, item.WarehouseID, item.ProductVariantID, orderID, item.Quantity)
		if err != nil {
			return result, err
		}

		_, err = tx.Exec(ctx, `
			UPDATE "StockBalance"
			SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = NOW()
			WHERE "warehouseId" = $2 AND "productVariantId" = $3
		`, item.Quantity, item.WarehouseID, item.ProductVariantID)
		if err != nil {
			return result, err
		}
		_ = reserved
	}
	return result, nil
}

func ConsumeReservationForShipmentTx(
	ctx context.Context,
	tx pgx.Tx,
	orderID string,
	items []struct {
		ProductVariantID string
		Quantity         float64
	},
) error {
	for _, item := range items {
		if item.ProductVariantID == "" || item.Quantity <= 0 {
			continue
		}
		remaining := item.Quantity

		rows, err := tx.Query(ctx, `
			SELECT id, "warehouseId", "productVariantId", quantity
			FROM "StockReservation"
			WHERE "orderId" = $1 AND "productVariantId" = $2 AND status = 'ACTIVE'
			ORDER BY "createdAt" ASC
		`, orderID, item.ProductVariantID)
		if err != nil {
			return err
		}

		type resRow struct {
			id, warehouseID, variantID string
			qty                        float64
		}
		reservations := []resRow{}
		for rows.Next() {
			var r resRow
			if err := rows.Scan(&r.id, &r.warehouseID, &r.variantID, &r.qty); err != nil {
				rows.Close()
				return err
			}
			reservations = append(reservations, r)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}

		for _, res := range reservations {
			if remaining <= 0 {
				break
			}
			take := res.qty
			if take > remaining {
				take = remaining
			}
			remaining -= take

			if take >= res.qty {
				_, err = tx.Exec(ctx, `UPDATE "StockReservation" SET status = 'CONSUMED', "updatedAt" = NOW() WHERE id = $1`, res.id)
			} else {
				_, err = tx.Exec(ctx, `
					UPDATE "StockReservation" SET quantity = quantity - $1, "updatedAt" = NOW() WHERE id = $2
				`, take, res.id)
			}
			if err != nil {
				return err
			}

			_, err = tx.Exec(ctx, `
				UPDATE "StockBalance"
				SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - $1), "updatedAt" = NOW()
				WHERE "warehouseId" = $2 AND "productVariantId" = $3
			`, take, res.warehouseID, res.variantID)
			if err != nil {
				return err
			}
		}

		if remaining > 0 {
			return fmt.Errorf("Rezerv yetarli emas: variant %s, kerak yana %g", item.ProductVariantID, remaining)
		}
	}
	return nil
}

func FormatReservationFailures(result CreateReservationResult) string {
	parts := make([]string, 0, len(result.FailedItems))
	for _, f := range result.FailedItems {
		parts = append(parts, f.Reason)
	}
	return strings.Join(parts, "; ")
}

func AssertCanFulfillOrder(
	ctx context.Context,
	client queryRower,
	companyID, warehouseID string,
	lines []FulfillmentLine,
) error {
	for _, line := range lines {
		if line.ProductVariantID == "" || line.Quantity <= 0 {
			continue
		}
		_, _, blocked, free, err := getFreeStock(ctx, client, companyID, warehouseID, line.ProductVariantID)
		if err != nil {
			return err
		}
		if blocked > 0 {
			return fmt.Errorf("Inventarizatsiya bloki mavjud (%s)", line.ProductVariantID)
		}
		if free < line.Quantity {
			return fmt.Errorf("Yetarli qoldiq yo'q: kerak %g, erkin %g", line.Quantity, free)
		}
	}
	return nil
}

func AssertCanFulfillOrderTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, warehouseID string,
	lines []FulfillmentLine,
) error {
	return AssertCanFulfillOrder(ctx, TxQueryRower(tx), companyID, warehouseID, lines)
}

func ResolveWarehouseForOrder(
	ctx context.Context,
	client queryRower,
	companyID string,
	lines []FulfillmentLine,
) (string, error) {
	if len(lines) == 0 {
		return "", nil
	}
	rows, err := client.Query(ctx, `
		SELECT id
		FROM "Warehouse"
		WHERE "companyId" = $1 AND status = 'ACTIVE'
		ORDER BY "createdAt" ASC
	`, companyID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	for rows.Next() {
		var warehouseID string
		if err := rows.Scan(&warehouseID); err != nil {
			return "", err
		}
		if err := AssertCanFulfillOrder(ctx, client, companyID, warehouseID, lines); err == nil {
			return warehouseID, nil
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return "", nil
}

func ResolveWarehouseForOrderPool(
	ctx context.Context,
	pool queryRower,
	companyID string,
	lines []FulfillmentLine,
) (string, error) {
	return ResolveWarehouseForOrder(ctx, pool, companyID, lines)
}

func CreatePartialReservationTx(
	ctx context.Context,
	tx pgx.Tx,
	orderID, companyID string,
	items []ReservationItem,
) (PartialReservationResult, error) {
	client := txQueryRower{tx}
	result := PartialReservationResult{IsFull: true}
	for _, item := range items {
		if item.ProductVariantID == "" || item.Quantity <= 0 {
			continue
		}
		_, _, blocked, free, err := getFreeStock(ctx, client, companyID, item.WarehouseID, item.ProductVariantID)
		if err != nil {
			return result, err
		}
		if blocked > 0 {
			result.IsFull = false
			result.FailedItems = append(result.FailedItems, struct {
				ProductVariantID string
				Reason           string
			}{
				ProductVariantID: item.ProductVariantID,
				Reason:           fmt.Sprintf("Inventarizatsiya bloki mavjud (%g dona bloklangan)", blocked),
			})
			continue
		}
		if free <= 0 {
			result.IsFull = false
			result.FailedItems = append(result.FailedItems, struct {
				ProductVariantID string
				Reason           string
			}{
				ProductVariantID: item.ProductVariantID,
				Reason:           "Erkin qoldiq mavjud emas",
			})
			continue
		}
		reserveQty := item.Quantity
		if free < reserveQty {
			reserveQty = free
			result.IsFull = false
			result.FailedItems = append(result.FailedItems, struct {
				ProductVariantID string
				Reason           string
			}{
				ProductVariantID: item.ProductVariantID,
				Reason:           fmt.Sprintf("Qisman rezerv: kerak %g, rezerv qilindi %g", item.Quantity, reserveQty),
			})
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO "StockReservation" (
				id, "companyId", "warehouseId", "productVariantId", "orderId", quantity, status, "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
		`, uuid.NewString(), companyID, item.WarehouseID, item.ProductVariantID, orderID, reserveQty)
		if err != nil {
			return result, err
		}
		_, err = tx.Exec(ctx, `
			UPDATE "StockBalance"
			SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = NOW()
			WHERE "warehouseId" = $2 AND "productVariantId" = $3
		`, reserveQty, item.WarehouseID, item.ProductVariantID)
		if err != nil {
			return result, err
		}
		result.ReservedAny = true
	}
	result.Success = result.ReservedAny
	return result, nil
}

func ReleaseReservationTx(ctx context.Context, tx pgx.Tx, orderID, status string) error {
	if status == "" {
		status = "RELEASED"
	}
	_, err := tx.Exec(ctx, `
		UPDATE "StockBalance" sb
		SET "reservedQuantity" = GREATEST(0, sb."reservedQuantity" - src.qty),
		    "updatedAt" = NOW()
		FROM (
			SELECT "warehouseId", "productVariantId", SUM(quantity)::float8 AS qty
			FROM "StockReservation"
			WHERE "orderId" = $1 AND status = 'ACTIVE'
			GROUP BY "warehouseId", "productVariantId"
		) src
		WHERE sb."warehouseId" = src."warehouseId"
		  AND sb."productVariantId" = src."productVariantId"
	`, orderID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE "StockReservation"
		SET status = $2, "updatedAt" = NOW()
		WHERE "orderId" = $1 AND status = 'ACTIVE'
	`, orderID, status)
	return err
}
