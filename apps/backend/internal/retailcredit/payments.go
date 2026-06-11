package retailcredit

import (
	"context"
	"math"

	"github.com/jackc/pgx/v5"
)

// ApplyCashToReceivablesFIFO — naqd to'lovni eng eski ochiq nasiya cheklariga yozadi.
func ApplyCashToReceivablesFIFO(
	ctx context.Context,
	tx pgx.Tx,
	companyID, customerID, userID, currency string,
	amount float64,
	note string,
) (applied float64, err error) {
	currency = normalizeCurrency(currency)
	amount = round2(amount)
	if amount <= 0 {
		return 0, nil
	}

	paymentNote := note
	if paymentNote == "" {
		paymentNote = "Qarz to'lovi"
	}

	left := amount
	rows, err := tx.Query(ctx, `
		SELECT id, "remainingAmount" FROM "RetailReceivable"
		WHERE "companyId" = $1 AND "retailCustomerId" = $2 AND currency = $3 AND status IN ('OPEN', 'PARTIAL')
		ORDER BY "createdAt" ASC
	`, companyID, customerID, currency)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	for rows.Next() {
		if left <= 0.001 {
			break
		}
		var recID string
		var remaining float64
		if err := rows.Scan(&recID, &remaining); err != nil {
			return applied, err
		}
		remaining = round2(remaining)
		if remaining <= 0 {
			continue
		}
		pay := round2(math.Min(left, remaining))
		if err := payReceivableFromCash(ctx, tx, companyID, customerID, userID, recID, pay, currency, paymentNote); err != nil {
			return applied, err
		}
		left = round2(left - pay)
		applied = round2(applied + pay)
	}
	return applied, rows.Err()
}

func payReceivableFromCash(
	ctx context.Context,
	tx pgx.Tx,
	companyID, customerID, userID, receivableID string,
	payAmount float64,
	currency, note string,
) error {
	var remaining float64
	err := tx.QueryRow(ctx, `
		SELECT "remainingAmount" FROM "RetailReceivable"
		WHERE id = $1 AND "companyId" = $2
		FOR UPDATE
	`, receivableID, companyID).Scan(&remaining)
	if err != nil {
		return err
	}
	remaining = round2(remaining)
	if payAmount > remaining+0.001 {
		payAmount = remaining
	}
	if payAmount <= 0 {
		return nil
	}

	var paymentID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "RetailReceivablePayment" (id, "receivableId", amount, notes, "createdById", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW()) RETURNING id
	`, receivableID, payAmount, nullStr(note), userID).Scan(&paymentID)
	if err != nil {
		return err
	}

	newRemaining := round2(remaining - payAmount)
	newStatus := "PARTIAL"
	if newRemaining <= 0.001 {
		newStatus = "PAID"
		newRemaining = 0
	}
	_, err = tx.Exec(ctx, `
		UPDATE "RetailReceivable" SET "remainingAmount" = $1, status = $2, "updatedAt" = NOW() WHERE id = $3
	`, newRemaining, newStatus, receivableID)
	if err != nil {
		return err
	}

	bal, err := ComputeNetBalance(ctx, tx, companyID, customerID, currency)
	if err != nil {
		return err
	}
	return AppendCredit(ctx, tx, companyID, customerID, OpDebtPayment, payAmount, currency, note, "", receivableID, paymentID, userID, bal)
}
