package picktasks

import (
	"context"
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

var (
	ErrNotFound           = errors.New("Picking vazifasi topilmadi")
	ErrDispatchNotFound   = errors.New("Jo'natma topilmadi")
)

const pickTaskListSQL = `
	SELECT
		pt.id, pt."dispatchId", pt."companyId", pt."warehouseId", pt."productVariantId",
		pt."productNameSnapshot", pt."binLocation",
		pt."quantityRequired", pt."quantityPicked", pt."scannedBarcodes",
		pt."assignedTo", pt.status, pt."startedAt", pt."completedAt", pt."createdAt", pt."updatedAt",
		d.id, d."dispatchNumber", d."orderId", d.status,
		pv.id, pv.name, pv.sku, pv.barcode,
		w.id, w.name
	FROM "PickTask" pt
	JOIN "Dispatch" d ON d.id = pt."dispatchId"
	JOIN "ProductVariant" pv ON pv.id = pt."productVariantId"
	JOIN "Warehouse" w ON w.id = pt."warehouseId"
`

func (r *Repository) List(ctx context.Context, companyID, status, warehouseID string) ([]PickTaskResponse, error) {
	where := ` WHERE pt."companyId" = $1`
	args := []any{companyID}
	n := 2
	if warehouseID != "" {
		where += fmt.Sprintf(` AND pt."warehouseId" = $%d`, n)
		args = append(args, warehouseID)
		n++
	}
	if status != "" {
		where += fmt.Sprintf(` AND pt.status = $%d`, n)
		args = append(args, status)
	}
	query := pickTaskListSQL + where + ` ORDER BY pt."createdAt" DESC`
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPickTaskRows(rows, false)
}

const pickTaskListForDispatchSQL = `
	SELECT
		pt.id, pt."dispatchId", pt."companyId", pt."warehouseId", pt."productVariantId",
		pt."productNameSnapshot", pt."binLocation",
		pt."quantityRequired", pt."quantityPicked", pt."scannedBarcodes",
		pt."assignedTo", pt.status, pt."startedAt", pt."completedAt", pt."createdAt", pt."updatedAt",
		d.id, d."dispatchNumber", d."orderId", d.status,
		pv.id, pv.name, pv.sku, pv.barcode,
		w.id, w.name,
		cu.id, u."fullName"
	FROM "PickTask" pt
	JOIN "Dispatch" d ON d.id = pt."dispatchId"
	JOIN "ProductVariant" pv ON pv.id = pt."productVariantId"
	JOIN "Warehouse" w ON w.id = pt."warehouseId"
	LEFT JOIN "CompanyUser" cu ON cu.id = pt."assignedTo"
	LEFT JOIN "User" u ON u.id = cu."userId"
`

func (r *Repository) ListForDispatch(ctx context.Context, dispatchID, companyID string) ([]PickTaskResponse, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "Dispatch"
			WHERE id = $1 AND ("sellerCompanyId" = $2 OR "buyerCompanyId" = $2)
		)
	`, dispatchID, companyID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrDispatchNotFound
	}

	query := pickTaskListForDispatchSQL + ` WHERE pt."dispatchId" = $1 ORDER BY pt."createdAt" ASC`

	rows, err := r.pool.Query(ctx, query, dispatchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PickTaskResponse{}
	for rows.Next() {
		item, err := scanPickTaskWithAssignee(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

type scannable interface {
	Scan(dest ...any) error
}

func scanPickTaskWithAssignee(row scannable) (*PickTaskResponse, error) {
	var s scanTaskRow
	var assigneeID, assigneeName *string
	err := row.Scan(
		&s.ID, &s.DispatchID, &s.CompanyID, &s.WarehouseID, &s.ProductVariantID,
		&s.ProductNameSnapshot, &s.BinLocation,
		&s.QuantityRequired, &s.QuantityPicked, &s.ScannedBarcodes,
		&s.AssignedTo, &s.Status, &s.StartedAt, &s.CompletedAt, &s.CreatedAt, &s.UpdatedAt,
		&s.DispatchID2, &s.DispatchNumber, &s.OrderID, &s.DispatchStatus,
		&s.VariantID, &s.VariantName, &s.SKU, &s.Barcode,
		&s.WarehouseID2, &s.WarehouseName,
		&assigneeID, &assigneeName,
	)
	if err != nil {
		return nil, err
	}
	if s.ScannedBarcodes == nil {
		s.ScannedBarcodes = []string{}
	}
	item := &PickTaskResponse{
		ID: s.ID, DispatchID: s.DispatchID, CompanyID: s.CompanyID,
		WarehouseID: s.WarehouseID, ProductVariantID: s.ProductVariantID,
		ProductNameSnapshot: s.ProductNameSnapshot, BinLocation: s.BinLocation,
		QuantityRequired: s.QuantityRequired, QuantityPicked: s.QuantityPicked,
		ScannedBarcodes: s.ScannedBarcodes, AssignedTo: s.AssignedTo,
		Status: s.Status, StartedAt: s.StartedAt, CompletedAt: s.CompletedAt,
		CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
		Dispatch: &DispatchBrief{
			ID: s.DispatchID2, DispatchNumber: s.DispatchNumber,
			OrderID: s.OrderID, Status: s.DispatchStatus,
		},
		ProductVariant: &ProductVariantBrief{
			ID: s.VariantID, Name: s.VariantName, SKU: s.SKU, Barcode: s.Barcode,
		},
		Warehouse: &WarehouseBrief{ID: s.WarehouseID2, Name: s.WarehouseName},
	}
	if assigneeID != nil && assigneeName != nil {
		item.Assignee = &AssigneeBrief{ID: *assigneeID}
		item.Assignee.User.FullName = *assigneeName
	}
	return item, nil
}

func (r *Repository) FindOne(ctx context.Context, taskID, companyID string) (*PickTaskResponse, error) {
	row := r.pool.QueryRow(ctx, pickTaskListSQL+` WHERE pt.id = $1 AND pt."companyId" = $2`, taskID, companyID)
	item, err := scanPickTaskRow(row, false)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return item, err
}

func (r *Repository) FindCompanyUserID(ctx context.Context, companyID, userID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2
	`, companyID, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("Foydalanuvchi kompaniyada topilmadi")
	}
	return id, err
}

