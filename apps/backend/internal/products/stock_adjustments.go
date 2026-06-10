package products

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
)

var ErrBadStockAdjust = errors.New("Zaxira tuzatish faqat shu mahsulot variantlari uchun mumkin")

func (s *Service) applyStockAdjustmentsInTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, productID string,
	adjustments []StockAdjustmentInput,
) error {
	if len(adjustments) == 0 {
		return nil
	}

	rows, err := tx.Query(ctx, `
		SELECT id FROM "ProductVariant"
		WHERE "companyId" = $1 AND "productId" = $2 AND status <> 'ARCHIVED'
	`, companyID, productID)
	if err != nil {
		return err
	}
	defer rows.Close()

	variantIDs := map[string]struct{}{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		variantIDs[id] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, adj := range adjustments {
		signedQty := adj.Quantity
		if !isFinite(signedQty) || signedQty == 0 {
			continue
		}

		variantID := strings.TrimSpace(adj.ProductVariantID)
		warehouseID := strings.TrimSpace(adj.WarehouseID)
		if variantID == "" || warehouseID == "" {
			return ErrBadInput
		}
		if _, ok := variantIDs[variantID]; !ok {
			return ErrBadStockAdjust
		}

		var wh string
		err := tx.QueryRow(ctx, `
			SELECT id FROM "Warehouse"
			WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
		`, warehouseID, companyID).Scan(&wh)
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("Tanlangan ombor topilmadi yoki nofaol")
		}
		if err != nil {
			return err
		}

		movementType := "IN"
		qty := math.Abs(signedQty)
		if signedQty < 0 {
			movementType = "OUT"
		}
		note := "Mahsulot kartochkasidan zaxira tuzatish"
		if adj.Note != nil && strings.TrimSpace(*adj.Note) != "" {
			note = strings.TrimSpace(*adj.Note)
		}

		line := stock.Line{
			WarehouseID:      warehouseID,
			ProductVariantID: variantID,
			Quantity:         qty,
			Note:             note,
		}

		var movementID string
		if movementType == "IN" {
			movementID, err = stock.RecordOneInTx(ctx, tx, companyID, userID, line, "ADJUSTMENT")
		} else {
			movementID, err = stock.RecordOneOutInTx(ctx, tx, companyID, userID, "ADJUSTMENT", line)
		}
		if err != nil {
			return err
		}

		auditData, _ := json.Marshal(map[string]any{
			"warehouseId":      warehouseID,
			"productVariantId": variantID,
			"quantity":         signedQty,
			"movementType":     movementType,
			"movementId":       movementID,
		})
		_, err = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES ($1, $2, $3, 'stock.adjusted', 'STOCK_MOVEMENT', $4, $5, NOW())
		`, uuid.NewString(), companyID, userID, movementID, auditData)
		if err != nil {
			return err
		}

		if adj.PartnerLedgerContactID != nil {
			contactID := strings.TrimSpace(*adj.PartnerLedgerContactID)
			if contactID != "" {
				if err := s.linkStockAdjustmentToLedger(ctx, tx, companyID, userID, contactID, variantID, movementID, movementType, qty, note); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func isFinite(n float64) bool {
	return !math.IsNaN(n) && !math.IsInf(n, 0)
}

func (s *Service) linkStockAdjustmentToLedger(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, contactID, variantID, movementID, movementType string,
	qty float64,
	note string,
) error {
	var exists string
	err := tx.QueryRow(ctx, `
		SELECT id FROM "PartnerLedgerContact" WHERE id = $1 AND "companyId" = $2
	`, contactID, companyID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	var variantName, productName, currency string
	var salePrice, purchasePrice float64
	err = tx.QueryRow(ctx, `
		SELECT pv.name, p.name, pv.currency, pv."salePrice", pv."purchasePrice"
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv.id = $1 AND pv."companyId" = $2
	`, variantID, companyID).Scan(&variantName, &productName, &currency, &salePrice, &purchasePrice)
	if err != nil {
		return err
	}

	price := salePrice
	opType := "SALE_OUT"
	sourceType := "STOCK_OUT_MANUAL"
	if movementType == "IN" {
		price = purchasePrice
		opType = "MATERIAL_IN"
		sourceType = "STOCK_IN_MANUAL"
	}
	amount := qty * math.Max(0, price)
	if amount <= 0 {
		return nil
	}
	cur := strings.ToUpper(strings.TrimSpace(currency))
	if cur != "USD" {
		cur = "UZS"
	}
	productSummary := fmt.Sprintf("%s / %s ×%g", productName, variantName, qty)

	var existingID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "sourceType" = $2 AND "sourceId" = $3 AND currency = $4 AND "reversedById" IS NULL
	`, companyID, sourceType, movementID, cur).Scan(&existingID)
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	opID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO "PartnerLedgerOperation" (
			id, "companyId", "contactId", type, amount, currency, "operationDate", notes,
			"createdById", "sourceType", "sourceId", quantity, "productSummary", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, NOW(), NOW())
	`, opID, companyID, contactID, opType, amount, cur, nullString(note), userID, sourceType, movementID, qty, productSummary)
	return err
}

func nullString(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
