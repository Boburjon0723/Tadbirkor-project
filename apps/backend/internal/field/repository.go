package field

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

type taskRow struct {
	ID, CompanyID, AssigneeID, SourceWarehouseID, Title, Status string
	Description, CustomerName, CustomerPhone, Address           *string
	CreatedByID, ApprovedByID                                   *string
	Lat, Lng                                                    *float64
	ScheduledAt, ApprovedAt, CreatedAt, UpdatedAt               *time.Time
	PlannedItemsJSON                                            []byte
	AssigneeName, AssigneeLogin                                 string
	AssigneePhone                                               *string
	WarehouseName                                               string
	CreatorName                                                 *string
}

type reportRow struct {
	ID, FieldTaskID string
	ItemsJSON       []byte
	PhotosJSON      []byte
	GpsLat, GpsLng, GpsDistanceM                                *float64
	Comment                                                     *string
	SubmittedAt                                                 time.Time
}

const taskSelectBase = `
	SELECT t.id, t."companyId", t."assigneeId", t."sourceWarehouseId", t.title, t.status,
	       t.description, t."customerName", t."customerPhone", t.address, t."createdById", t."approvedById",
	       t.lat, t.lng, t."scheduledAt", t."approvedAt", t."createdAt", t."updatedAt",
	       t."plannedItems"::text,
	       a."fullName", a.login, a.phone,
	       w.name,
	       cb."fullName"
	FROM "FieldTask" t
	JOIN "User" a ON a.id = t."assigneeId"
	JOIN "Warehouse" w ON w.id = t."sourceWarehouseId"
	LEFT JOIN "User" cb ON cb.id = t."createdById"
`

func (r *Repository) scanTask(row pgx.Row) (*taskRow, error) {
	var t taskRow
	err := row.Scan(
		&t.ID, &t.CompanyID, &t.AssigneeID, &t.SourceWarehouseID, &t.Title, &t.Status,
		&t.Description, &t.CustomerName, &t.CustomerPhone, &t.Address, &t.CreatedByID, &t.ApprovedByID,
		&t.Lat, &t.Lng, &t.ScheduledAt, &t.ApprovedAt, &t.CreatedAt, &t.UpdatedAt,
		&t.PlannedItemsJSON,
		&t.AssigneeName, &t.AssigneeLogin, &t.AssigneePhone,
		&t.WarehouseName, &t.CreatorName,
	)
	return &t, err
}

func parsePlannedItems(raw []byte) []PlannedItem {
	if len(raw) == 0 {
		return nil
	}
	var items []PlannedItem
	_ = json.Unmarshal(raw, &items)
	return items
}

func (r *Repository) mapTask(ctx context.Context, t *taskRow, withReport, withApprovals bool) (map[string]any, error) {
	planned := parsePlannedItems(t.PlannedItemsJSON)
	m := map[string]any{
		"id": t.ID, "companyId": t.CompanyID, "assigneeId": t.AssigneeID,
		"sourceWarehouseId": t.SourceWarehouseID, "title": t.Title, "status": t.Status,
		"description": t.Description, "customerName": t.CustomerName,
		"customerPhone": t.CustomerPhone, "address": t.Address,
		"createdById": t.CreatedByID, "approvedById": t.ApprovedByID,
		"lat": t.Lat, "lng": t.Lng, "scheduledAt": t.ScheduledAt,
		"approvedAt": t.ApprovedAt, "createdAt": t.CreatedAt, "updatedAt": t.UpdatedAt,
		"plannedItems": planned,
		"assignee": map[string]any{
			"id": t.AssigneeID, "fullName": t.AssigneeName, "login": t.AssigneeLogin, "phone": t.AssigneePhone,
		},
		"sourceWarehouse": map[string]any{"id": t.SourceWarehouseID, "name": t.WarehouseName},
	}
	if t.CreatedByID != nil && t.CreatorName != nil {
		m["createdBy"] = map[string]any{"id": *t.CreatedByID, "fullName": *t.CreatorName}
	} else {
		m["createdBy"] = nil
	}
	if withReport {
		rep, err := r.loadReport(ctx, t.ID)
		if err != nil {
			return nil, err
		}
		m["report"] = rep
	}
	if withApprovals {
		approvals, err := r.loadApprovals(ctx, t.ID, 5)
		if err != nil {
			return nil, err
		}
		m["approvals"] = approvals
	}
	return m, nil
}