type scanTaskRow struct {
	ID, DispatchID, CompanyID, WarehouseID, ProductVariantID, ProductNameSnapshot string
	BinLocation                                                                   *string
	QuantityRequired, QuantityPicked                                              float64
	ScannedBarcodes                                                               []string
	AssignedTo                                                                    *string
	Status                                                                        string
	StartedAt, CompletedAt                                                        *time.Time
	CreatedAt, UpdatedAt                                                          time.Time
	DispatchID2, DispatchNumber, OrderID, DispatchStatus                        string
	VariantID, VariantName                                                        string
	SKU, Barcode                                                                  *string
	WarehouseID2, WarehouseName                                                   string
}

func scanPickTaskRows(rows pgx.Rows, withAssignee bool) ([]PickTaskResponse, error) {
	out := []PickTaskResponse{}
	for rows.Next() {
		item, err := scanPickTaskFromRows(rows, withAssignee)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func scanPickTaskRow(row pgx.Row, withAssignee bool) (*PickTaskResponse, error) {
	return scanPickTaskFromRows(row, withAssignee)
}

func scanPickTaskFromRows(row scannable, withAssignee bool) (*PickTaskResponse, error) {
	var s scanTaskRow
	err := row.Scan(
		&s.ID, &s.DispatchID, &s.CompanyID, &s.WarehouseID, &s.ProductVariantID,
		&s.ProductNameSnapshot, &s.BinLocation,
		&s.QuantityRequired, &s.QuantityPicked, &s.ScannedBarcodes,
		&s.AssignedTo, &s.Status, &s.StartedAt, &s.CompletedAt, &s.CreatedAt, &s.UpdatedAt,
		&s.DispatchID2, &s.DispatchNumber, &s.OrderID, &s.DispatchStatus,
		&s.VariantID, &s.VariantName, &s.SKU, &s.Barcode,
		&s.WarehouseID2, &s.WarehouseName,
	)
	if err != nil {
		return nil, err
	}
	if s.ScannedBarcodes == nil {
		s.ScannedBarcodes = []string{}
	}
	return &PickTaskResponse{
		ID: s.ID, DispatchID: s.DispatchID, CompanyID: s.CompanyID,
		WarehouseID: s.WarehouseID, ProductVariantID: s.ProductVariantID,
		ProductNameSnapshot: s.ProductNameSnapshot, BinLocation: s.BinLocation,
		QuantityRequired: s.QuantityRequired, QuantityPicked: s.QuantityPicked,
		ScannedBarcodes: s.ScannedBarcodes, AssignedTo: s.AssignedTo,
		Status: s.Status, StartedAt: s.StartedAt, CompletedAt: s.CompletedAt,
		CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
		Dispatch: &DispatchBrief{
			ID: s.DispatchID2, DispatchNumber: s.DispatchNumber,
			OrderID: s.OrderID, Status: s.DispatchStatus,
		},
		ProductVariant: &ProductVariantBrief{
			ID: s.VariantID, Name: s.VariantName, SKU: s.SKU, Barcode: s.Barcode,
		},
		Warehouse: &WarehouseBrief{ID: s.WarehouseID2, Name: s.WarehouseName},
	}, nil
}

func (r *Repository) Scan(ctx context.Context, taskID, companyID, companyUserID, barcode string, quantity float64) (*PickTaskPlain, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		status                                          string
		qtyPicked, qtyRequired                          float64
		assignedTo                                      *string
		startedAt, completedAt                          *time.Time
		variantSKU, variantBarcode                      *string
		scannedBarcodes                                 []string
	)
	err = tx.QueryRow(ctx, `
		SELECT pt.status, pt."quantityPicked", pt."quantityRequired", pt."assignedTo",
		       pt."startedAt", pt."completedAt", pt."scannedBarcodes",
		       pv.sku, pv.barcode
		FROM "PickTask" pt
		JOIN "ProductVariant" pv ON pv.id = pt."productVariantId"
		WHERE pt.id = $1 AND pt."companyId" = $2
		FOR UPDATE
	`, taskID, companyID).Scan(
		&status, &qtyPicked, &qtyRequired, &assignedTo,
		&startedAt, &completedAt, &scannedBarcodes,
		&variantSKU, &variantBarcode,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == "CANCELLED" {
		return nil, errors.New("Vazifa bekor qilingan")
	}
	if status == "COMPLETED" {
		return nil, errors.New("Vazifa allaqachon tugagan")
	}

	expected := []string{}
	if variantBarcode != nil && strings.TrimSpace(*variantBarcode) != "" {
		expected = append(expected, strings.TrimSpace(*variantBarcode))
	}
	if variantSKU != nil && strings.TrimSpace(*variantSKU) != "" {
		expected = append(expected, strings.TrimSpace(*variantSKU))
	}
	if len(expected) > 0 {
		found := false
		for _, e := range expected {
			if e == barcode {
				found = true
				break
			}
		}
		if !found {
			return nil, errors.New("Noto'g'ri mahsulot skanerlandi")
		}
	}

	nextPicked := qtyPicked + quantity
	if nextPicked > qtyRequired {
		return nil, fmt.Errorf("Miqdor oshib ketdi: kerak %g, skanerlangan %g", qtyRequired, nextPicked)
	}

	newStatus := "IN_PROGRESS"
	var newCompletedAt *time.Time
	if nextPicked >= qtyRequired {
		newStatus = "COMPLETED"
		now := time.Now()
		newCompletedAt = &now
	}
	newAssigned := assignedTo
	if newAssigned == nil {
		newAssigned = &companyUserID
	}
	newStarted := startedAt
	if newStarted == nil {
		now := time.Now()
		newStarted = &now
	}

	row := tx.QueryRow(ctx, `
		UPDATE "PickTask" SET
			"quantityPicked" = $1,
			"scannedBarcodes" = array_append("scannedBarcodes", $2),
			"assignedTo" = $3,
			"startedAt" = $4,
			status = $5,
			"completedAt" = COALESCE($6, "completedAt"),
			"updatedAt" = NOW()
		WHERE id = $7
		RETURNING id, "dispatchId", "companyId", "warehouseId", "productVariantId",
		          "productNameSnapshot", "binLocation",
		          "quantityRequired", "quantityPicked", "scannedBarcodes",
		          "assignedTo", status, "startedAt", "completedAt", "createdAt", "updatedAt"
	`, nextPicked, barcode, *newAssigned, newStarted, newStatus, newCompletedAt, taskID)

	plain, err := scanPickTaskPlain(row)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return plain, nil
}

func (r *Repository) Complete(ctx context.Context, taskID, companyID, companyUserID string) (*PickTaskPlain, error) {
	var qtyPicked, qtyRequired float64
	var assignedTo *string
	var completedAt *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT "quantityPicked", "quantityRequired", "assignedTo", "completedAt"
		FROM "PickTask" WHERE id = $1 AND "companyId" = $2
	`, taskID, companyID).Scan(&qtyPicked, &qtyRequired, &assignedTo, &completedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if qtyPicked < qtyRequired {
		return nil, errors.New("To'liq saralanmagan vazifani tugatib bo'lmaydi")
	}

	newAssigned := assignedTo
	if newAssigned == nil {
		newAssigned = &companyUserID
	}
	newCompleted := completedAt
	if newCompleted == nil {
		now := time.Now()
		newCompleted = &now
	}

	row := r.pool.QueryRow(ctx, `
		UPDATE "PickTask" SET
			status = 'COMPLETED',
			"assignedTo" = $1,
			"completedAt" = $2,
			"updatedAt" = NOW()
		WHERE id = $3
		RETURNING id, "dispatchId", "companyId", "warehouseId", "productVariantId",
		          "productNameSnapshot", "binLocation",
		          "quantityRequired", "quantityPicked", "scannedBarcodes",
		          "assignedTo", status, "startedAt", "completedAt", "createdAt", "updatedAt"
	`, *newAssigned, newCompleted, taskID)
	return scanPickTaskPlain(row)
}

func scanPickTaskPlain(row pgx.Row) (*PickTaskPlain, error) {
	var p PickTaskPlain
	var scanned []string
	err := row.Scan(
		&p.ID, &p.DispatchID, &p.CompanyID, &p.WarehouseID, &p.ProductVariantID,
		&p.ProductNameSnapshot, &p.BinLocation,
		&p.QuantityRequired, &p.QuantityPicked, &scanned,
		&p.AssignedTo, &p.Status, &p.StartedAt, &p.CompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if scanned == nil {
		scanned = []string{}
	}
	p.ScannedBarcodes = scanned
	return &p, err
}

type CreatePickTasksResult struct {
	DispatchID      string
	SellerCompanyID string
	DispatchNumber  string
	TaskSummaries   []struct {
		ProductName      string
		QuantityRequired float64
	}
}

// CreatePickTasksForDispatch — dispatches moduli uchun (keyingi port).
func (r *Repository) CreatePickTasksForDispatch(ctx context.Context, dispatchID string) (*CreatePickTasksResult, error) {
	var sellerCompanyID, warehouseID, dispatchNumber string
	err := r.pool.QueryRow(ctx, `
		SELECT "sellerCompanyId", "warehouseId", "dispatchNumber" FROM "Dispatch" WHERE id = $1
	`, dispatchID).Scan(&sellerCompanyID, &warehouseID, &dispatchNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDispatchNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT "productVariantId", "productNameSnapshot", quantity
		FROM "DispatchItem" WHERE "dispatchId" = $1
	`, dispatchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type item struct {
		variantID, name string
		qty             float64
	}
	items := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.variantID, &it.name, &it.qty); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if len(items) == 0 {
		return nil, nil
	}

	batch := &pgx.Batch{}
	for _, it := range items {
		batch.Queue(`
			INSERT INTO "PickTask" (
				id, "dispatchId", "companyId", "warehouseId", "productVariantId",
				"productNameSnapshot", "quantityRequired", status, "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW(), NOW())
		`, uuid.NewString(), dispatchID, sellerCompanyID, warehouseID, it.variantID, it.name, it.qty)
	}
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range items {
		if _, err := br.Exec(); err != nil {
			return nil, err
		}
	}
	if err := br.Close(); err != nil {
		return nil, err
	}

	result := &CreatePickTasksResult{
		DispatchID:      dispatchID,
		SellerCompanyID: sellerCompanyID,
		DispatchNumber:  dispatchNumber,
	}
	for _, it := range items {
		result.TaskSummaries = append(result.TaskSummaries, struct {
			ProductName      string
			QuantityRequired float64
		}{it.name, it.qty})
	}
	return result, nil
}

func (r *Repository) DeleteTasksForDispatch(ctx context.Context, dispatchID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM "PickTask" WHERE "dispatchId" = $1`, dispatchID)
	return err
}

func (r *Repository) DeleteTasksForDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	_, err := tx.Exec(ctx, `DELETE FROM "PickTask" WHERE "dispatchId" = $1`, dispatchID)
	return err
}

func (r *Repository) CancelTasksForDispatch(ctx context.Context, dispatchID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE "PickTask" SET status = 'CANCELLED', "updatedAt" = NOW()
		WHERE "dispatchId" = $1 AND status IN ('PENDING', 'IN_PROGRESS')
	`, dispatchID)
	return err
}

func (r *Repository) CancelTasksForDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE "PickTask" SET status = 'CANCELLED', "updatedAt" = NOW()
		WHERE "dispatchId" = $1 AND status IN ('PENDING', 'IN_PROGRESS')
	`, dispatchID)
	return err
}

func (r *Repository) AssertDispatchPicked(ctx context.Context, dispatchID string) error {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "PickTask"
		WHERE "dispatchId" = $1 AND status IN ('PENDING', 'IN_PROGRESS')
	`, dispatchID).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("%d ta picking vazifasi hali tugallanmagan", count)
	}
	return nil
}
