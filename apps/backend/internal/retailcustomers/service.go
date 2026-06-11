package retailcustomers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
	"github.com/tadbirkor/axis-erp/backend/internal/retailcredit"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

var (
	ErrNotFound      = errors.New("Mijoz topilmadi")
	ErrBadInput      = errors.New("Ism majburiy")
	ErrNoCreditPerm  = errors.New("Nasiya operatsiyasi uchun ruxsat yo'q")
	ErrCreditDisabled = errors.New("Operatsiya uchun POS nasiyani yoqing (Sozlamalar → Kompaniya)")
)

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

func (s *Service) posWhereSQL() string {
	return `"companyId" = $1 AND "isGuest" = false AND "isPosRegistry" = true`
}

func (s *Service) invalidate(ctx context.Context, companyID, customerID string) {
	if s.cache == nil {
		return
	}
	s.cache.Del(ctx, cache.RetailSummaryKey(companyID))
	if customerID != "" {
		s.cache.Del(ctx, cache.RetailLedgerKey(companyID, customerID))
	}
}

func (s *Service) assertPosCredit(ctx context.Context, companyID, userID string) error {
	var enabled bool
	_ = s.pool.QueryRow(ctx, `SELECT "posCreditEnabled" FROM "Company" WHERE id = $1`, companyID).Scan(&enabled)
	if !enabled {
		return ErrCreditDisabled
	}
	var role string
	var grant, deny []string
	err := s.pool.QueryRow(ctx, `
		SELECT role, "grantPermissions", "denyPermissions" FROM "CompanyUser"
		WHERE "companyId" = $1 AND "userId" = $2 LIMIT 1
	`, companyID, userID).Scan(&role, &grant, &deny)
	if err != nil {
		return ErrNoCreditPerm
	}
	perms := permissions.Effective(role, grant, deny)
	for _, p := range perms {
		if p == "pos.credit" {
			return nil
		}
	}
	return ErrNoCreditPerm
}

func (s *Service) FindAll(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, phone, notes, "prepaidBalance", "prepaidBalanceUsd", "createdAt", "updatedAt"
		FROM "RetailCustomer" WHERE `+s.posWhereSQL()+` ORDER BY name ASC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCustomers(rows)
}

func scanCustomers(rows pgx.Rows) ([]map[string]any, error) {
	out := []map[string]any{}
	for rows.Next() {
		var id, name string
		var phone, notes *string
		var prepaid, prepaidUSD float64
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &phone, &notes, &prepaid, &prepaidUSD, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "name": name, "phone": phone, "notes": notes,
			"prepaidBalance": prepaid, "prepaidBalanceUsd": prepaidUSD,
			"createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	return out, rows.Err()
}

func (s *Service) Search(ctx context.Context, companyID, q string, limit int) ([]map[string]any, error) {
	q = strings.TrimSpace(q)
	if limit <= 0 {
		limit = 20
	}
	if limit > 30 {
		limit = 30
	}
	if q == "" {
		return s.PosPicker(ctx, companyID, limit)
	}
	sql := `
		SELECT id, name, phone FROM "RetailCustomer"
		WHERE ` + s.posWhereSQL() + ` AND (name ILIKE '%' || $2 || '%' OR phone ILIKE '%' || $2 || '%')
		ORDER BY "updatedAt" DESC LIMIT ` + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, sql, companyID, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name string
		var phone *string
		if err := rows.Scan(&id, &name, &phone); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "phone": phone})
	}
	return out, rows.Err()
}