func (r *Repository) loadReport(ctx context.Context, taskID string) (any, error) {
	var rep reportRow
	err := r.pool.QueryRow(ctx, `
		SELECT id, "fieldTaskId", items::text, photos::text, "gpsLat", "gpsLng", "gpsDistanceM", comment, "submittedAt"
		FROM "FieldTaskReport" WHERE "fieldTaskId" = $1
	`, taskID).Scan(&rep.ID, &rep.FieldTaskID, &rep.ItemsJSON, &rep.PhotosJSON,
		&rep.GpsLat, &rep.GpsLng, &rep.GpsDistanceM, &rep.Comment, &rep.SubmittedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var items []ReportItem
	var photos []string
	_ = json.Unmarshal(rep.ItemsJSON, &items)
	_ = json.Unmarshal(rep.PhotosJSON, &photos)
	return map[string]any{
		"id": rep.ID, "fieldTaskId": rep.FieldTaskID, "items": items, "photos": photos,
		"gpsLat": rep.GpsLat, "gpsLng": rep.GpsLng, "gpsDistanceM": rep.GpsDistanceM,
		"comment": rep.Comment, "submittedAt": rep.SubmittedAt,
	}, nil
}

func (r *Repository) loadApprovals(ctx context.Context, taskID string, limit int) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, "reportId", "fieldTaskId", "approverId", decision, reason, channel, "decidedAt"
		FROM "FieldTaskApproval"
		WHERE "fieldTaskId" = $1
		ORDER BY "decidedAt" DESC
		LIMIT $2
	`, taskID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, reportID, fieldTaskID, decision, channel string
		var approverID, reason *string
		var decidedAt time.Time
		if err := rows.Scan(&id, &reportID, &fieldTaskID, &approverID, &decision, &reason, &channel, &decidedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "reportId": reportID, "fieldTaskId": fieldTaskID,
			"approverId": approverID, "decision": decision, "reason": reason,
			"channel": channel, "decidedAt": decidedAt,
		})
	}
	return out, rows.Err()
}

func (r *Repository) ListTasks(ctx context.Context, companyID string, status, assigneeID, warehouseID *string) ([]map[string]any, error) {
	where := `t."companyId" = $1`
	args := []any{companyID}
	n := 2
	if status != nil && strings.TrimSpace(*status) != "" {
		where += fmt.Sprintf(` AND t.status = $%d`, n)
		args = append(args, *status)
		n++
	}
	if assigneeID != nil && strings.TrimSpace(*assigneeID) != "" {
		where += fmt.Sprintf(` AND t."assigneeId" = $%d`, n)
		args = append(args, *assigneeID)
		n++
	}
	if warehouseID != nil && strings.TrimSpace(*warehouseID) != "" {
		where += fmt.Sprintf(` AND t."sourceWarehouseId" = $%d`, n)
		args = append(args, *warehouseID)
		n++
	}
	query := taskSelectBase + ` WHERE ` + where + ` ORDER BY t."createdAt" DESC LIMIT 100`
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		t, err := r.scanTask(rows)
		if err != nil {
			return nil, err
		}
		rep, _ := r.loadReport(ctx, t.ID)
		m, err := r.mapTask(ctx, t, false, false)
		if err != nil {
			return nil, err
		}
		m["report"] = rep
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) FindTask(ctx context.Context, companyID, taskID string, withApprovals bool) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, taskSelectBase+` WHERE t.id = $1 AND t."companyId" = $2`, taskID, companyID)
	t, err := r.scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTaskNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.mapTask(ctx, t, true, withApprovals)
}

func (r *Repository) AssertFieldWorker(ctx context.Context, companyID, userID string) (warehouseID string, err error) {
	var role string
	var whID *string
	err = r.pool.QueryRow(ctx, `
		SELECT role, "warehouseId" FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2
	`, companyID, userID).Scan(&role, &whID)
	if errors.Is(err, pgx.ErrNoRows) || role != "FIELD_WORKER" {
		return "", errBadRequest("Tayinlangan xodim FIELD_WORKER roliga ega bo'lishi kerak")
	}
	if whID == nil || *whID == "" {
		return "", errBadRequest("Dala xodimi omborga biriktirilmagan")
	}
	return *whID, nil
}

func (r *Repository) WarehouseExists(ctx context.Context, companyID, warehouseID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `
		SELECT name FROM "Warehouse" WHERE id = $1 AND "companyId" = $2
	`, warehouseID, companyID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrWarehouseNotFound
	}
	return name, err
}

func (r *Repository) ListMyTasks(ctx context.Context, companyID, userID string, status *string) ([]map[string]any, error) {
	where := `t."companyId" = $1 AND t."assigneeId" = $2`
	args := []any{companyID, userID}
	if status != nil && strings.TrimSpace(*status) != "" {
		where += ` AND t.status = $3`
		args = append(args, *status)
	}
	query := taskSelectBase + ` WHERE ` + where + ` ORDER BY t."scheduledAt" ASC NULLS LAST`
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		t, err := r.scanTask(rows)
		if err != nil {
			return nil, err
		}
		rep, _ := r.loadReport(ctx, t.ID)
		m, err := r.mapTask(ctx, t, false, false)
		if err != nil {
			return nil, err
		}
		m["report"] = rep
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) GetAssigneeName(ctx context.Context, companyID, userID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `
		SELECT u."fullName" FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1 AND cu."userId" = $2
	`, companyID, userID).Scan(&name)
	return name, err
}

func (r *Repository) LoadVariantLabels(ctx context.Context, companyID string, items []PlannedItem) ([]PlannedItem, error) {
	if len(items) == 0 {
		return items, nil
	}
	ids := make([]string, len(items))
	for i, it := range items {
		ids[i] = it.VariantID
	}
	rows, err := r.pool.Query(ctx, `
		SELECT v.id, v.name, p.name FROM "ProductVariant" v
		JOIN "Product" p ON p.id = v."productId"
		WHERE v."companyId" = $1 AND v.id = ANY($2)
	`, companyID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	labels := map[string]struct{ product, variant string }{}
	for rows.Next() {
		var id, variant, product string
		if err := rows.Scan(&id, &variant, &product); err != nil {
			return nil, err
		}
		labels[id] = struct{ product, variant string }{product, variant}
	}
	out := make([]PlannedItem, len(items))
	for i, it := range items {
		out[i] = it
		if it.Label != "" {
			continue
		}
		if l, ok := labels[it.VariantID]; ok {
			vn := strings.TrimSpace(l.variant)
			if vn != "" && vn != l.product {
				out[i].Label = l.product + " · " + vn
			} else {
				out[i].Label = l.product
			}
		} else {
			out[i].Label = "Mahsulot"
		}
	}
	return out, rows.Err()
}

func (r *Repository) CreateTaskTx(
	ctx context.Context, tx pgx.Tx,
	companyID, userID string, input CreateFieldTaskInput, planned []PlannedItem,
) (string, error) {
	plannedJSON, _ := json.Marshal(planned)
	id := uuid.NewString()
	var scheduledAt any
	if input.ScheduledAt != nil && strings.TrimSpace(*input.ScheduledAt) != "" {
		if t, err := time.Parse(time.RFC3339, strings.TrimSpace(*input.ScheduledAt)); err == nil {
			scheduledAt = t
		} else if t, err := time.Parse("2006-01-02", strings.TrimSpace(*input.ScheduledAt)); err == nil {
			scheduledAt = t
		}
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO "FieldTask" (
			id, "companyId", "assigneeId", "sourceWarehouseId", "createdById",
			title, description, "customerName", "customerPhone", address, lat, lng,
			"scheduledAt", status, "plannedItems", "createdAt", "updatedAt"
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
	`, id, companyID, input.AssigneeID, input.SourceWarehouseID, userID,
		input.Title, input.Description, input.CustomerName, input.CustomerPhone,
		input.Address, input.Lat, input.Lng, scheduledAt, StatusAssigned, plannedJSON)
	return id, err
}

