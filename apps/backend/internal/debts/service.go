package debts

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

const debtRemainingEps = 0.009

var (
	ErrNotFound        = errors.New("Qarz yozuvi topilmadi")
	ErrPaymentNotFound = errors.New("Tolov yozuvi topilmadi")
	ErrPartnerNotFound = errors.New("Hamkor topilmadi")
	ErrForbidden       = errors.New("Ruxsat etilmagan amal")
	ErrValidation      = errors.New("Notogri sorov")
	ErrAlreadyReviewed = errors.New("Tolov allaqachon korib chiqilgan")
	ErrNoPending       = errors.New("Tasdiqlash uchun kutilayotgan tolov yoq")
)

type Service struct {
	pool          *pgxpool.Pool
	notifications *notifications.Service
	hub           pkgrealtime.Hub
	cache         *cache.Cache
}

func NewService(pool *pgxpool.Pool, notificationsSvc *notifications.Service, hub pkgrealtime.Hub, c *cache.Cache) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, notifications: notificationsSvc, hub: hub, cache: c}
}

func (s *Service) notifyDebtsChanged(ctx context.Context, debtorID, creditorID string, payload map[string]any) {
	if s == nil {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	if s.hub != nil {
		s.hub.EmitDebtsChanged(debtorID, payload)
		s.hub.EmitDebtsChanged(creditorID, payload)
	}
	pkgrealtime.NotifyDashboardChange(ctx, s.hub, s.cache, debtorID)
	pkgrealtime.NotifyDashboardChange(ctx, s.hub, s.cache, creditorID)
}

type moneyPair struct {
	Uzs float64 `json:"uzs"`
	Usd float64 `json:"usd"`
}

func curKey(c string) string {
	if strings.ToUpper(c) == "USD" {
		return "usd"
	}
	return "uzs"
}

func (s *Service) GetEntriesSummary(ctx context.Context, companyID string) (map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT "creditorId", "debtorId", "remainingAmount", COALESCE(currency, 'UZS')
		FROM "DebtEntry"
		WHERE ("debtorId" = $1 OR "creditorId" = $1)
		  AND status IN ('OPEN', 'PARTIAL')
		  AND ("remainingAmount" > $2 OR EXISTS (
		    SELECT 1 FROM "DebtPaymentRecord" dpr WHERE dpr."debtEntryId" = "DebtEntry".id AND dpr.status = 'PENDING'
		  ))
	`, companyID, debtRemainingEps)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rec := moneyPair{}
	pay := moneyPair{}
	for rows.Next() {
		var creditor, debtor, currency string
		var remaining float64
		if err := rows.Scan(&creditor, &debtor, &remaining, &currency); err != nil {
			return nil, err
		}
		k := curKey(currency)
		if creditor == companyID {
			if k == "usd" {
				rec.Usd += remaining
			} else {
				rec.Uzs += remaining
			}
		} else {
			if k == "usd" {
				pay.Usd += remaining
			} else {
				pay.Uzs += remaining
			}
		}
	}
	return map[string]any{
		"receivable": rec,
		"payable":    pay,
		"net": moneyPair{
			Uzs: rec.Uzs - pay.Uzs,
			Usd: rec.Usd - pay.Usd,
		},
	}, rows.Err()
}

type mappedEntry struct {
	ID               string
	Amount           float64
	Remaining        float64
	Status           string
	Currency         string
	CreatedAt        any
	PartnerCompanyID string
	PartnerName      string
	PartnerTin       string
	IsIncoming       bool
}

func (s *Service) loadOpenEntries(ctx context.Context, companyID string) ([]mappedEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT de.id, de.amount, de."remainingAmount", de.status, COALESCE(de.currency, 'UZS'), de."createdAt",
		       de."debtorId", de."creditorId",
		       d.name, COALESCE(d.tin, '-'), c.name, COALESCE(c.tin, '-')
		FROM "DebtEntry" de
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE (de."debtorId" = $1 OR de."creditorId" = $1)
		  AND de.status IN ('OPEN', 'PARTIAL')
		  AND (de."remainingAmount" > $2 OR EXISTS (
		    SELECT 1 FROM "DebtPaymentRecord" dpr WHERE dpr."debtEntryId" = de.id AND dpr.status = 'PENDING'
		  ))
		ORDER BY de."createdAt" DESC LIMIT 5000
	`, companyID, debtRemainingEps)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []mappedEntry{}
	for rows.Next() {
		var e mappedEntry
		var debtorID, creditorID, debtorName, debtorTin, creditorName, creditorTin string
		if err := rows.Scan(&e.ID, &e.Amount, &e.Remaining, &e.Status, &e.Currency, &e.CreatedAt, &debtorID, &creditorID, &debtorName, &debtorTin, &creditorName, &creditorTin); err != nil {
			return nil, err
		}
		e.IsIncoming = creditorID == companyID
		if e.IsIncoming {
			e.PartnerCompanyID = debtorID
			e.PartnerName = debtorName
			e.PartnerTin = debtorTin
		} else {
			e.PartnerCompanyID = creditorID
			e.PartnerName = creditorName
			e.PartnerTin = creditorTin
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Service) FindPartnerGroups(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	tab := q["tab"]
	if tab != "payable" {
		tab = "receivable"
	}
	search := strings.ToLower(strings.TrimSpace(q["search"]))
	page, limit := paginate(q, 40, 80)
	entries, err := s.loadOpenEntries(ctx, companyID)
	if err != nil {
		return nil, err
	}
	summary := summaryFromEntries(entries)
	groups := groupEntries(entries, tab, search)
	total := len(groups)
	skip := (page - 1) * limit
	end := skip + limit
	if skip > total {
		skip = total
	}
	if end > total {
		end = total
	}
	items := groups[skip:end]
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": end < total, "summary": summary, "capped": len(entries) >= 5000,
	}, nil
}

func groupEntries(entries []mappedEntry, tab, search string) []map[string]any {
	type agg struct {
		partnerCompanyID string
		partner          map[string]any
		isIncoming       bool
		entries          []map[string]any
		totalAmount      moneyPair
		totalRemaining   moneyPair
		aggregateStatus  string
		entryCount       int
	}
	m := map[string]*agg{}
	for _, e := range entries {
		tabMatch := (tab == "receivable" && e.IsIncoming) || (tab == "payable" && !e.IsIncoming)
		if !tabMatch {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(e.PartnerName), search) {
			continue
		}
		g, ok := m[e.PartnerCompanyID]
		if !ok {
			g = &agg{
				partnerCompanyID: e.PartnerCompanyID,
				partner:          map[string]any{"id": e.PartnerCompanyID, "name": e.PartnerName, "tin": e.PartnerTin},
				isIncoming:       e.IsIncoming,
				aggregateStatus:  "PAID",
			}
			m[e.PartnerCompanyID] = g
		}
		k := curKey(e.Currency)
		if k == "usd" {
			g.totalAmount.Usd += e.Amount
			g.totalRemaining.Usd += e.Remaining
		} else {
			g.totalAmount.Uzs += e.Amount
			g.totalRemaining.Uzs += e.Remaining
		}
		g.entryCount++
		if e.Status == "OPEN" {
			g.aggregateStatus = "OPEN"
		} else if e.Status == "PARTIAL" && g.aggregateStatus != "OPEN" {
			g.aggregateStatus = "PARTIAL"
		}
		g.entries = append(g.entries, mapEntry(e))
	}
	out := make([]map[string]any, 0, len(m))
	for _, g := range m {
		out = append(out, map[string]any{
			"partnerCompanyId": g.partnerCompanyID,
			"partner":          g.partner,
			"isIncoming":       g.isIncoming,
			"entries":          g.entries,
			"totalAmount":      g.totalAmount,
			"totalRemaining":   g.totalRemaining,
			"aggregateStatus":  g.aggregateStatus,
			"entryCount":       g.entryCount,
		})
	}
	return out
}

func summaryFromEntries(entries []mappedEntry) map[string]any {
	rec := moneyPair{}
	pay := moneyPair{}
	for _, e := range entries {
		k := curKey(e.Currency)
		if e.IsIncoming {
			if k == "usd" {
				rec.Usd += e.Remaining
			} else {
				rec.Uzs += e.Remaining
			}
		} else {
			if k == "usd" {
				pay.Usd += e.Remaining
			} else {
				pay.Uzs += e.Remaining
			}
		}
	}
	return map[string]any{
		"receivable": rec,
		"payable":    pay,
		"net":        moneyPair{Uzs: rec.Uzs - pay.Uzs, Usd: rec.Usd - pay.Usd},
	}
}

func mapEntry(e mappedEntry) map[string]any {
	return map[string]any{
		"id": e.ID, "amount": e.Amount, "remainingAmount": e.Remaining,
		"status": e.Status, "currency": e.Currency, "createdAt": e.CreatedAt,
		"partnerCompanyId": e.PartnerCompanyID,
		"partner":          map[string]any{"id": e.PartnerCompanyID, "name": e.PartnerName, "tin": e.PartnerTin},
		"isIncoming":       e.IsIncoming,
	}
}

func (s *Service) FindPartnerGroupOne(ctx context.Context, companyID, partnerCompanyID, tab string) (map[string]any, error) {
	if tab != "payable" {
		tab = "receivable"
	}
	groups, err := s.FindPartnerGroups(ctx, companyID, map[string]string{"tab": tab})
	if err != nil {
		return nil, err
	}
	for _, item := range groups["items"].([]map[string]any) {
		if item["partnerCompanyId"] == partnerCompanyID {
			return item, nil
		}
	}
	var name, tin string
	err = s.pool.QueryRow(ctx, `SELECT name, COALESCE(tin, '-') FROM "Company" WHERE id = $1`, partnerCompanyID).Scan(&name, &tin)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPartnerNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"partnerCompanyId":  partnerCompanyID,
		"partner":           map[string]any{"name": name, "tin": tin},
		"isIncoming":        tab == "receivable",
		"entries":           []any{},
		"totalAmount":       moneyPair{},
		"totalRemaining":    moneyPair{},
		"aggregateStatus":   "PAID",
		"entryCount":        0,
		"hasPendingPayment": false,
	}, nil
}

