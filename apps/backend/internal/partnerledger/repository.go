package partnerledger

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type contactRow struct {
	ID, CompanyID, Name string
	Phone, Tag, Notes   *string
	TelegramChatID      *string
	TelegramLinkStatus  string
	TelegramLinkedAt    *time.Time
	IsActive            bool
	CreatedAt, UpdatedAt time.Time
}

func scanContact(row pgx.Row) (*contactRow, error) {
	var c contactRow
	err := row.Scan(
		&c.ID, &c.CompanyID, &c.Name, &c.Phone, &c.Tag, &c.Notes,
		&c.TelegramChatID, &c.TelegramLinkStatus, &c.TelegramLinkedAt,
		&c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	return &c, err
}

func contactToMap(c *contactRow, balances map[string]float64) map[string]any {
	m := map[string]any{
		"id": c.ID, "companyId": c.CompanyID, "name": c.Name,
		"phone": c.Phone, "tag": c.Tag, "notes": c.Notes,
		"telegramChatId": c.TelegramChatID, "telegramLinkStatus": c.TelegramLinkStatus,
		"telegramLinkedAt": c.TelegramLinkedAt, "isActive": c.IsActive,
		"createdAt": c.CreatedAt, "updatedAt": c.UpdatedAt,
	}
	if balances != nil {
		m["balances"] = balances
		m["side"] = balanceSide(balances)
	}
	return m
}

func (r *Repository) loadContactBalances(ctx context.Context, contactID string) (map[string]float64, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT type, amount, currency FROM "PartnerLedgerOperation" WHERE "contactId" = $1
	`, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ops := []opBalanceRow{}
	for rows.Next() {
		var o opBalanceRow
		if err := rows.Scan(&o.Type, &o.Amount, &o.Currency); err != nil {
			return nil, err
		}
		ops = append(ops, o)
	}
	return computeBalances(ops), rows.Err()
}

func (r *Repository) GetGlobalSummary(ctx context.Context, companyID string) (map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT o.type, o.amount, o.currency
		FROM "PartnerLedgerOperation" o
		JOIN "PartnerLedgerContact" c ON c.id = o."contactId"
		WHERE o."companyId" = $1 AND c."isActive" = true
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ops := []opBalanceRow{}
	for rows.Next() {
		var o opBalanceRow
		if err := rows.Scan(&o.Type, &o.Amount, &o.Currency); err != nil {
			return nil, err
		}
		ops = append(ops, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	totals := computeBalances(ops)
	weOwe := map[string]float64{}
	theyOwe := map[string]float64{}
	for cur, val := range totals {
		if val < 0 {
			weOwe[cur] = val
		}
		if val > 0 {
			theyOwe[cur] = val
		}
	}
	var contactCount int
	_ = r.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "PartnerLedgerContact" WHERE "companyId" = $1 AND "isActive" = true
	`, companyID).Scan(&contactCount)
	return map[string]any{
		"weOwe": weOwe, "theyOwe": theyOwe, "totals": totals, "contactCount": contactCount,
	}, nil
}

func (r *Repository) ListContactsForSelect(ctx context.Context, companyID, search string) ([]map[string]any, error) {
	where := `c."companyId" = $1 AND c."isActive" = true`
	args := []any{companyID}
	if strings.TrimSpace(search) != "" {
		where += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2)`
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT c.id, c.name, c.phone, c.tag FROM "PartnerLedgerContact" c
		WHERE %s ORDER BY c.name ASC LIMIT 100
	`, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	ids := []string{}
	for rows.Next() {
		var id, name string
		var phone, tag *string
		if err := rows.Scan(&id, &name, &phone, &tag); err != nil {
			return nil, err
		}
		ids = append(ids, id)
		out = append(out, map[string]any{"id": id, "name": name, "phone": phone, "tag": tag})
	}
	if len(ids) == 0 {
		return out, rows.Err()
	}
	opRows, err := r.pool.Query(ctx, `
		SELECT "contactId", type, amount, currency FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "contactId" = ANY($2)
	`, companyID, ids)
	if err != nil {
		return nil, err
	}
	defer opRows.Close()
	byContact := map[string][]opBalanceRow{}
	for opRows.Next() {
		var cid string
		var o opBalanceRow
		if err := opRows.Scan(&cid, &o.Type, &o.Amount, &o.Currency); err != nil {
			return nil, err
		}
		byContact[cid] = append(byContact[cid], o)
	}
	for i, item := range out {
		id := item["id"].(string)
		totals := computeBalances(byContact[id])
		out[i]["side"] = balanceSide(totals)
	}
	return out, opRows.Err()
}