func (r *Repository) UpsertUserStockTx(ctx context.Context, tx pgx.Tx, companyID, userID, variantID, warehouseID string, qty float64) error {
	q := int(qty)
	if q < 1 {
		q = 1
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO "UserStock" (id, "companyId", "userId", "productVariantId", "sourceWarehouseId", quantity, "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT ("userId", "productVariantId", "sourceWarehouseId")
		DO UPDATE SET quantity = "UserStock".quantity + EXCLUDED.quantity, "updatedAt" = NOW()
	`, uuid.NewString(), companyID, userID, variantID, warehouseID, q)
	return err
}

func (r *Repository) CreateAuditLogTx(ctx context.Context, tx pgx.Tx, companyID, userID, action, entityID string, newData any) error {
	var data any
	if newData != nil {
		b, _ := json.Marshal(newData)
		data = b
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES ($1, $2, $3, $4, 'FIELD_TASK', $5, $6, NOW())
	`, uuid.NewString(), companyID, userID, action, entityID, data)
	return err
}

func (r *Repository) UpdateTaskStatus(ctx context.Context, taskID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE "FieldTask" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, status, taskID)
	return err
}

func (r *Repository) AcceptTask(ctx context.Context, taskID string) error {
	return r.UpdateTaskStatus(ctx, taskID, StatusInProgress)
}

