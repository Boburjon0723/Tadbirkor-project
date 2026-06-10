package inventorycounts

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const blockChunkSize = 25

type balanceRow struct {
	ProductVariantID string
	Quantity         float64
}

func applyInventoryBlocks(ctx context.Context, tx pgx.Tx, countID, companyID, warehouseID, userID string, balances []balanceRow) error {
	for i := 0; i < len(balances); i += blockChunkSize {
		end := i + blockChunkSize
		if end > len(balances) {
			end = len(balances)
		}
		chunk := balances[i:end]
		for _, b := range chunk {
			if b.Quantity <= 0 {
				continue
			}
			_, err := tx.Exec(ctx, `
				INSERT INTO "StockBlock" (
					id, "companyId", "warehouseId", "productVariantId",
					reason, "sourceId", "blockedQty", "createdBy"
				) VALUES ($1, $2, $3, $4, 'INVENTORY_COUNT', $5, $6, $7)
				ON CONFLICT ("warehouseId", "productVariantId", reason, "sourceId") DO NOTHING
			`, uuid.NewString(), companyID, warehouseID, b.ProductVariantID, countID, b.Quantity, userID)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `
				UPDATE "StockBalance"
				SET "blockedQuantity" = COALESCE("blockedQuantity", 0) + $1
				WHERE "warehouseId" = $2 AND "productVariantId" = $3
			`, b.Quantity, warehouseID, b.ProductVariantID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func releaseBlocksForCount(ctx context.Context, pool interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	Begin(context.Context) (pgx.Tx, error)
}, countID, companyID string) error {
	rows, err := pool.Query(ctx, `
		SELECT id, "warehouseId", "productVariantId", "blockedQty"
		FROM "StockBlock"
		WHERE "companyId" = $1 AND reason = 'INVENTORY_COUNT' AND "sourceId" = $2 AND "removedAt" IS NULL
	`, companyID, countID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type block struct {
		id, warehouseID, variantID string
		qty                        float64
	}
	blocks := []block{}
	for rows.Next() {
		var b block
		if err := rows.Scan(&b.id, &b.warehouseID, &b.variantID, &b.qty); err != nil {
			return err
		}
		blocks = append(blocks, b)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(blocks) == 0 {
		return nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, b := range blocks {
		_, err = tx.Exec(ctx, `UPDATE "StockBlock" SET "removedAt" = NOW() WHERE id = $1`, b.id)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			UPDATE "StockBalance"
			SET "blockedQuantity" = GREATEST(0, COALESCE("blockedQuantity", 0) - $1)
			WHERE "warehouseId" = $2 AND "productVariantId" = $3
		`, b.qty, b.warehouseID, b.variantID)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