func (r *Repository) ListContacts(ctx context.Context, companyID, search string) ([]map[string]any, error) {
	where := `c."companyId" = $1 AND c."isActive" = true`
	args := []any{companyID}
	if strings.TrimSpace(search) != "" {
		where += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.tag ILIKE $2)`
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT c.id, c.name, c.phone, c.tag, c.notes, c."telegramLinkStatus", c."telegramLinkedAt",
		       (SELECT COUNT(*)::int FROM "PartnerLedgerOperation" o WHERE o."contactId" = c.id) AS op_count,
		       (SELECT o.type FROM "PartnerLedgerOperation" o WHERE o."contactId" = c.id
		        ORDER BY o."operationDate" DESC LIMIT 1) AS last_type,
		       (SELECT o."operationDate" FROM "PartnerLedgerOperation" o WHERE o."contactId" = c.id
		        ORDER BY o."operationDate" DESC LIMIT 1) AS last_date
		FROM "PartnerLedgerContact" c
		WHERE %s ORDER BY c.name ASC
	`, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type listItem struct {
		id, name string
		phone, tag, notes *string
		telegramStatus    string
		telegramLinkedAt  *time.Time
		opCount           int
		lastType          *string
		lastDate          *time.Time
	}
	items := []listItem{}
	ids := []string{}
	for rows.Next() {
		var it listItem
		if err := rows.Scan(&it.id, &it.name, &it.phone, &it.tag, &it.notes, &it.telegramStatus, &it.telegramLinkedAt,
			&it.opCount, &it.lastType, &it.lastDate); err != nil {
			return nil, err
		}
		items = append(items, it)
		ids = append(ids, it.id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	byContact := map[string][]opBalanceRow{}
	if len(ids) > 0 {
		opRows, err := r.pool.Query(ctx, `
			SELECT "contactId", type, amount, currency FROM "PartnerLedgerOperation"
			WHERE "companyId" = $1 AND "contactId" = ANY($2)
		`, companyID, ids)
		if err != nil {
			return nil, err
		}
		for opRows.Next() {
			var cid string
			var o opBalanceRow
			if err := opRows.Scan(&cid, &o.Type, &o.Amount, &o.Currency); err != nil {
				opRows.Close()
				return nil, err
			}
			byContact[cid] = append(byContact[cid], o)
		}
		opRows.Close()
	}

	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		balances := computeBalances(byContact[it.id])
		entry := map[string]any{
			"id": it.id, "name": it.name, "phone": it.phone, "tag": it.tag, "notes": it.notes,
			"telegramLinkStatus": it.telegramStatus, "telegramLinkedAt": it.telegramLinkedAt,
			"balances": balances, "side": balanceSide(balances), "operationCount": it.opCount,
		}
		if it.lastType != nil && it.lastDate != nil {
			label := OperationTypeLabels[*it.lastType]
			if label == "" {
				label = *it.lastType
			}
			entry["lastOperation"] = map[string]any{
				"type": *it.lastType, "typeLabel": label, "operationDate": *it.lastDate,
			}
		} else {
			entry["lastOperation"] = nil
		}
		out = append(out, entry)
	}
	return out, nil
}

func (r *Repository) GetContact(ctx context.Context, companyID, contactID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, "companyId", name, phone, tag, notes, "telegramChatId", "telegramLinkStatus",
		       "telegramLinkedAt", "isActive", "createdAt", "updatedAt"
		FROM "PartnerLedgerContact" WHERE id = $1 AND "companyId" = $2
	`, contactID, companyID)
	c, err := scanContact(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrContactNotFound
	}
	if err != nil {
		return nil, err
	}
	balances, err := r.loadContactBalances(ctx, contactID)
	if err != nil {
		return nil, err
	}
	return contactToMap(c, balances), nil
}

func (r *Repository) GetActiveContactBrief(ctx context.Context, companyID, contactID string) (id, name string, telegramChatID *string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT id, name, "telegramChatId" FROM "PartnerLedgerContact"
		WHERE id = $1 AND "companyId" = $2 AND "isActive" = true
	`, contactID, companyID).Scan(&id, &name, &telegramChatID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil, ErrContactNotFound
	}
	return id, name, telegramChatID, err
}