func (r *Repository) UpsertReportTx(ctx context.Context, tx pgx.Tx, taskID string, items []ReportItem, photos []string, gpsLat, gpsLng, gpsDistanceM *float64, comment *string) error {
	itemsJSON, _ := json.Marshal(items)
	photosJSON, _ := json.Marshal(photos)
	_, err := tx.Exec(ctx, `
		INSERT INTO "FieldTaskReport" (id, "fieldTaskId", items, photos, "gpsLat", "gpsLng", "gpsDistanceM", comment, "submittedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT ("fieldTaskId") DO UPDATE SET
			items = EXCLUDED.items, photos = EXCLUDED.photos,
			"gpsLat" = EXCLUDED."gpsLat", "gpsLng" = EXCLUDED."gpsLng",
			"gpsDistanceM" = EXCLUDED."gpsDistanceM", comment = EXCLUDED.comment,
			"submittedAt" = NOW()
	`, uuid.NewString(), taskID, itemsJSON, photosJSON, gpsLat, gpsLng, gpsDistanceM, comment)
	return err
}

func (r *Repository) GetUserStockTx(ctx context.Context, tx pgx.Tx, userID, variantID, warehouseID string) (id string, quantity int, err error) {
	err = tx.QueryRow(ctx, `
		SELECT id, quantity FROM "UserStock"
		WHERE "userId" = $1 AND "productVariantId" = $2 AND "sourceWarehouseId" = $3
	`, userID, variantID, warehouseID).Scan(&id, &quantity)
	return id, quantity, err
}

func (r *Repository) DecrementUserStockTx(ctx context.Context, tx pgx.Tx, stockID string, qty float64) error {
	q := int(qty)
	_, err := tx.Exec(ctx, `UPDATE "UserStock" SET quantity = quantity - $1, "updatedAt" = NOW() WHERE id = $2`, q, stockID)
	return err
}