func (s *Service) FindAllEntries(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	page, limit := paginate(q, 50, 100)
	skip := (page - 1) * limit
	where := `(de."debtorId" = $1 OR de."creditorId" = $1)`
	args := []any{companyID}
	if st := strings.TrimSpace(strings.ToUpper(q["status"])); st != "" {
		where += ` AND de.status = $2`
		args = append(args, st)
	}
	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "DebtEntry" de WHERE `+where, args...).Scan(&total); err != nil {
		return nil, err
	}
	sql := `
		SELECT de.id, de.amount, de."remainingAmount", de.status, COALESCE(de.currency, 'UZS'), de."createdAt",
		       de."debtorId", de."creditorId", d.name, COALESCE(d.tin, '-'), c.name, COALESCE(c.tin, '-')
		FROM "DebtEntry" de
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE ` + where + ` ORDER BY de."createdAt" DESC LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(skip)
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var e mappedEntry
		var debtorID, creditorID, debtorName, debtorTin, creditorName, creditorTin string
		if err := rows.Scan(&e.ID, &e.Amount, &e.Remaining, &e.Status, &e.Currency, &e.CreatedAt, &debtorID, &creditorID, &debtorName, &debtorTin, &creditorName, &creditorTin); err != nil {
			return nil, err
		}
		e.IsIncoming = creditorID == companyID
		if e.IsIncoming {
			e.PartnerCompanyID, e.PartnerName, e.PartnerTin = debtorID, debtorName, debtorTin
		} else {
			e.PartnerCompanyID, e.PartnerName, e.PartnerTin = creditorID, creditorName, creditorTin
		}
		items = append(items, mapEntry(e))
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}, rows.Err()
}