func (r *Repository) CreateContact(ctx context.Context, companyID, name string, phone, tag, notes *string) (map[string]any, error) {
	id := uuid.NewString()
	row := r.pool.QueryRow(ctx, `
		INSERT INTO "PartnerLedgerContact" (id, "companyId", name, phone, tag, notes, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id, "companyId", name, phone, tag, notes, "telegramChatId", "telegramLinkStatus",
		          "telegramLinkedAt", "isActive", "createdAt", "updatedAt"
	`, id, companyID, name, phone, tag, notes)
	c, err := scanContact(row)
	if err != nil {
		return nil, err
	}
	return contactToMap(c, nil), nil
}

func (r *Repository) UpdateContact(ctx context.Context, contactID string, sets map[string]any) (map[string]any, error) {
	if len(sets) == 0 {
		row := r.pool.QueryRow(ctx, `
			SELECT id, "companyId", name, phone, tag, notes, "telegramChatId", "telegramLinkStatus",
			       "telegramLinkedAt", "isActive", "createdAt", "updatedAt"
			FROM "PartnerLedgerContact" WHERE id = $1
		`, contactID)
		c, err := scanContact(row)
		if err != nil {
			return nil, err
		}
		return contactToMap(c, nil), nil
	}
	parts := []string{}
	args := []any{}
	n := 1
	for k, v := range sets {
		parts = append(parts, fmt.Sprintf(`"%s" = $%d`, k, n))
		args = append(args, v)
		n++
	}
	parts = append(parts, `"updatedAt" = NOW()`)
	args = append(args, contactID)
	query := fmt.Sprintf(`
		UPDATE "PartnerLedgerContact" SET %s WHERE id = $%d
		RETURNING id, "companyId", name, phone, tag, notes, "telegramChatId", "telegramLinkStatus",
		          "telegramLinkedAt", "isActive", "createdAt", "updatedAt"
	`, strings.Join(parts, ", "), n)
	row := r.pool.QueryRow(ctx, query, args...)
	c, err := scanContact(row)
	if err != nil {
		return nil, err
	}
	return contactToMap(c, nil), nil
}

func (r *Repository) CountContactOperations(ctx context.Context, contactID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "PartnerLedgerOperation" WHERE "contactId" = $1`, contactID).Scan(&n)
	return n, err
}

func (r *Repository) DeleteContact(ctx context.Context, contactID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM "PartnerLedgerContact" WHERE id = $1`, contactID)
	return err
}

func (r *Repository) SoftDeleteContact(ctx context.Context, contactID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE "PartnerLedgerContact" SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, contactID)
	return err
}