func (r *Repository) InsertMovementOnlyTx(ctx context.Context, tx pgx.Tx, companyID, warehouseID, variantID, userID, movementType, sourceType, sourceID string, qty float64, note string) error {
	var src any
	if sourceID != "" {
		src = sourceID
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO "StockMovement" (id, "companyId", "warehouseId", "productVariantId", type, quantity, "sourceType", "sourceId", note, "createdBy", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	`, companyID, warehouseID, variantID, movementType, qty, sourceType, src, note, userID)
	return err
}

func (r *Repository) CreateApprovalTx(ctx context.Context, tx pgx.Tx, reportID, taskID, approverID, decision, channel string, reason *string) error {
	var approver any = approverID
	if approverID == "" {
		approver = nil
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO "FieldTaskApproval" (id, "reportId", "fieldTaskId", "approverId", decision, reason, channel, "decidedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`, uuid.NewString(), reportID, taskID, approver, decision, reason, channel)
	return err
}

func (r *Repository) ApproveTaskTx(ctx context.Context, tx pgx.Tx, taskID, approverID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE "FieldTask" SET status = $1, "approvedById" = $2, "approvedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $3
	`, StatusApproved, approverID, taskID)
	return err
}

func (r *Repository) GetReportID(ctx context.Context, taskID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM "FieldTaskReport" WHERE "fieldTaskId" = $1`, taskID).Scan(&id)
	return id, err
}

