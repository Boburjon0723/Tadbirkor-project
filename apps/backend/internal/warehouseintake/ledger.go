package warehouseintake

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func linkIntakeMovementsToLedgerTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, contactID, intakeID, note string,
) error {
	contactID = strings.TrimSpace(contactID)
	if contactID == "" {
		return nil
	}
	var exists string
	err := tx.QueryRow(ctx, `
		SELECT id FROM "PartnerLedgerContact" WHERE id = $1 AND "companyId" = $2
	`, contactID, companyID).Scan(&exists)
	if err != nil {
		return err
	}

	rows, err := tx.Query(ctx, `
		SELECT sm.id, sm."productVariantId", sm.quantity
		FROM "StockMovement" sm
		WHERE sm."companyId" = $1 AND sm."sourceType" = 'WAREHOUSE_INTAKE' AND sm."sourceId" = $2
	`, companyID, intakeID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var movementID, variantID string
		var qty float64
		if err := rows.Scan(&movementID, &variantID, &qty); err != nil {
			return err
		}
		if err := linkInboundMovementToLedgerTx(ctx, tx, companyID, userID, contactID, movementID, variantID, qty, note); err != nil {
			return err
		}
	}
	return rows.Err()
}

func linkInboundMovementToLedgerTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, contactID, movementID, variantID string,
	qty float64,
	note string,
) error {
	var variantName, productName, currency string
	var salePrice, purchasePrice float64
	err := tx.QueryRow(ctx, `
		SELECT pv.name, p.name, pv.currency, pv."salePrice", pv."purchasePrice"
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv.id = $1 AND pv."companyId" = $2
	`, variantID, companyID).Scan(&variantName, &productName, &currency, &salePrice, &purchasePrice)
	if err != nil {
		return err
	}

	amount := qty * math.Max(0, purchasePrice)
	if amount <= 0 {
		amount = qty * math.Max(0, salePrice)
	}
	if amount <= 0 {
		return nil
	}
	cur := strings.ToUpper(strings.TrimSpace(currency))
	if cur != "USD" {
		cur = "UZS"
	}

	var existingID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "sourceType" = 'STOCK_IN_MANUAL' AND "sourceId" = $2 AND currency = $3 AND "reversedById" IS NULL
	`, companyID, movementID, cur).Scan(&existingID)
	if err == nil {
		return nil
	}

	productSummary := fmt.Sprintf("%s / %s ×%g", productName, variantName, qty)
	_, err = tx.Exec(ctx, `
		INSERT INTO "PartnerLedgerOperation" (
			id, "companyId", "contactId", type, amount, currency, "operationDate", notes,
			"createdById", "sourceType", "sourceId", quantity, "productSummary", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, 'MATERIAL_IN', $4, $5, NOW(), $6, $7, 'STOCK_IN_MANUAL', $8, $9, $10, NOW(), NOW())
	`, uuid.NewString(), companyID, contactID, amount, cur, nullLedgerNote(note), userID, movementID, qty, productSummary)
	return err
}

func nullLedgerNote(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}
