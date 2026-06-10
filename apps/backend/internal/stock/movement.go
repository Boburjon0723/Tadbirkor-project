package stock

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInsufficientStock = errors.New("Omborda yetarli qoldiq yo'q")

type Line struct {
	WarehouseID      string
	ProductVariantID string
	Quantity         float64
	SourceID         string
	Note             string
}

func RecordMovements(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, movementType, sourceType string,
	lines []Line,
) error {
	qtyChange := -1.0
	if movementType == "IN" {
		qtyChange = 1.0
	}
	for _, line := range lines {
		if _, err := recordOne(ctx, tx, companyID, userID, movementType, sourceType, line, qtyChange); err != nil {
			return err
		}
	}
	return nil
}

// RecordSingle runs one movement inside a new transaction and returns movement id.
func RecordSingle(
	ctx context.Context,
	pool *pgxpool.Pool,
	companyID, userID, movementType, sourceType string,
	line Line,
) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	qtySign := -1.0
	if movementType == "IN" {
		qtySign = 1.0
	}
	id, err := recordOne(ctx, tx, companyID, userID, movementType, sourceType, line, qtySign)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

func recordOne(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, movementType, sourceType string,
	line Line,
	qtySign float64,
) (string, error) {
	qty := line.Quantity * qtySign
	var balanceID string
	var currentQty float64
	err := tx.QueryRow(ctx, `
		SELECT id, quantity FROM "StockBalance"
		WHERE "warehouseId" = $1 AND "productVariantId" = $2
		FOR UPDATE
	`, line.WarehouseID, line.ProductVariantID).Scan(&balanceID, &currentQty)
	if movementType == "OUT" {
		if errors.Is(err, pgx.ErrNoRows) || currentQty < line.Quantity {
			return "", fmt.Errorf("%w. Mavjud: %v", ErrInsufficientStock, currentQty)
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		if movementType != "IN" {
			return "", ErrInsufficientStock
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO "StockBalance" (id, "companyId", "warehouseId", "productVariantId", quantity, "reservedQuantity", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW())
		`, companyID, line.WarehouseID, line.ProductVariantID, line.Quantity)
		if err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	} else {
		newQty := currentQty + qty
		if movementType == "OUT" && newQty < 0 {
			return "", ErrInsufficientStock
		}
		_, err = tx.Exec(ctx, `UPDATE "StockBalance" SET quantity = $1, "updatedAt" = NOW() WHERE id = $2`, newQty, balanceID)
		if err != nil {
			return "", err
		}
	}
	var sourceID *string
	if line.SourceID != "" {
		sourceID = &line.SourceID
	}
	var movementID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "StockMovement" (id, "companyId", "warehouseId", "productVariantId", type, quantity, "sourceType", "sourceId", note, "createdBy", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id
	`, companyID, line.WarehouseID, line.ProductVariantID, movementType, line.Quantity, sourceType, sourceID, line.Note, userID).Scan(&movementID)
	return movementID, err
}

// RecordOneInTx records a single IN movement inside an existing transaction.
func RecordOneInTx(ctx context.Context, tx pgx.Tx, companyID, userID string, line Line, sourceType string) (string, error) {
	return recordOne(ctx, tx, companyID, userID, "IN", sourceType, line, 1)
}

// RecordOneOutInTx records a single OUT movement inside an existing transaction.
func RecordOneOutInTx(ctx context.Context, tx pgx.Tx, companyID, userID, sourceType string, line Line) (string, error) {
	return recordOne(ctx, tx, companyID, userID, "OUT", sourceType, line, -1)
}

// Pool helper for non-tx usage
func Begin(ctx context.Context, pool *pgxpool.Pool) (pgx.Tx, error) {
	return pool.Begin(ctx)
}
