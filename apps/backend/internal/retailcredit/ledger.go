package retailcredit

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

const (
	OpPrepaidIn     = "PREPAID_IN"
	OpPrepaidOut    = "PREPAID_OUT"
	OpDebtPayment   = "DEBT_PAYMENT"
)

func prepaidCol(currency string) string {
	if currency == "USD" {
		return `"prepaidBalanceUsd"`
	}
	return `"prepaidBalance"`
}

func AppendDebit(ctx context.Context, tx pgx.Tx, companyID, customerID, operation string, debit float64, currency, note, posSaleID, receivableID, paymentID, userID string, balanceAfter float64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO "RetailCustomerLedgerEntry"
		(id, "companyId", "retailCustomerId", operation, debit, credit, "balanceAfter", currency, note, "posSaleId", "receivableId", "paymentId", "createdById", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, NOW())
	`, companyID, customerID, operation, debit, balanceAfter, currency, note, nullStr(posSaleID), nullStr(receivableID), nullStr(paymentID), nullStr(userID))
	return err
}

func AppendCredit(ctx context.Context, tx pgx.Tx, companyID, customerID, operation string, credit float64, currency, note, posSaleID, receivableID, paymentID, userID string, balanceAfter float64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO "RetailCustomerLedgerEntry"
		(id, "companyId", "retailCustomerId", operation, debit, credit, "balanceAfter", currency, note, "posSaleId", "receivableId", "paymentId", "createdById", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
	`, companyID, customerID, operation, credit, balanceAfter, currency, note, nullStr(posSaleID), nullStr(receivableID), nullStr(paymentID), nullStr(userID))
	return err
}

func RecordPrepaidIn(ctx context.Context, tx pgx.Tx, companyID, customerID, userID, currency string, amount float64, note string) (map[string]any, error) {
	currency = normalizeCurrency(currency)
	amount = round2(amount)
	if amount <= 0 {
		return nil, errors.New("Summa 0 dan katta bo'lishi kerak")
	}
	col := prepaidCol(currency)
	_, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE "RetailCustomer" SET %s = %s + $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" = $3
	`, col, col), amount, customerID, companyID)
	if err != nil {
		return nil, err
	}
	bal, err := ComputeNetBalance(ctx, tx, companyID, customerID, currency)
	if err != nil {
		return nil, err
	}
	if note == "" {
		note = "Qo'lda avans kirim"
	}
	if err := AppendCredit(ctx, tx, companyID, customerID, OpPrepaidIn, amount, currency, note, "", "", "", userID, bal); err != nil {
		return nil, err
	}
	return map[string]any{"currency": currency, "netBalance": bal, "prepaidBalance": bal + round2(0)}, nil
}

func RecordPrepaidOut(ctx context.Context, tx pgx.Tx, companyID, customerID, userID, currency string, amount float64, note string) error {
	currency = normalizeCurrency(currency)
	amount = round2(amount)
	if amount <= 0 {
		return errors.New("Summa 0 dan katta bo'lishi kerak")
	}
	col := prepaidCol(currency)
	var current float64
	err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT COALESCE(%s,0)::float8 FROM "RetailCustomer" WHERE id = $1`, col), customerID).Scan(&current)
	if err != nil {
		return err
	}
	if current < amount-0.001 {
		return fmt.Errorf("Avans yetarli emas. Mavjud: %v", current)
	}
	_, err = tx.Exec(ctx, fmt.Sprintf(`UPDATE "RetailCustomer" SET %s = %s - $1, "updatedAt" = NOW() WHERE id = $2`, col, col), amount, customerID)
	if err != nil {
		return err
	}
	bal, err := ComputeNetBalance(ctx, tx, companyID, customerID, currency)
	if err != nil {
		return err
	}
	if note == "" {
		note = "Avans qaytarish"
	}
	return AppendDebit(ctx, tx, companyID, customerID, OpPrepaidOut, amount, currency, note, "", "", "", userID, bal)
}