func (s *Service) PosPicker(ctx context.Context, companyID string, limit int) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 12
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, phone FROM "RetailCustomer"
		WHERE `+s.posWhereSQL()+` ORDER BY "updatedAt" DESC LIMIT $2
	`, companyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name string
		var phone *string
		if err := rows.Scan(&id, &name, &phone); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "phone": phone})
	}
	return out, rows.Err()
}

func (s *Service) Summary(ctx context.Context, companyID string) ([]map[string]any, error) {
	key := cache.RetailSummaryKey(companyID)
	var cached []map[string]any
	if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
		return cached, nil
	}
	customers, err := s.FindAll(ctx, companyID)
	if err != nil {
		return nil, err
	}
	for i, c := range customers {
		id := c["id"].(string)
		prepaidUZS, _ := c["prepaidBalance"].(float64)
		prepaidUSD, _ := c["prepaidBalanceUsd"].(float64)
		debtUZS, debtUSD, openCount := s.customerDebt(ctx, companyID, id)
		balances := map[string]any{
			"UZS": currencyBalance(prepaidUZS, debtUZS),
			"USD": currencyBalance(prepaidUSD, debtUSD),
		}
		netUZS := balances["UZS"].(map[string]any)["netBalance"].(float64)
		customers[i]["balances"] = balances
		customers[i]["totalDebt"] = debtUZS
		customers[i]["prepaidBalance"] = prepaidUZS
		customers[i]["netBalance"] = netUZS
		customers[i]["totalPaid"] = 0
		customers[i]["totalCredited"] = 0
		customers[i]["openReceivablesCount"] = openCount
		customers[i]["lastSaleAt"] = nil
	}
	_ = s.cache.SetJSON(ctx, key, customers, 25*time.Second)
	return customers, nil
}

func currencyBalance(prepaid, debt float64) map[string]any {
	return map[string]any{
		"totalDebt":      debt,
		"prepaidBalance": prepaid,
		"netBalance":     math.Round((prepaid-debt)*100) / 100,
	}
}

func ledgerOperationLabel(op string) string {
	switch op {
	case retailcredit.OpPrepaidIn:
		return "Avans (kirim)"
	case retailcredit.OpPrepaidOut:
		return "Pul qaytarish"
	case retailcredit.OpPrepaidUse:
		return "Avansdan sotuv"
	case retailcredit.OpCreditSale:
		return "Nasiya sotuv"
	case retailcredit.OpDebtPayment:
		return "Qarz to'lovi"
	case retailcredit.OpPOSVoid:
		return "Bekor qilingan POS"
	default:
		return op
	}
}

func (s *Service) customerDebt(ctx context.Context, companyID, customerID string) (uzs, usd float64, count int) {
	rows, _ := s.pool.Query(ctx, `
		SELECT currency, COALESCE(SUM("remainingAmount"),0)::float8, COUNT(*)::int
		FROM "RetailReceivable"
		WHERE "companyId" = $1 AND "retailCustomerId" = $2 AND status IN ('OPEN','PARTIAL')
		GROUP BY currency
	`, companyID, customerID)
	if rows != nil {
		for rows.Next() {
			var cur string
			var sum float64
			var cnt int
			_ = rows.Scan(&cur, &sum, &cnt)
			count += cnt
			if cur == "USD" {
				usd = sum
			} else {
				uzs = sum
			}
		}
		rows.Close()
	}
	return
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, phone, notes, "prepaidBalance", "prepaidBalanceUsd", "createdAt", "updatedAt"
		FROM "RetailCustomer"
		WHERE id = $1 AND "companyId" = $2 AND "isGuest" = false AND "isPosRegistry" = true
	`, id, companyID)
	var cid, name string
	var phone, notes *string
	var prepaid, prepaidUSD float64
	var createdAt, updatedAt time.Time
	if err := row.Scan(&cid, &name, &phone, &notes, &prepaid, &prepaidUSD, &createdAt, &updatedAt); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": cid, "name": name, "phone": phone, "notes": notes,
		"prepaidBalance": prepaid, "prepaidBalanceUsd": prepaidUSD,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Service) Create(ctx context.Context, companyID string, in CreateInput) (map[string]any, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, ErrBadInput
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "RetailCustomer" (id, "companyId", name, phone, notes, "isGuest", "isPosRegistry", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, true, NOW(), NOW()) RETURNING id
	`, companyID, name, ptrStr(in.Phone), ptrStr(in.Notes)).Scan(&id)
	if err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID, "")
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Update(ctx context.Context, id, companyID string, in UpdateInput) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	sets := []string{`"updatedAt" = NOW()`}
	args := []any{}
	n := 1
	if in.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", n))
		args = append(args, strings.TrimSpace(*in.Name))
		n++
	}
	if in.Phone != nil {
		sets = append(sets, fmt.Sprintf("phone = $%d", n))
		args = append(args, ptrStr(in.Phone))
		n++
	}
	if in.Notes != nil {
		sets = append(sets, fmt.Sprintf("notes = $%d", n))
		args = append(args, ptrStr(in.Notes))
		n++
	}
	args = append(args, id, companyID)
	_, err := s.pool.Exec(ctx, fmt.Sprintf(`UPDATE "RetailCustomer" SET %s WHERE id = $%d AND "companyId" = $%d`, strings.Join(sets, ", "), n, n+1), args...)
	if err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID, id)
	return s.FindOne(ctx, id, companyID)
}

func ptrStr(p *string) any {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(*p)
	if v == "" {
		return nil
	}
	return v
}

func (s *Service) RecordPrepaid(ctx context.Context, id, companyID, userID string, in PrepaidInput) (map[string]any, error) {
	if err := s.assertPosCredit(ctx, companyID, userID); err != nil {
		return nil, err
	}
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	note := ""
	if in.Notes != nil {
		note = *in.Notes
	}
	res, err := retailcredit.RecordPrepaidIn(ctx, tx, companyID, id, userID, in.Currency, in.Amount, note)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID, id)
	return res, nil
}

func (s *Service) RecordWithdraw(ctx context.Context, id, companyID, userID string, in PrepaidInput) error {
	if err := s.assertPosCredit(ctx, companyID, userID); err != nil {
		return err
	}
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	note := ""
	if in.Notes != nil {
		note = *in.Notes
	}
	if err := retailcredit.RecordPrepaidOut(ctx, tx, companyID, id, userID, in.Currency, in.Amount, note); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	s.invalidate(ctx, companyID, id)
	return nil
}

func (s *Service) FindLedger(ctx context.Context, id, companyID string) (map[string]any, error) {
	key := cache.RetailLedgerKey(companyID, id)
	if s.cache != nil {
		var cached map[string]any
		if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
			return cached, nil
		}
	}

	customer, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	uzsDebt, usdDebt, _ := s.customerDebt(ctx, companyID, id)
	prepaidUZS := customer["prepaidBalance"].(float64)
	prepaidUSD := customer["prepaidBalanceUsd"].(float64)

	receivables, err := s.loadCustomerReceivables(ctx, companyID, id)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT e.id, e.operation, e.debit, e.credit, e."balanceAfter", e.currency, e.note, e."createdAt",
		       e."posSaleId", e."receivableId", e."paymentId",
		       u.id, u."fullName",
		       ps.id, ps."saleNumber", ps.currency, ps."completedAt", ps."totalAmount",
		       (SELECT COUNT(*)::int FROM "PosSaleItem" si WHERE si."saleId" = ps.id) AS item_count
		FROM "RetailCustomerLedgerEntry" e
		LEFT JOIN "User" u ON u.id = e."createdById"
		LEFT JOIN "PosSale" ps ON ps.id = e."posSaleId"
		WHERE e."companyId" = $1 AND e."retailCustomerId" = $2
		ORDER BY e."createdAt" DESC LIMIT 200
	`, companyID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := []map[string]any{}
	for rows.Next() {
		var eid, op, currency string
		var debit, credit, bal float64
		var note *string
		var createdAt time.Time
		var posSaleID, receivableID, paymentID *string
		var uid, uname *string
		var psID, psNumber, psCurrency *string
		var psCompleted *time.Time
		var psTotal *float64
		var itemCount int
		if err := rows.Scan(&eid, &op, &debit, &credit, &bal, &currency, &note, &createdAt,
			&posSaleID, &receivableID, &paymentID,
			&uid, &uname,
			&psID, &psNumber, &psCurrency, &psCompleted, &psTotal, &itemCount); err != nil {
			return nil, err
		}
		var by any = nil
		if uid != nil {
			by = map[string]any{"id": *uid, "fullName": *uname}
		}
		entry := map[string]any{
			"id": eid, "operation": op, "operationLabel": ledgerOperationLabel(op),
			"debit": debit, "credit": credit,
			"balanceAfter": bal, "currency": currency, "note": note, "createdAt": createdAt, "createdBy": by,
			"posSaleId": posSaleID, "receivableId": receivableID, "paymentId": paymentID,
		}
		if psID != nil && *psID != "" {
			entry["posSaleItemCount"] = itemCount
			entry["posSale"] = map[string]any{
				"id": *psID, "saleNumber": derefStr(psNumber), "currency": derefStr(psCurrency),
				"completedAt": psCompleted, "totalAmount": derefFloat(psTotal),
			}
		}
		entries = append(entries, entry)
	}

	balances := map[string]any{
		"UZS": currencyBalance(prepaidUZS, uzsDebt),
		"USD": currencyBalance(prepaidUSD, usdDebt),
	}
	netUZS := balances["UZS"].(map[string]any)["netBalance"].(float64)

	result := map[string]any{
		"customer": map[string]any{
			"id": customer["id"], "name": customer["name"],
			"phone": customer["phone"], "notes": customer["notes"],
		},
		"balances":        balances,
		"totalDebt":       uzsDebt,
		"prepaidBalance":  prepaidUZS,
		"netBalance":      netUZS,
		"totalPaid":       0,
		"entries":         entries,
		"receivables":     receivables,
	}
	if s.cache != nil {
		_ = s.cache.SetJSON(ctx, key, result, 20*time.Second)
	}
	return result, nil
}

