package retailreceivables

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/retailcredit"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

var (
	ErrNotFound         = errors.New("Qarz yozuvi topilmadi")
	ErrCreditDisabled   = errors.New("Nasiya (mijozlar qarzi) kompaniyada o'chirilgan")
	ErrBadAmount        = errors.New("To'lov summasi 0 dan katta bo'lishi kerak")
	ErrOverpay          = errors.New("To'lov qoldiqdan oshib ketdi")
)

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

type PaymentInput struct {
	Amount float64  `json:"amount"`
	Notes  *string  `json:"notes"`
}

func round2(n float64) float64 {
	return math.Round(n*100) / 100
}

func (s *Service) assertCredit(ctx context.Context, companyID string) error {
	var enabled bool
	err := s.pool.QueryRow(ctx, `SELECT "posCreditEnabled" FROM "Company" WHERE id = $1`, companyID).Scan(&enabled)
	if err != nil || !enabled {
		return ErrCreditDisabled
	}
	return nil
}

func (s *Service) FindAll(ctx context.Context, companyID string, status, customerID string) ([]map[string]any, error) {
	if err := s.assertCredit(ctx, companyID); err != nil {
		return nil, err
	}
	sql := `
		SELECT r.id, r."retailCustomerId", r."posSaleId", r.amount, r."remainingAmount", r.currency, r.status, r."createdAt",
		       c.name, c.phone, ps."saleNumber", ps."completedAt", ps."totalAmount"
		FROM "RetailReceivable" r
		JOIN "RetailCustomer" c ON c.id = r."retailCustomerId"
		LEFT JOIN "PosSale" ps ON ps.id = r."posSaleId"
		WHERE r."companyId" = $1
	`
	args := []any{companyID}
	n := 2
	if status != "" {
		sql += fmt.Sprintf(` AND r.status = $%d`, n)
		args = append(args, status)
		n++
	}
	if customerID != "" {
		sql += fmt.Sprintf(` AND r."retailCustomerId" = $%d`, n)
		args = append(args, customerID)
	}
	sql += ` ORDER BY r."createdAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, custID, currency, st string
		var posSaleID *string
		var amount, remaining float64
		var createdAt time.Time
		var cName string
		var cPhone *string
		var saleNumber *string
		var completedAt *time.Time
		var totalAmount *float64
		if err := rows.Scan(&id, &custID, &posSaleID, &amount, &remaining, &currency, &st, &createdAt,
			&cName, &cPhone, &saleNumber, &completedAt, &totalAmount); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "retailCustomerId": custID, "posSaleId": posSaleID,
			"amount": amount, "remainingAmount": remaining, "currency": currency, "status": st, "createdAt": createdAt,
			"retailCustomer": map[string]any{"id": custID, "name": cName, "phone": cPhone},
			"posSale": map[string]any{"saleNumber": saleNumber, "completedAt": completedAt, "totalAmount": totalAmount},
		})
	}
	return out, rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	if err := s.assertCredit(ctx, companyID); err != nil {
		return nil, err
	}
	var custID, currency, status string
	var posSaleID *string
	var amount, remaining float64
	var createdAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT "retailCustomerId", "posSaleId", amount, "remainingAmount", currency, status, "createdAt"
		FROM "RetailReceivable" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&custID, &posSaleID, &amount, &remaining, &currency, &status, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	payRows, _ := s.pool.Query(ctx, `
		SELECT p.id, p.amount, p.notes, p."createdAt", u."fullName"
		FROM "RetailReceivablePayment" p
		LEFT JOIN "User" u ON u.id = p."createdById"
		WHERE p."receivableId" = $1 ORDER BY p."createdAt" DESC
	`, id)
	payments := []map[string]any{}
	if payRows != nil {
		for payRows.Next() {
			var pid string
			var amt float64
			var notes, uname *string
			var cat time.Time
			_ = payRows.Scan(&pid, &amt, &notes, &cat, &uname)
			payments = append(payments, map[string]any{
				"id": pid, "amount": amt, "notes": notes, "createdAt": cat,
				"createdBy": map[string]any{"fullName": uname},
			})
		}
		payRows.Close()
	}

	return map[string]any{
		"id": id, "retailCustomerId": custID, "posSaleId": posSaleID,
		"amount": amount, "remainingAmount": remaining, "currency": currency, "status": status, "createdAt": createdAt,
		"payments": payments,
	}, nil
}

func (s *Service) RecordPayment(ctx context.Context, id, companyID, userID string, in PaymentInput) (map[string]any, error) {
	rec, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	payAmount := round2(in.Amount)
	remaining := round2(rec["remainingAmount"].(float64))
	if payAmount <= 0 {
		return nil, ErrBadAmount
	}
	if payAmount > remaining+0.001 {
		return nil, fmt.Errorf("%w. Qolgan: %v", ErrOverpay, remaining)
	}

	currency := rec["currency"].(string)
	customerID := rec["retailCustomerId"].(string)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var prepaid float64
	col := `"prepaidBalance"`
	if currency == "USD" {
		col = `"prepaidBalanceUsd"`
	}
	_ = tx.QueryRow(ctx, fmt.Sprintf(`SELECT COALESCE(%s,0)::float8 FROM "RetailCustomer" WHERE id = $1`, col), customerID).Scan(&prepaid)
	fromPrepaid := round2(math.Min(prepaid, payAmount))
	fromCash := round2(payAmount - fromPrepaid)

	if fromPrepaid > 0 {
		_, _ = tx.Exec(ctx, fmt.Sprintf(`UPDATE "RetailCustomer" SET %s = %s - $1, "updatedAt" = NOW() WHERE id = $2`, col, col), fromPrepaid, customerID)
	}

	notes := ""
	if in.Notes != nil {
		notes = strings.TrimSpace(*in.Notes)
	}
	var paymentID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "RetailReceivablePayment" (id, "receivableId", amount, notes, "createdById", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW()) RETURNING id
	`, id, payAmount, nullStr(notes), userID).Scan(&paymentID)
	if err != nil {
		return nil, err
	}

	newRemaining := round2(remaining - payAmount)
	newStatus := "PARTIAL"
	if newRemaining <= 0 {
		newStatus = "PAID"
	}
	_, err = tx.Exec(ctx, `
		UPDATE "RetailReceivable" SET "remainingAmount" = $1, status = $2, "updatedAt" = NOW() WHERE id = $3
	`, math.Max(0, newRemaining), newStatus, id)
	if err != nil {
		return nil, err
	}

	bal, _ := retailcredit.ComputeNetBalance(ctx, tx, companyID, customerID, currency)
	if fromPrepaid > 0 {
		_ = retailcredit.AppendDebit(ctx, tx, companyID, customerID, retailcredit.OpPrepaidUse, fromPrepaid, currency,
			"Qarz to'lovi — avansdan", "", id, paymentID, userID, bal)
	}
	bal, _ = retailcredit.ComputeNetBalance(ctx, tx, companyID, customerID, currency)
	note := notes
	if note == "" {
		note = "Qarz to'lovi"
	}
	_ = retailcredit.AppendCredit(ctx, tx, companyID, customerID, retailcredit.OpDebtPayment, payAmount, currency,
		note, "", id, paymentID, userID, bal)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if s.cache != nil {
		s.cache.Del(ctx, cache.RetailSummaryKey(companyID))
		s.cache.Del(ctx, cache.RetailLedgerKey(companyID, customerID))
	}
	_ = fromCash
	return s.FindOne(ctx, id, companyID)
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
