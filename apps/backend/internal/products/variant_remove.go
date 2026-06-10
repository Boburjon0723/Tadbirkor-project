package products

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Service) removeVariantOnUpdate(ctx context.Context, tx pgx.Tx, companyID, userID, productID, variantID string) error {
	variantID = trimID(variantID)
	if variantID == "" {
		return nil
	}
	var pid string
	err := tx.QueryRow(ctx, `
		SELECT "productId" FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2
	`, variantID, companyID).Scan(&pid)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if pid != productID {
		return ErrBadStockAdjust
	}

	var deps int
	_ = tx.QueryRow(ctx, `
		SELECT (
			(SELECT COUNT(*)::int FROM "StockMovement" WHERE "productVariantId" = $1) +
			(SELECT COUNT(*)::int FROM "StockBalance" WHERE "productVariantId" = $1 AND quantity > 0) +
			(SELECT COUNT(*)::int FROM "B2BOrderItem" WHERE "productVariantId" = $1) +
			(SELECT COUNT(*)::int FROM "DispatchItem" WHERE "productVariantId" = $1)
		)
	`, variantID).Scan(&deps)

	if deps > 0 {
		_, err = tx.Exec(ctx, `
			UPDATE "ProductVariant" SET status = 'ARCHIVED', "updatedAt" = NOW()
			WHERE id = $1 AND "companyId" = $2
		`, variantID, companyID)
		if err != nil {
			return err
		}
		_, _ = tx.Exec(ctx, `
			UPDATE "ProductMapping" SET status = 'INACTIVE', "updatedAt" = NOW()
			WHERE "ownProductVariantId" = $1
		`, variantID)
		_, _ = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES ($1, $2, $3, 'variant.archived', 'PRODUCT_VARIANT', $4,
			        jsonb_build_object('reason', 'removed_from_product_update'), NOW())
		`, uuid.NewString(), companyID, userID, variantID)
		return nil
	}

	_, err = tx.Exec(ctx, `DELETE FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2`, variantID, companyID)
	return err
}

func trimID(id string) string {
	return strings.TrimSpace(id)
}
