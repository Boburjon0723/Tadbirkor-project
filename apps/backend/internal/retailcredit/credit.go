package retailcredit

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
)

const (
	OpPrepaidUse  = "PREPAID_USE"
	OpCreditSale  = "CREDIT_SALE"
	OpPOSVoid     = "POS_VOID"
)

type SaleParams struct {
	CompanyID        string
	RetailCustomerID string
	PosSaleID        string
	Total            float64
	Currency         string
	UserID           string
	SaleNumber       string
}

func round2(n float64) float64 {
	return math.Round(n*100) / 100
}

func normalizeCurrency(c string) string {
	if c == "USD" {
		return "USD"
	}
	return "UZS"
}

func computeDebt(ctx context.Context, tx pgx.Tx, companyID, customerID, currency string) (float64, error) {
	var sum float64
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM("remainingAmount"), 0)::float8
		FROM "RetailReceivable"
		WHERE "companyId" = $1 AND "retailCustomerId" = $2
		  AND status IN ('OPEN', 'PARTIAL') AND currency = $3
	`, companyID, customerID, currency).Scan(&sum)
	return round2(sum), err
}

func ComputeNetBalance(ctx context.Context, tx pgx.Tx, companyID, customerID, currency string) (float64, error) {
	var prepaid float64
	col := `"prepaidBalance"`
	if currency == "USD" {
		col = `"prepaidBalanceUsd"`
	}
	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT COALESCE(%s, 0)::float8 FROM "RetailCustomer" WHERE id = $1 AND "companyId" = $2
	`, col), customerID, companyID).Scan(&prepaid)
	if err != nil {
		return 0, err
	}
	debt, err := computeDebt(ctx, tx, companyID, customerID, currency)
	if err != nil {
		return 0, err
	}
	return round2(prepaid - debt), nil
}

func appendEntry(ctx context.Context, tx pgx.Tx, companyID, customerID, operation string, debit float64, currency, note, posSaleID, receivableID, userID string, balanceAfter float64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO "RetailCustomerLedgerEntry"
		(id, "companyId", "retailCustomerId", operation, debit, credit, "balanceAfter", currency, note, "posSaleId", "receivableId", "createdById", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, NOW())
	`, companyID, customerID, operation, debit, balanceAfter, currency, note, nullStr(posSaleID), nullStr(receivableID), nullStr(userID))
	return err
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func ProcessCreditSale(ctx context.Context, tx pgx.Tx, p SaleParams) error {
	currency := normalizeCurrency(p.Currency)
	total := round2(p.Total)

	var prepaidUZS, prepaidUSD float64
	err := tx.QueryRow(ctx, `
		SELECT COALESCE("prepaidBalance", 0)::float8, COALESCE("prepaidBalanceUsd", 0)::float8
		FROM "RetailCustomer" WHERE id = $1 AND "companyId" = $2
	`, p.RetailCustomerID, p.CompanyID).Scan(&prepaidUZS, &prepaidUSD)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("Mijoz topilmadi")
	}
	if err != nil {
		return err
	}
	prepaid := prepaidUZS
	prepaidCol := `"prepaidBalance"`
	if currency == "USD" {
		prepaid = prepaidUSD
		prepaidCol = `"prepaidBalanceUsd"`
	}
	usePrepaid := round2(math.Min(prepaid, total))
	remaining := round2(total - usePrepaid)

	if usePrepaid > 0 {
		_, err = tx.Exec(ctx, fmt.Sprintf(`
			UPDATE "RetailCustomer" SET %s = %s - $1, "updatedAt" = NOW()
			WHERE id = $2 AND "companyId" = $3
		`, prepaidCol, prepaidCol), usePrepaid, p.RetailCustomerID, p.CompanyID)
		if err != nil {
			return err
		}
		bal, err := ComputeNetBalance(ctx, tx, p.CompanyID, p.RetailCustomerID, currency)
		if err != nil {
			return err
		}
		if err := appendEntry(ctx, tx, p.CompanyID, p.RetailCustomerID, OpPrepaidUse, usePrepaid, currency,
			fmt.Sprintf("POS %s — avansdan", p.SaleNumber), p.PosSaleID, "", p.UserID, bal); err != nil {
			return err
		}
	}

	if remaining <= 0.001 {
		return nil
	}
	var receivableID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "RetailReceivable"
		(id, "companyId", "retailCustomerId", "posSaleId", amount, "remainingAmount", currency, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $4, $5, 'OPEN', NOW(), NOW())
		RETURNING id
	`, p.CompanyID, p.RetailCustomerID, p.PosSaleID, remaining, currency).Scan(&receivableID)
	if err != nil {
		return err
	}
	bal, err := ComputeNetBalance(ctx, tx, p.CompanyID, p.RetailCustomerID, currency)
	if err != nil {
		return err
	}
	return appendEntry(ctx, tx, p.CompanyID, p.RetailCustomerID, OpCreditSale, remaining, currency,
		fmt.Sprintf("POS %s — nasiya", p.SaleNumber), p.PosSaleID, receivableID, p.UserID, bal)
}

func ReverseCreditSale(ctx context.Context, tx pgx.Tx, companyID, customerID, posSaleID, saleNumber, userID string) error {
	var paymentCount int
	err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "RetailReceivablePayment" rp
		JOIN "RetailReceivable" r ON r.id = rp."receivableId"
		WHERE r."posSaleId" = $1
	`, posSaleID).Scan(&paymentCount)
	if err != nil {
		return err
	}
	if paymentCount > 0 {
		return errors.New("Bu nasiya chek bo'yicha to'lov bor. Avval mijoz qarz to'lovini qaytarish kerak")
	}

	rows, err := tx.Query(ctx, `
		SELECT operation, debit, currency FROM "RetailCustomerLedgerEntry"
		WHERE "companyId" = $1 AND "retailCustomerId" = $2 AND "posSaleId" = $3
		  AND operation IN ($4, $5)
		ORDER BY "createdAt" ASC
	`, companyID, customerID, posSaleID, OpPrepaidUse, OpCreditSale)
	if err != nil {
		return err
	}
	defer rows.Close()
	type entry struct {
		op, currency string
		debit        float64
	}
	var entries []entry
	for rows.Next() {
		var e entry
		if err := rows.Scan(&e.op, &e.debit, &e.currency); err != nil {
			return err
		}
		entries = append(entries, e)
	}
	if len(entries) == 0 {
		return nil
	}
	for _, e := range entries {
		if e.op == OpPrepaidUse {
			col := `"prepaidBalance"`
			if e.currency == "USD" {
				col = `"prepaidBalanceUsd"`
			}
			_, err = tx.Exec(ctx, fmt.Sprintf(`
				UPDATE "RetailCustomer" SET %s = %s + $1, "updatedAt" = NOW()
				WHERE id = $2 AND "companyId" = $3
			`, col, col), e.debit, customerID, companyID)
			if err != nil {
				return err
			}
		}
	}
	_, _ = tx.Exec(ctx, `DELETE FROM "RetailReceivable" WHERE "posSaleId" = $1`, posSaleID)
	for _, e := range entries {
		bal, err := ComputeNetBalance(ctx, tx, companyID, customerID, e.currency)
		if err != nil {
			return err
		}
		if err := appendEntry(ctx, tx, companyID, customerID, OpPOSVoid, e.debit, e.currency,
			fmt.Sprintf("POS %s — bekor", saleNumber), posSaleID, "", userID, bal); err != nil {
			return err
		}
	}
	return nil
}