func (r *Repository) ListMyStock(ctx context.Context, companyID, userID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT us.id, us.quantity, us."updatedAt",
		       v.id, v.name, v.sku, v.barcode, v."salePrice", v.currency,
		       p.id, p.name, p.unit,
		       w.id, w.name
		FROM "UserStock" us
		JOIN "ProductVariant" v ON v.id = us."productVariantId"
		JOIN "Product" p ON p.id = v."productId"
		JOIN "Warehouse" w ON w.id = us."sourceWarehouseId"
		WHERE us."companyId" = $1 AND us."userId" = $2 AND us.quantity > 0
		ORDER BY us."updatedAt" DESC
	`, companyID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var usID string
		var qty int
		var updatedAt time.Time
		var vID, vName string
		var sku, barcode *string
		var salePrice float64
		var currency string
		var pID, pName, unit string
		var wID, wName string
		if err := rows.Scan(&usID, &qty, &updatedAt, &vID, &vName, &sku, &barcode, &salePrice, &currency,
			&pID, &pName, &unit, &wID, &wName); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": usID, "companyId": companyID, "userId": userID, "quantity": qty, "updatedAt": updatedAt,
			"productVariantId": vID,
			"productVariant": map[string]any{
				"id": vID, "name": vName, "sku": sku, "barcode": barcode, "salePrice": salePrice, "currency": currency,
				"product": map[string]any{"id": pID, "name": pName, "unit": unit},
			},
			"sourceWarehouseId": wID,
			"sourceWarehouse":   map[string]any{"id": wID, "name": wName},
		})
	}
	return out, rows.Err()
}

func (r *Repository) ListWorkerBalances(ctx context.Context, companyID string) (map[string]any, error) {
	stocks, err := r.pool.Query(ctx, `
		SELECT us.id, us."userId", us.quantity, us."updatedAt",
		       u."fullName", u.login,
		       v.id, v.name, p.name,
		       w.id, w.name
		FROM "UserStock" us
		JOIN "User" u ON u.id = us."userId"
		JOIN "ProductVariant" v ON v.id = us."productVariantId"
		JOIN "Product" p ON p.id = v."productId"
		JOIN "Warehouse" w ON w.id = us."sourceWarehouseId"
		WHERE us."companyId" = $1 AND us.quantity > 0
		ORDER BY us."updatedAt" DESC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer stocks.Close()
	stockItems := []map[string]any{}
	for stocks.Next() {
		var usID, userID string
		var qty int
		var updatedAt time.Time
		var fullName, login, vID, vName, pName, wID, wName string
		if err := stocks.Scan(&usID, &userID, &qty, &updatedAt, &fullName, &login, &vID, &vName, &pName, &wID, &wName); err != nil {
			return nil, err
		}
		stockItems = append(stockItems, map[string]any{
			"id": usID, "userId": userID, "quantity": qty, "updatedAt": updatedAt,
			"user": map[string]any{"id": userID, "fullName": fullName, "login": login},
			"productVariant": map[string]any{
				"id": vID, "name": vName, "product": map[string]any{"name": pName},
			},
			"sourceWarehouse": map[string]any{"id": wID, "name": wName},
		})
	}
	if err := stocks.Err(); err != nil {
		return nil, err
	}

	wrows, err := r.pool.Query(ctx, `
		SELECT cu."userId", u."fullName", u.login
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1 AND cu.role = 'FIELD_WORKER'
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer wrows.Close()
	workers := []map[string]any{}
	for wrows.Next() {
		var uid, name, login string
		if err := wrows.Scan(&uid, &name, &login); err != nil {
			return nil, err
		}
		workers = append(workers, map[string]any{
			"userId": uid, "user": map[string]any{"id": uid, "fullName": name, "login": login},
		})
	}
	return map[string]any{"stocks": stockItems, "workers": workers}, wrows.Err()
}

func (r *Repository) GetKPI(ctx context.Context, companyID string, dateFrom, dateTo time.Time) (map[string]any, error) {
	trows, err := r.pool.Query(ctx, `
		SELECT t."assigneeId", u."fullName", r.items::text
		FROM "FieldTask" t
		JOIN "User" u ON u.id = t."assigneeId"
		LEFT JOIN "FieldTaskReport" r ON r."fieldTaskId" = t.id
		WHERE t."companyId" = $1 AND t.status = $2 AND t."approvedAt" >= $3 AND t."approvedAt" <= $4
	`, companyID, StatusApproved, dateFrom, dateTo)
	if err != nil {
		return nil, err
	}
	defer trows.Close()

	byWorker := map[string]map[string]any{}
	wrows, err := r.pool.Query(ctx, `
		SELECT cu."userId", u."fullName"
		FROM "CompanyUser" cu JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1 AND cu.role = 'FIELD_WORKER'
	`, companyID)
	if err != nil {
		return nil, err
	}
	for wrows.Next() {
		var uid, name string
		_ = wrows.Scan(&uid, &name)
		byWorker[uid] = map[string]any{
			"userId": uid, "name": name, "tasksTotal": 0, "approved": 0,
			"usedQty": 0.0, "returnedQty": 0.0, "lostQty": 0.0,
		}
	}
	wrows.Close()

	for trows.Next() {
		var assigneeID, name string
		var itemsJSON []byte
		if err := trows.Scan(&assigneeID, &name, &itemsJSON); err != nil {
			return nil, err
		}
		row, ok := byWorker[assigneeID]
		if !ok {
			row = map[string]any{
				"userId": assigneeID, "name": name, "tasksTotal": 0, "approved": 0,
				"usedQty": 0.0, "returnedQty": 0.0, "lostQty": 0.0,
			}
			byWorker[assigneeID] = row
		}
		row["tasksTotal"] = row["tasksTotal"].(int) + 1
		row["approved"] = row["approved"].(int) + 1
		var items []ReportItem
		_ = json.Unmarshal(itemsJSON, &items)
		for _, it := range items {
			row["usedQty"] = row["usedQty"].(float64) + it.UsedQty
			row["returnedQty"] = row["returnedQty"].(float64) + it.ReturnedQty
			row["lostQty"] = row["lostQty"].(float64) + it.LostQty
		}
	}
	workers := make([]map[string]any, 0, len(byWorker))
	for _, w := range byWorker {
		workers = append(workers, w)
	}
	// sort by usedQty desc
	for i := 0; i < len(workers); i++ {
		for j := i + 1; j < len(workers); j++ {
			if workers[j]["usedQty"].(float64) > workers[i]["usedQty"].(float64) {
				workers[i], workers[j] = workers[j], workers[i]
			}
		}
	}
	return map[string]any{
		"period":  map[string]any{"from": dateFrom, "to": dateTo},
		"workers": workers,
	}, trows.Err()
}

func (r *Repository) EnrichTaskPlannedItems(ctx context.Context, companyID string, task map[string]any) (map[string]any, error) {
	raw, ok := task["plannedItems"].([]PlannedItem)
	if !ok {
		return task, nil
	}
	enriched, err := r.LoadVariantLabels(ctx, companyID, raw)
	if err != nil {
		return nil, err
	}
	task["plannedItems"] = enriched
	return task, nil
}
