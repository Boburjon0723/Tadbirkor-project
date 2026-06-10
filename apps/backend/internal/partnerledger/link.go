package partnerledger

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func buildAmountsFromVariant(salePrice, purchasePrice float64, currency string, quantity float64, direction string) []amountLine {
	qty := math.Abs(quantity)
	price := salePrice
	if direction == "IN" {
		price = purchasePrice
	}
	amount := qty * price
	if amount <= 0 {
		return []amountLine{{Amount: 0, Currency: currency}}
	}
	return []amountLine{{Amount: amount, Currency: currency}}
}

func recordFromStockOutboundTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, contactID, sourceType, sourceID string,
	amounts []amountLine,
	quantity *float64,
	productSummary, notes string,
	operationDate time.Time,
) ([]string, error) {
	lines := []amountLine{}
	for _, a := range amounts {
		if a.Amount > 0 {
			lines = append(lines, a)
		}
	}
	if len(lines) == 0 {
		return nil, errBadRequest("Daftar summasi hisoblanmadi")
	}

	operationIDs := []string{}
	for _, line := range lines {
		currency := NormalizeCurrency(line.Currency)
		amount := math.Abs(line.Amount)

		var existingID string
		err := tx.QueryRow(ctx, `
			SELECT id FROM "PartnerLedgerOperation"
			WHERE "companyId" = $1 AND "sourceType" = $2 AND "sourceId" = $3 AND currency = $4 AND "reversedById" IS NULL
		`, companyID, sourceType, sourceID, currency).Scan(&existingID)
		if err == nil {
			operationIDs = append(operationIDs, existingID)
			continue
		}

		id := uuid.NewString()
		var qtyVal any
		if quantity != nil {
			qtyVal = *quantity
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO "PartnerLedgerOperation" (
				id, "companyId", "contactId", type, amount, currency, "operationDate", notes,
				"createdById", "sourceType", "sourceId", quantity, "productSummary", "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, 'SALE_OUT', $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
		`, id, companyID, contactID, amount, currency, operationDate, nullIfEmpty(notes), userID,
			sourceType, sourceID, qtyVal, nullIfEmpty(productSummary))
		if err != nil {
			return nil, err
		}

		newData, _ := json.Marshal(map[string]any{
			"sourceType": sourceType, "sourceId": sourceID, "type": "SALE_OUT",
			"amount": amount, "currency": currency,
		})
		_, _ = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES ($1, $2, $3, 'partner_ledger.linked_from_stock', 'PARTNER_LEDGER_OPERATION', $4, $5, NOW())
		`, uuid.NewString(), companyID, userID, id, newData)

		operationIDs = append(operationIDs, id)
	}
	return operationIDs, nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func isStockLinked(sourceType, sourceID *string) bool {
	if sourceType == nil || sourceID == nil || *sourceType == "" || *sourceID == "" {
		return false
	}
	st := *sourceType
	return strings.HasPrefix(st, "STOCK_") || st == "PARTNER_SALE_ORDER"
}

func assertOperationType(t string) error {
	for _, allowed := range OperationTypes {
		if allowed == t {
			return nil
		}
	}
	return errBadRequest("Operatsiya turi noto'g'ri")
}

func buildLedgerNotes(input CreatePartnerLedgerSaleOrderInput, contactName string) string {
	parts := []string{fmt.Sprintf("Buyurtma: %s", contactName)}
	if input.SettlementType != nil && *input.SettlementType != "" {
		label := SettlementLabels[*input.SettlementType]
		if label == "" {
			label = *input.SettlementType
		}
		parts = append(parts, "To'lov: "+label)
	}
	if input.SettlementNote != nil && strings.TrimSpace(*input.SettlementNote) != "" {
		parts = append(parts, "Hamkor beradi: "+strings.TrimSpace(*input.SettlementNote))
	}
	if input.Notes != nil && strings.TrimSpace(*input.Notes) != "" {
		parts = append(parts, strings.TrimSpace(*input.Notes))
	}
	return strings.Join(parts, " · ")
}
