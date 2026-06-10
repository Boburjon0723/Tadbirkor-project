package products

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

type importLedgerAccumulator struct {
	amounts      map[string]float64
	inboundLines int
	summaryParts []string
}

func newImportLedgerAccumulator() *importLedgerAccumulator {
	return &importLedgerAccumulator{amounts: map[string]float64{}}
}

func trackImportStockInbound(acc *importLedgerAccumulator, qty, purchasePrice float64, currency, label string) {
	q := math.Abs(qty)
	if q <= 0 {
		return
	}
	price := math.Max(0, purchasePrice)
	amount := q * price
	cur := strings.ToUpper(strings.TrimSpace(currency))
	if cur != "USD" {
		cur = "UZS"
	}
	acc.amounts[cur] += amount
	acc.inboundLines++
	if len(acc.summaryParts) < 8 {
		acc.summaryParts = append(acc.summaryParts, fmt.Sprintf("%s ×%g", label, q))
	}
}

func ledgerAmountsFromAccumulator(acc *importLedgerAccumulator) []struct {
	Currency string
	Amount   float64
} {
	if acc == nil {
		return nil
	}
	out := []struct {
		Currency string
		Amount   float64
	}{}
	for cur, amount := range acc.amounts {
		if amount > 0 {
			out = append(out, struct {
				Currency string
				Amount   float64
			}{Currency: cur, Amount: amount})
		}
	}
	return out
}

func ledgerProductSummary(acc *importLedgerAccumulator) string {
	if acc == nil || len(acc.summaryParts) == 0 {
		return ""
	}
	base := strings.Join(acc.summaryParts, ", ")
	if acc.inboundLines > len(acc.summaryParts) {
		base += fmt.Sprintf(" +%d boshqa", acc.inboundLines-len(acc.summaryParts))
	}
	return base
}

func (s *Service) linkPartnerLedgerFromImport(ctx context.Context, companyID, userID, contactID, sourceID string, acc *importLedgerAccumulator) {
	if strings.TrimSpace(contactID) == "" || strings.TrimSpace(sourceID) == "" || acc == nil || acc.inboundLines == 0 {
		return
	}
	amounts := ledgerAmountsFromAccumulator(acc)
	if len(amounts) == 0 {
		return
	}
	summary := ledgerProductSummary(acc)
	notes := fmt.Sprintf("Excel import: %d ta kirim qatori", acc.inboundLines)
	if err := s.recordFromStockInbound(ctx, companyID, userID, contactID, sourceID, amounts, summary, notes); err != nil {
		// Nest kabi: daftar xatosi importni to'xtatmaydi
		_ = err
	}
}

func (s *Service) recordFromStockInbound(
	ctx context.Context,
	companyID, userID, contactID, sourceID string,
	amounts []struct {
		Currency string
		Amount   float64
	},
	productSummary, notes string,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var exists string
	err = tx.QueryRow(ctx, `SELECT id FROM "PartnerLedgerContact" WHERE id = $1 AND "companyId" = $2`, contactID, companyID).Scan(&exists)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("hamkor topilmadi")
		}
		return err
	}

	operationDate := time.Now().UTC()
	for _, line := range amounts {
		if line.Amount <= 0 {
			continue
		}
		currency := strings.ToUpper(line.Currency)
		if currency != "USD" {
			currency = "UZS"
		}
		amount := math.Abs(line.Amount)

		var existingID string
		err = tx.QueryRow(ctx, `
			SELECT id FROM "PartnerLedgerOperation"
			WHERE "companyId" = $1 AND "sourceType" = 'STOCK_IN_EXCEL' AND "sourceId" = $2 AND currency = $3 AND "reversedById" IS NULL
		`, companyID, sourceID, currency).Scan(&existingID)
		if err == nil {
			continue
		}

		id := uuid.NewString()
		_, err = tx.Exec(ctx, `
			INSERT INTO "PartnerLedgerOperation" (
				id, "companyId", "contactId", type, amount, currency, "operationDate", notes,
				"createdById", "sourceType", "sourceId", "productSummary", "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, 'MATERIAL_IN', $4, $5, $6, $7, $8, 'STOCK_IN_EXCEL', $9, $10, NOW(), NOW())
		`, id, companyID, contactID, amount, currency, operationDate, nullStr(notes), userID, sourceID, nullStr(productSummary))
		if err != nil {
			return err
		}
		newData, _ := json.Marshal(map[string]any{
			"sourceType": "STOCK_IN_EXCEL", "sourceId": sourceID, "type": "MATERIAL_IN",
			"amount": amount, "currency": currency,
		})
		_, _ = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES ($1, $2, $3, 'partner_ledger.linked_from_stock', 'PARTNER_LEDGER_OPERATION', $4, $5, NOW())
		`, uuid.NewString(), companyID, userID, id, newData)
	}
	return tx.Commit(ctx)
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