func (r *Repository) CreateAuditLog(ctx context.Context, companyID, userID, action, entityType, entityID string, newData any) error {
	var newDataBytes []byte
	if newData != nil {
		b, err := json.Marshal(newData)
		if err != nil {
			return err
		}
		newDataBytes = b
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`, uuid.NewString(), companyID, userID, action, entityType, entityID, string(newDataBytes))
	return err
}

type operationRow struct {
	ID, CompanyID, ContactID, Type, Currency string
	Amount, Quantity                         float64
	QuantityNull                             bool
	Notes, SourceType, SourceID, ProductSummary *string
	ReversedByID                             *string
	OperationDate, CreatedAt, UpdatedAt      time.Time
	CreatedByID, CreatedByName, CreatedByLogin string
}

func mapOperationItem(o operationRow, saleStatus *struct{ Status, Comment string }) map[string]any {
	qty := any(nil)
	if !o.QuantityNull {
		qty = o.Quantity
	}
	fromStock := false
	if o.SourceType != nil {
		st := *o.SourceType
		fromStock = strings.HasPrefix(st, "STOCK_") || st == "PARTNER_SALE_ORDER"
	}
	isSaleOrder := o.SourceType != nil && *o.SourceType == "PARTNER_SALE_ORDER"
	hasLineDetail := o.SourceType != nil && o.SourceID != nil &&
		(o.Type == "SALE_OUT" || o.Type == "MATERIAL_IN") &&
		(*o.SourceType == "PARTNER_SALE_ORDER" || *o.SourceType == "STOCK_OUT_MANUAL" ||
			*o.SourceType == "STOCK_IN_MANUAL" || *o.SourceType == "STOCK_IN_EXCEL")

	label := OperationTypeLabels[o.Type]
	if label == "" {
		label = o.Type
	}
	item := map[string]any{
		"id": o.ID, "companyId": o.CompanyID, "contactId": o.ContactID,
		"type": o.Type, "amount": o.Amount, "currency": o.Currency,
		"operationDate": o.OperationDate, "notes": o.Notes,
		"sourceType": o.SourceType, "sourceId": o.SourceID,
		"quantity": qty, "productSummary": o.ProductSummary,
		"reversedById": o.ReversedByID, "createdAt": o.CreatedAt, "updatedAt": o.UpdatedAt,
		"createdById": o.CreatedByID,
		"createdBy": map[string]any{"id": o.CreatedByID, "fullName": o.CreatedByName, "login": o.CreatedByLogin},
		"typeLabel": label, "balanceDelta": BalanceDelta(o.Type, o.Amount),
		"fromStock": fromStock, "isSaleOrder": isSaleOrder, "hasLineDetail": hasLineDetail,
		"saleOrderStatus": nil, "saleOrderComment": nil,
	}
	if saleStatus != nil {
		item["saleOrderStatus"] = saleStatus.Status
		item["saleOrderComment"] = saleStatus.Comment
	}
	return item
}

func (r *Repository) ListOperations(ctx context.Context, companyID, contactID string, page, limit int) (map[string]any, error) {
	skip := (page - 1) * limit
	var total int
	_ = r.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "PartnerLedgerOperation" WHERE "companyId" = $1 AND "contactId" = $2
	`, companyID, contactID).Scan(&total)

	rows, err := r.pool.Query(ctx, `
		SELECT o.id, o."companyId", o."contactId", o.type, o.amount, o.currency, o."operationDate",
		       o.notes, o."sourceType", o."sourceId", o.quantity, o."productSummary", o."reversedById",
		       o."createdAt", o."updatedAt", o."createdById", u."fullName", u.login
		FROM "PartnerLedgerOperation" o
		JOIN "User" u ON u.id = o."createdById"
		WHERE o."companyId" = $1 AND o."contactId" = $2
		ORDER BY o."operationDate" DESC, o."createdAt" DESC
		LIMIT $3 OFFSET $4
	`, companyID, contactID, limit, skip)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []map[string]any{}
	batchIDs := []string{}
	raw := []operationRow{}
	for rows.Next() {
		var o operationRow
		var qty *float64
		if err := rows.Scan(
			&o.ID, &o.CompanyID, &o.ContactID, &o.Type, &o.Amount, &o.Currency, &o.OperationDate,
			&o.Notes, &o.SourceType, &o.SourceID, &qty, &o.ProductSummary, &o.ReversedByID,
			&o.CreatedAt, &o.UpdatedAt, &o.CreatedByID, &o.CreatedByName, &o.CreatedByLogin,
		); err != nil {
			return nil, err
		}
		if qty != nil {
			o.Quantity = *qty
		} else {
			o.QuantityNull = true
		}
		raw = append(raw, o)
		if o.SourceType != nil && *o.SourceType == "PARTNER_SALE_ORDER" && o.SourceID != nil {
			batchIDs = append(batchIDs, *o.SourceID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	statusMap := map[string]struct{ Status, Comment string }{}
	if len(batchIDs) > 0 {
		stRows, err := r.pool.Query(ctx, `
			SELECT "batchId", status, comment FROM "PartnerLedgerSaleOrderStatus"
			WHERE "companyId" = $1 AND "batchId" = ANY($2)
		`, companyID, batchIDs)
		if err != nil {
			return nil, err
		}
		for stRows.Next() {
			var bid, status string
			var comment *string
			if err := stRows.Scan(&bid, &status, &comment); err != nil {
				stRows.Close()
				return nil, err
			}
			c := ""
			if comment != nil {
				c = *comment
			}
			statusMap[bid] = struct{ Status, Comment string }{status, c}
		}
		stRows.Close()
	}

	for _, o := range raw {
		var st *struct{ Status, Comment string }
		if o.SourceID != nil {
			if s, ok := statusMap[*o.SourceID]; ok {
				st = &s
			}
		}
		items = append(items, mapOperationItem(o, st))
	}
	return map[string]any{"items": items, "total": total, "page": page, "limit": limit}, nil
}

func (r *Repository) GetBalanceHistory(ctx context.Context, companyID, contactID string, days int) (map[string]any, error) {
	from := time.Now().AddDate(0, 0, -days)
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, from.Location())

	beforeRows, err := r.pool.Query(ctx, `
		SELECT type, amount, currency FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "contactId" = $2 AND "operationDate" < $3
	`, companyID, contactID, from)
	if err != nil {
		return nil, err
	}
	beforeOps := []opBalanceRow{}
	for beforeRows.Next() {
		var o opBalanceRow
		if err := beforeRows.Scan(&o.Type, &o.Amount, &o.Currency); err != nil {
			beforeRows.Close()
			return nil, err
		}
		beforeOps = append(beforeOps, o)
	}
	beforeRows.Close()

	running := computeBalances(beforeOps)
	periodRows, err := r.pool.Query(ctx, `
		SELECT type, amount, currency, "operationDate" FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "contactId" = $2 AND "operationDate" >= $3
		ORDER BY "operationDate" ASC
	`, companyID, contactID, from)
	if err != nil {
		return nil, err
	}
	defer periodRows.Close()

	byDay := map[string][]opBalanceRow{}
	for periodRows.Next() {
		var o opBalanceRow
		var dt time.Time
		if err := periodRows.Scan(&o.Type, &o.Amount, &o.Currency, &dt); err != nil {
			return nil, err
		}
		key := dt.UTC().Format("2006-01-02")
		byDay[key] = append(byDay[key], o)
	}

	points := []map[string]any{}
	for i := 0; i <= days; i++ {
		day := from.AddDate(0, 0, i)
		key := day.UTC().Format("2006-01-02")
		for _, op := range byDay[key] {
			cur := NormalizeCurrency(op.Currency)
			running[cur] += BalanceDelta(op.Type, op.Amount)
		}
		points = append(points, map[string]any{
			"date": key, "UZS": running["UZS"], "USD": running["USD"],
		})
	}
	return map[string]any{"points": points, "days": days}, nil
}

func (r *Repository) FindOperation(ctx context.Context, companyID, operationID string) (*operationRow, error) {
	var o operationRow
	var qty *float64
	err := r.pool.QueryRow(ctx, `
		SELECT o.id, o."companyId", o."contactId", o.type, o.amount, o.currency, o."operationDate",
		       o.notes, o."sourceType", o."sourceId", o.quantity, o."productSummary", o."reversedById",
		       o."createdAt", o."updatedAt", o."createdById", u."fullName", u.login
		FROM "PartnerLedgerOperation" o
		JOIN "User" u ON u.id = o."createdById"
		WHERE o.id = $1 AND o."companyId" = $2
	`, operationID, companyID).Scan(
		&o.ID, &o.CompanyID, &o.ContactID, &o.Type, &o.Amount, &o.Currency, &o.OperationDate,
		&o.Notes, &o.SourceType, &o.SourceID, &qty, &o.ProductSummary, &o.ReversedByID,
		&o.CreatedAt, &o.UpdatedAt, &o.CreatedByID, &o.CreatedByName, &o.CreatedByLogin,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOperationNotFound
	}
	if qty != nil {
		o.Quantity = *qty
	} else {
		o.QuantityNull = true
	}
	return &o, err
}

func (r *Repository) CreateOperation(ctx context.Context, companyID, contactID, userID, opType string, amount float64, currency string, operationDate time.Time, notes *string) (*operationRow, error) {
	id := uuid.NewString()
	var o operationRow
	var qty *float64
	err := r.pool.QueryRow(ctx, `
		INSERT INTO "PartnerLedgerOperation" (
			id, "companyId", "contactId", type, amount, currency, "operationDate", notes, "createdById", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, "companyId", "contactId", type, amount, currency, "operationDate",
		          notes, "sourceType", "sourceId", quantity, "productSummary", "reversedById",
		          "createdAt", "updatedAt", "createdById"
	`, id, companyID, contactID, opType, amount, currency, operationDate, notes, userID).Scan(
		&o.ID, &o.CompanyID, &o.ContactID, &o.Type, &o.Amount, &o.Currency, &o.OperationDate,
		&o.Notes, &o.SourceType, &o.SourceID, &qty, &o.ProductSummary, &o.ReversedByID,
		&o.CreatedAt, &o.UpdatedAt, &o.CreatedByID,
	)
	if err != nil {
		return nil, err
	}
	if qty != nil {
		o.Quantity = *qty
	} else {
		o.QuantityNull = true
	}
	_ = r.pool.QueryRow(ctx, `SELECT "fullName", login FROM "User" WHERE id = $1`, userID).Scan(&o.CreatedByName, &o.CreatedByLogin)
	return &o, nil
}

func (r *Repository) UpdateOperation(ctx context.Context, operationID string, sets map[string]any) (*operationRow, error) {
	parts := []string{}
	args := []any{}
	n := 1
	for k, v := range sets {
		col := k
		if col == "operationDate" {
			col = "operationDate"
		}
		parts = append(parts, fmt.Sprintf(`"%s" = $%d`, col, n))
		args = append(args, v)
		n++
	}
	parts = append(parts, `"updatedAt" = NOW()`)
	args = append(args, operationID)
	query := fmt.Sprintf(`
		UPDATE "PartnerLedgerOperation" SET %s WHERE id = $%d
		RETURNING id, "companyId", "contactId", type, amount, currency, "operationDate",
		          notes, "sourceType", "sourceId", quantity, "productSummary", "reversedById",
		          "createdAt", "updatedAt", "createdById"
	`, strings.Join(parts, ", "), n)
	var o operationRow
	var qty *float64
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&o.ID, &o.CompanyID, &o.ContactID, &o.Type, &o.Amount, &o.Currency, &o.OperationDate,
		&o.Notes, &o.SourceType, &o.SourceID, &qty, &o.ProductSummary, &o.ReversedByID,
		&o.CreatedAt, &o.UpdatedAt, &o.CreatedByID,
	)
	if err != nil {
		return nil, err
	}
	if qty != nil {
		o.Quantity = *qty
	} else {
		o.QuantityNull = true
	}
	_ = r.pool.QueryRow(ctx, `SELECT "fullName", login FROM "User" WHERE id = $1`, o.CreatedByID).Scan(&o.CreatedByName, &o.CreatedByLogin)
	return &o, nil
}

func (r *Repository) DeleteOperation(ctx context.Context, operationID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM "PartnerLedgerOperation" WHERE id = $1`, operationID)
	return err
}

func parsePageLimit(pageStr, limitStr string) (page, limit int) {
	page, _ = strconv.Atoi(pageStr)
	limit, _ = strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}
	return page, limit
}

func (r *Repository) WarehouseExists(ctx context.Context, warehouseID, companyID string) (name string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT name FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status <> 'ARCHIVED'
	`, warehouseID, companyID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrWarehouseNotFound
	}
	return name, err
}

func (r *Repository) AppendSaleOrderStatus(ctx context.Context, companyID, contactID, batchID, status, source string, comment, updatedByID *string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "PartnerLedgerSaleOrderStatus"
			("companyId", "contactId", "batchId", status, comment, source, "updatedById", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT ("companyId", "batchId") DO UPDATE SET
			"contactId" = EXCLUDED."contactId",
			status = EXCLUDED.status,
			comment = EXCLUDED.comment,
			source = EXCLUDED.source,
			"updatedById" = EXCLUDED."updatedById",
			"updatedAt" = NOW()
	`, companyID, contactID, batchID, status, comment, source, updatedByID)
	return err
}

func (r *Repository) FindSaleOrderOperationID(ctx context.Context, companyID, contactID, batchID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM "PartnerLedgerOperation"
		WHERE "companyId" = $1 AND "contactId" = $2 AND "sourceId" = $3
		  AND "sourceType" = 'PARTNER_SALE_ORDER' AND "reversedById" IS NULL
		LIMIT 1
	`, companyID, contactID, batchID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrSaleOrderNotFound
	}
	return id, err
}