func (s *Service) FindEntry(ctx context.Context, companyID, id string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT de.id, de.amount, de."remainingAmount", de.status, COALESCE(de.currency, 'UZS'), de."createdAt",
		       de."debtorId", de."creditorId", d.name, COALESCE(d.tin, '-'), c.name, COALESCE(c.tin, '-')
		FROM "DebtEntry" de
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE de.id = $1 AND (de."debtorId" = $2 OR de."creditorId" = $2)
	`, id, companyID)
	var e mappedEntry
	var debtorID, creditorID, debtorName, debtorTin, creditorName, creditorTin string
	if err := row.Scan(&e.ID, &e.Amount, &e.Remaining, &e.Status, &e.Currency, &e.CreatedAt, &debtorID, &creditorID, &debtorName, &debtorTin, &creditorName, &creditorTin); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	e.IsIncoming = creditorID == companyID
	if e.IsIncoming {
		e.PartnerCompanyID, e.PartnerName, e.PartnerTin = debtorID, debtorName, debtorTin
	} else {
		e.PartnerCompanyID, e.PartnerName, e.PartnerTin = creditorID, creditorName, creditorTin
	}
	return mapEntry(e), nil
}

func (s *Service) FindPendingPayments(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT dpr.id, dpr.amount, dpr.status, dpr.notes, dpr."createdAt", de.id, de.currency,
		       d.name, c.name
		FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE dpr.status = 'PENDING' AND (de."debtorId" = $1 OR de."creditorId" = $1)
		ORDER BY dpr."createdAt" DESC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, status, entryID, currency, debtorName, creditorName string
		var amount float64
		var notes *string
		var createdAt any
		if err := rows.Scan(&id, &amount, &status, &notes, &createdAt, &entryID, &currency, &debtorName, &creditorName); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "amount": amount, "status": status, "notes": notes, "createdAt": createdAt,
			"debtEntryId": entryID, "currency": currency,
			"debtor": map[string]any{"name": debtorName}, "creditor": map[string]any{"name": creditorName},
		})
	}
	return out, rows.Err()
}

func (s *Service) FindPartnerLedger(ctx context.Context, companyID, partnerCompanyID string) (map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT de.id, de.amount, de."remainingAmount", de.status, COALESCE(de.currency, 'UZS'), de."createdAt",
		       de."creditorId", de."debtorId", de."receiptId",
		       d.name, COALESCE(d.tin, '-'), c.name, COALESCE(c.tin, '-')
		FROM "DebtEntry" de
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE (de."debtorId" = $1 AND de."creditorId" = $2) OR (de."debtorId" = $2 AND de."creditorId" = $1)
		ORDER BY de."createdAt" DESC
	`, companyID, partnerCompanyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := []map[string]any{}
	amountTotals := moneyPair{}
	remainingTotals := moneyPair{}
	var isIncoming *bool
	var partnerName, partnerTin string
	for rows.Next() {
		var id, status, currency, creditorID, debtorID string
		var receiptID *string
		var amount, remaining float64
		var createdAt any
		var dName, dTin, cName, cTin string
		if err := rows.Scan(&id, &amount, &remaining, &status, &currency, &createdAt, &creditorID, &debtorID, &receiptID, &dName, &dTin, &cName, &cTin); err != nil {
			return nil, err
		}
		incoming := creditorID == companyID
		if isIncoming == nil {
			v := incoming
			isIncoming = &v
			if incoming {
				partnerName, partnerTin = dName, dTin
			} else {
				partnerName, partnerTin = cName, cTin
			}
		}
		k := curKey(currency)
		if incoming {
			addMoney(&amountTotals, k, amount)
			addMoney(&remainingTotals, k, remaining)
		} else {
			addMoney(&amountTotals, k, -amount)
			addMoney(&remainingTotals, k, -remaining)
		}
		entries = append(entries, map[string]any{
			"id": id, "amount": amount, "remainingAmount": remaining, "status": status,
			"currency": currency, "createdAt": createdAt, "isIncoming": incoming,
			"receiptId": receiptID,
		})
	}
	if len(entries) == 0 {
		var name, tin string
		if err := s.pool.QueryRow(ctx, `SELECT name, COALESCE(tin, '-') FROM "Company" WHERE id = $1`, partnerCompanyID).Scan(&name, &tin); err != nil {
			return nil, ErrPartnerNotFound
		}
		return map[string]any{
			"partnerCompanyId": partnerCompanyID,
			"partner":          map[string]any{"name": name, "tin": tin},
			"isIncoming":       nil,
			"entries":          []any{},
			"totals":           map[string]any{"amount": moneyPair{}, "remaining": moneyPair{}},
		}, nil
	}
	return map[string]any{
		"partnerCompanyId": partnerCompanyID,
		"partner":          map[string]any{"name": partnerName, "tin": partnerTin},
		"isIncoming":       isIncoming,
		"entries":          entries,
		"totals":           map[string]any{"amount": amountTotals, "remaining": remainingTotals},
	}, rows.Err()
}

func (s *Service) FindPartnerBalance(ctx context.Context, companyID, partnerCompanyID string) (map[string]any, error) {
	ledger, err := s.FindPartnerLedger(ctx, companyID, partnerCompanyID)
	if err != nil {
		return nil, err
	}
	return ledger, nil
}

func addMoney(p *moneyPair, k string, v float64) {
	if k == "usd" {
		p.Usd += v
	} else {
		p.Uzs += v
	}
}

func paginate(q map[string]string, defLimit, maxLimit int) (int, int) {
	page, _ := strconv.Atoi(q["page"])
	if page <= 0 {
		page = 1
	}
	limit, _ := strconv.Atoi(q["limit"])
	if limit <= 0 {
		limit = defLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit
}