func (s *Service) LedgerSaleItems(ctx context.Context, customerID, entryID, companyID string) (map[string]any, error) {
	var saleID *string
	err := s.pool.QueryRow(ctx, `
		SELECT "posSaleId" FROM "RetailCustomerLedgerEntry"
		WHERE id = $1 AND "companyId" = $2 AND "retailCustomerId" = $3
	`, entryID, companyID, customerID).Scan(&saleID)
	if errors.Is(err, pgx.ErrNoRows) || saleID == nil || *saleID == "" {
		return map[string]any{"items": []any{}}, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, "productNameSnapshot", quantity, "unitPrice", "lineTotal"
		FROM "PosSaleItem" WHERE "saleId" = $1 ORDER BY id ASC
	`, *saleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, name string
		var qty, unit, total float64
		if err := rows.Scan(&id, &name, &qty, &unit, &total); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": id, "productName": name, "quantity": qty, "unitPrice": unit, "lineTotal": total,
		})
	}
	return map[string]any{"items": items}, rows.Err()
}

func (s *Service) loadCustomerReceivables(ctx context.Context, companyID, customerID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id, r.amount, r."remainingAmount", r.currency, r.status, r."createdAt",
		       ps."saleNumber", ps."completedAt", ps."totalAmount"
		FROM "RetailReceivable" r
		LEFT JOIN "PosSale" ps ON ps.id = r."posSaleId"
		WHERE r."companyId" = $1 AND r."retailCustomerId" = $2 AND r.status IN ('OPEN', 'PARTIAL')
		ORDER BY r."createdAt" DESC
	`, companyID, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, currency, status string
		var amount, remaining float64
		var createdAt time.Time
		var saleNumber *string
		var completedAt *time.Time
		var totalAmount *float64
		if err := rows.Scan(&id, &amount, &remaining, &currency, &status, &createdAt,
			&saleNumber, &completedAt, &totalAmount); err != nil {
			return nil, err
		}
		payments, err := s.receivablePayments(ctx, id)
		if err != nil {
			return nil, err
		}
		var posSale any = nil
		if saleNumber != nil {
			posSale = map[string]any{
				"saleNumber": *saleNumber, "completedAt": completedAt, "totalAmount": totalAmount,
			}
		}
		out = append(out, map[string]any{
			"id": id, "amount": amount, "remainingAmount": remaining,
			"currency": currency, "status": status, "createdAt": createdAt,
			"posSale": posSale, "payments": payments,
		})
	}
	return out, rows.Err()
}

func (s *Service) receivablePayments(ctx context.Context, receivableID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p.amount, p.notes, p."createdAt", u."fullName"
		FROM "RetailReceivablePayment" p
		LEFT JOIN "User" u ON u.id = p."createdById"
		WHERE p."receivableId" = $1
		ORDER BY p."createdAt" DESC LIMIT 20
	`, receivableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id string
		var amount float64
		var notes, uname *string
		var createdAt time.Time
		if err := rows.Scan(&id, &amount, &notes, &createdAt, &uname); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "amount": amount, "notes": notes, "createdAt": createdAt,
			"createdBy": map[string]any{"fullName": uname},
		})
	}
	return out, rows.Err()
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func derefFloat(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}
