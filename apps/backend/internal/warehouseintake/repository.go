package warehouseintake

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound          = errors.New("Kirim hujjati topilmadi")
	ErrDraftOnly         = errors.New("Faqat DRAFT holatdagi hujjat tahrirlanadi")
	ErrLineNotFound      = errors.New("Qator topilmadi")
	ErrWarehouseNotFound = errors.New("Ombor topilmadi")
	ErrVariantNotFound   = errors.New("Mahsulot varianti topilmadi")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type IntakeRecord struct {
	ID                     string
	CompanyID              string
	WarehouseID            string
	WarehouseName          string
	Reference              string
	Status                 string
	Note                   *string
	PartnerLedgerContactID *string
	CreatedBy              *string
	CompletedBy            *string
	CompletedAt            *time.Time
	CreatedAt              time.Time
	UpdatedAt              time.Time
	Lines                  []IntakeLineRecord
}

type IntakeLineRecord struct {
	ID               string
	IntakeID         string
	ProductVariantID string
	Quantity         float64
	ScanCount        int
	ScannedBarcode   *string
	EntryMode        string
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Variant          VariantLite
}

type VariantLite struct {
	ID           string
	Name         string
	SKU          *string
	Barcode      *string
	ProductID    string
	ProductName  string
	ProductUnit  string
	ProductImage *string
}

type IntakeListRecord struct {
	ID            string
	WarehouseID   string
	WarehouseName string
	Reference     string
	Status        string
	Note          *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	CompletedAt   *time.Time
	LinesCount    int
}

type queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type WarehouseRef struct {
	ID          string
	Name        string
	FieldConfig []byte
}

func (r *Repository) LoadWarehouse(ctx context.Context, companyID, warehouseID string) (*WarehouseRef, error) {
	var out WarehouseRef
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, "fieldConfig"
		FROM "Warehouse"
		WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, warehouseID, companyID).Scan(&out.ID, &out.Name, &out.FieldConfig)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrWarehouseNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *Repository) LoadCompanyIntakeSettingsRaw(ctx context.Context, companyID string) ([]byte, error) {
	var raw []byte
	if err := r.pool.QueryRow(ctx, `
		SELECT "warehouseIntakeSettings"
		FROM "Company"
		WHERE id = $1
	`, companyID).Scan(&raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func (r *Repository) PartnerLedgerContactExists(ctx context.Context, companyID, contactID string) (bool, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM "PartnerLedgerContact"
			WHERE id = $1 AND "companyId" = $2 AND "isActive" = true
		)
	`, contactID, companyID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *Repository) GenerateReferenceTx(ctx context.Context, tx pgx.Tx, companyID string, now time.Time) (string, error) {
	prefix := fmt.Sprintf("KIR-%04d%02d%02d", now.UTC().Year(), int(now.UTC().Month()), now.UTC().Day())
	var count int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM "WarehouseIntake"
		WHERE "companyId" = $1
		  AND reference LIKE $2
	`, companyID, prefix+"%").Scan(&count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%04d", prefix, count+1), nil
}

func (r *Repository) CreateIntakeTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, warehouseID, reference, userID string,
	note, partnerLedgerContactID *string,
) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO "WarehouseIntake" (
			id, "companyId", "warehouseId", reference, status, note, "partnerLedgerContactId", "createdBy", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid()::text, $1, $2, $3, 'DRAFT', $4, $5, $6, NOW(), NOW()
		)
		RETURNING id
	`, companyID, warehouseID, reference, note, partnerLedgerContactID, userID).Scan(&id)
	return id, err
}

func (r *Repository) LoadIntakeMeta(ctx context.Context, id, companyID string) (string, string, error) {
	var warehouseID, status string
	err := r.pool.QueryRow(ctx, `
		SELECT "warehouseId", status
		FROM "WarehouseIntake"
		WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&warehouseID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	if err != nil {
		return "", "", err
	}
	return warehouseID, status, nil
}

func (r *Repository) AssertDraftTx(ctx context.Context, tx pgx.Tx, id, companyID string) (string, error) {
	var warehouseID, status string
	err := tx.QueryRow(ctx, `
		SELECT "warehouseId", status
		FROM "WarehouseIntake"
		WHERE id = $1 AND "companyId" = $2
		FOR UPDATE
	`, id, companyID).Scan(&warehouseID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if status != "DRAFT" {
		return "", ErrDraftOnly
	}
	return warehouseID, nil
}

func (r *Repository) LoadIntakeDetail(ctx context.Context, id, companyID string) (*IntakeRecord, error) {
	return r.loadIntakeDetailQ(ctx, r.pool, id, companyID, false)
}

func (r *Repository) LoadIntakeDetailTx(ctx context.Context, tx pgx.Tx, id, companyID string, forUpdate bool) (*IntakeRecord, error) {
	return r.loadIntakeDetailQ(ctx, tx, id, companyID, forUpdate)
}

func (r *Repository) loadIntakeDetailQ(ctx context.Context, q queryer, id, companyID string, forUpdate bool) (*IntakeRecord, error) {
	suffix := ""
	if forUpdate {
		suffix = " FOR UPDATE"
	}
	var out IntakeRecord
	err := q.QueryRow(ctx, `
		SELECT
			wi.id, wi."companyId", wi."warehouseId", w.name, wi.reference, wi.status, wi.note,
			wi."partnerLedgerContactId", wi."createdBy", wi."completedBy", wi."completedAt",
			wi."createdAt", wi."updatedAt"
		FROM "WarehouseIntake" wi
		JOIN "Warehouse" w ON w.id = wi."warehouseId"
		WHERE wi.id = $1 AND wi."companyId" = $2`+suffix,
		id, companyID,
	).Scan(
		&out.ID,
		&out.CompanyID,
		&out.WarehouseID,
		&out.WarehouseName,
		&out.Reference,
		&out.Status,
		&out.Note,
		&out.PartnerLedgerContactID,
		&out.CreatedBy,
		&out.CompletedBy,
		&out.CompletedAt,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	lines, err := q.Query(ctx, `
		SELECT
			wil.id, wil."intakeId", wil."productVariantId", wil.quantity, wil."scanCount", wil."scannedBarcode", wil."entryMode",
			wil."createdAt", wil."updatedAt",
			pv.id, pv.name, pv.sku, pv.barcode, p.id, p.name, COALESCE(p.unit, 'dona'), p."imageUrl"
		FROM "WarehouseIntakeLine" wil
		JOIN "ProductVariant" pv ON pv.id = wil."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE wil."intakeId" = $1
		  AND pv."companyId" = $2
		ORDER BY wil."createdAt" ASC, wil.id ASC
	`, id, companyID)
	if err != nil {
		return nil, err
	}
	defer lines.Close()

	out.Lines = make([]IntakeLineRecord, 0)
	for lines.Next() {
		var row IntakeLineRecord
		if err := lines.Scan(
			&row.ID,
			&row.IntakeID,
			&row.ProductVariantID,
			&row.Quantity,
			&row.ScanCount,
			&row.ScannedBarcode,
			&row.EntryMode,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.Variant.ID,
			&row.Variant.Name,
			&row.Variant.SKU,
			&row.Variant.Barcode,
			&row.Variant.ProductID,
			&row.Variant.ProductName,
			&row.Variant.ProductUnit,
			&row.Variant.ProductImage,
		); err != nil {
			return nil, err
		}
		out.Lines = append(out.Lines, row)
	}
	if err := lines.Err(); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *Repository) ListIntakes(
	ctx context.Context,
	companyID string,
	status, warehouseID *string,
	enforceScope bool,
	allowedWarehouseIDs []string,
) ([]IntakeListRecord, error) {
	if enforceScope && len(allowedWarehouseIDs) == 0 {
		return []IntakeListRecord{}, nil
	}

	where := []string{`wi."companyId" = $1`}
	args := []any{companyID}
	n := 2

	if enforceScope {
		where = append(where, fmt.Sprintf(`wi."warehouseId" = ANY($%d)`, n))
		args = append(args, allowedWarehouseIDs)
		n++
	}
	if status != nil && strings.TrimSpace(*status) != "" {
		where = append(where, fmt.Sprintf(`wi.status = $%d`, n))
		args = append(args, strings.TrimSpace(*status))
		n++
	}
	if warehouseID != nil && strings.TrimSpace(*warehouseID) != "" {
		where = append(where, fmt.Sprintf(`wi."warehouseId" = $%d`, n))
		args = append(args, strings.TrimSpace(*warehouseID))
		n++
	}

	sql := `
		SELECT
			wi.id, wi."warehouseId", w.name, wi.reference, wi.status, wi.note,
			wi."createdAt", wi."updatedAt", wi."completedAt",
			COUNT(wil.id)::int
		FROM "WarehouseIntake" wi
		JOIN "Warehouse" w ON w.id = wi."warehouseId"
		LEFT JOIN "WarehouseIntakeLine" wil ON wil."intakeId" = wi.id
		WHERE ` + strings.Join(where, " AND ") + `
		GROUP BY wi.id, wi."warehouseId", w.name, wi.reference, wi.status, wi.note, wi."createdAt", wi."updatedAt", wi."completedAt"
		ORDER BY wi."createdAt" DESC
		LIMIT 100`

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]IntakeListRecord, 0)
	for rows.Next() {
		var row IntakeListRecord
		if err := rows.Scan(
			&row.ID,
			&row.WarehouseID,
			&row.WarehouseName,
			&row.Reference,
			&row.Status,
			&row.Note,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.CompletedAt,
			&row.LinesCount,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadVariantByID(ctx context.Context, companyID, variantID string) (*VariantLite, error) {
	var out VariantLite
	err := r.pool.QueryRow(ctx, `
		SELECT
			pv.id, pv.name, pv.sku, pv.barcode, p.id, p.name, COALESCE(p.unit, 'dona'), p."imageUrl"
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv.id = $1 AND pv."companyId" = $2 AND pv.status = 'ACTIVE'
	`, variantID, companyID).Scan(
		&out.ID,
		&out.Name,
		&out.SKU,
		&out.Barcode,
		&out.ProductID,
		&out.ProductName,
		&out.ProductUnit,
		&out.ProductImage,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrVariantNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *Repository) FindVariantsExactByCode(ctx context.Context, companyID, code string, limit int) ([]VariantLite, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			pv.id, pv.name, pv.sku, pv.barcode, p.id, p.name, COALESCE(p.unit, 'dona'), p."imageUrl"
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv."companyId" = $1
		  AND pv.status = 'ACTIVE'
		  AND (pv.barcode = $2 OR pv.sku = $2)
		ORDER BY pv."updatedAt" DESC
		LIMIT $3
	`, companyID, code, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanVariantRows(rows)
}

func (r *Repository) FindVariantsFuzzyByCode(ctx context.Context, companyID, code string, limit int) ([]VariantLite, error) {
	pattern := "%" + code + "%"
	rows, err := r.pool.Query(ctx, `
		SELECT
			pv.id, pv.name, pv.sku, pv.barcode, p.id, p.name, COALESCE(p.unit, 'dona'), p."imageUrl"
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pv."companyId" = $1
		  AND pv.status = 'ACTIVE'
		  AND (pv.barcode ILIKE $2 OR pv.sku ILIKE $2)
		ORDER BY pv."updatedAt" DESC
		LIMIT $3
	`, companyID, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanVariantRows(rows)
}

func scanVariantRows(rows pgx.Rows) ([]VariantLite, error) {
	out := make([]VariantLite, 0)
	for rows.Next() {
		var row VariantLite
		if err := rows.Scan(
			&row.ID,
			&row.Name,
			&row.SKU,
			&row.Barcode,
			&row.ProductID,
			&row.ProductName,
			&row.ProductUnit,
			&row.ProductImage,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) FindLineByIntakeVariantTx(ctx context.Context, tx pgx.Tx, intakeID, productVariantID string) (*IntakeLineRecord, error) {
	var row IntakeLineRecord
	err := tx.QueryRow(ctx, `
		SELECT id, "intakeId", "productVariantId", quantity, "scanCount", "scannedBarcode", "entryMode", "createdAt", "updatedAt"
		FROM "WarehouseIntakeLine"
		WHERE "intakeId" = $1 AND "productVariantId" = $2
	`, intakeID, productVariantID).Scan(
		&row.ID,
		&row.IntakeID,
		&row.ProductVariantID,
		&row.Quantity,
		&row.ScanCount,
		&row.ScannedBarcode,
		&row.EntryMode,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpsertLineTx(
	ctx context.Context,
	tx pgx.Tx,
	intakeID, productVariantID string,
	addQty float64,
	entryMode string,
	scannedBarcode *string,
	scanIncrement int,
) error {
	existing, err := r.FindLineByIntakeVariantTx(ctx, tx, intakeID, productVariantID)
	if err != nil {
		return err
	}
	if existing != nil {
		_, err = tx.Exec(ctx, `
			UPDATE "WarehouseIntakeLine"
			SET quantity = quantity + $2,
			    "scanCount" = "scanCount" + $3,
			    "entryMode" = CASE
					WHEN "entryMode" = 'SCAN' OR $4 = 'SCAN' THEN 'SCAN'
					ELSE 'MANUAL'
				END,
				"scannedBarcode" = COALESCE($5, "scannedBarcode"),
				"updatedAt" = NOW()
			WHERE id = $1
		`, existing.ID, addQty, scanIncrement, entryMode, scannedBarcode)
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "WarehouseIntakeLine" (
			id, "intakeId", "productVariantId", quantity, "scanCount", "scannedBarcode", "entryMode", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW()
		)
	`, intakeID, productVariantID, addQty, scanIncrement, scannedBarcode, entryMode)
	return err
}

func (r *Repository) FindLine(ctx context.Context, companyID, intakeID, lineID string) (*IntakeLineRecord, error) {
	var row IntakeLineRecord
	err := r.pool.QueryRow(ctx, `
		SELECT
			wil.id, wil."intakeId", wil."productVariantId", wil.quantity, wil."scanCount",
			wil."scannedBarcode", wil."entryMode", wil."createdAt", wil."updatedAt"
		FROM "WarehouseIntakeLine" wil
		JOIN "WarehouseIntake" wi ON wi.id = wil."intakeId"
		WHERE wil.id = $1
		  AND wil."intakeId" = $2
		  AND wi."companyId" = $3
	`, lineID, intakeID, companyID).Scan(
		&row.ID,
		&row.IntakeID,
		&row.ProductVariantID,
		&row.Quantity,
		&row.ScanCount,
		&row.ScannedBarcode,
		&row.EntryMode,
		&row.CreatedAt,
		&row.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrLineNotFound
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpdateLineQuantity(ctx context.Context, lineID string, quantity float64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE "WarehouseIntakeLine"
		SET quantity = $2, "updatedAt" = NOW()
		WHERE id = $1
	`, lineID, quantity)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrLineNotFound
	}
	return nil
}

func (r *Repository) DeleteLine(ctx context.Context, lineID string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM "WarehouseIntakeLine" WHERE id = $1`, lineID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrLineNotFound
	}
	return nil
}

func (r *Repository) BarcodeOrSKUExists(ctx context.Context, companyID, code string) (bool, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM "ProductVariant"
			WHERE "companyId" = $1
			  AND (barcode = $2 OR sku = $2)
		)
	`, companyID, code).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *Repository) BarcodeExistsTx(ctx context.Context, tx pgx.Tx, companyID, barcode string) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM "ProductVariant"
			WHERE "companyId" = $1 AND barcode = $2
		)
	`, companyID, barcode).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *Repository) ResolveQuickCategoryTx(ctx context.Context, tx pgx.Tx, companyID string, categoryID *string) (string, error) {
	if categoryID != nil && strings.TrimSpace(*categoryID) != "" {
		var id string
		err := tx.QueryRow(ctx, `
			SELECT id
			FROM "ProductCategory"
			WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
		`, strings.TrimSpace(*categoryID), companyID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errors.New("Kategoriya topilmadi")
		}
		return id, err
	}

	var firstID string
	err := tx.QueryRow(ctx, `
		SELECT id
		FROM "ProductCategory"
		WHERE "companyId" = $1 AND status = 'ACTIVE'
		ORDER BY "createdAt" ASC
		LIMIT 1
	`, companyID).Scan(&firstID)
	if err == nil {
		return firstID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	if err := tx.QueryRow(ctx, `
		INSERT INTO "ProductCategory" (
			id, "companyId", name, status, "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid()::text, $1, 'Umumiy', 'ACTIVE', NOW(), NOW()
		)
		RETURNING id
	`, companyID).Scan(&firstID); err != nil {
		return "", err
	}
	return firstID, nil
}

func (r *Repository) CreateQuickProductTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, name, unit, barcode, categoryID string,
	salePrice float64,
	purchasePrice *float64,
) (string, string, error) {
	var productID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO "Product" (
			id, "companyId", name, "categoryId", unit, type, status, "createdBy", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid()::text, $1, $2, $3, $4, 'GOODS', 'ACTIVE', $5, NOW(), NOW()
		)
		RETURNING id
	`, companyID, name, categoryID, unit, userID).Scan(&productID); err != nil {
		return "", "", err
	}

	var variantID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO "ProductVariant" (
			id, "companyId", "productId", name, barcode, "salePrice", "purchasePrice", currency, status, "createdBy", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'UZS', 'ACTIVE', $7, NOW(), NOW()
		)
		RETURNING id
	`, companyID, productID, name, barcode, salePrice, purchasePrice, userID).Scan(&variantID); err != nil {
		return "", "", err
	}
	return productID, variantID, nil
}

func (r *Repository) InsertAuditLogTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, action, entityType, entityID string,
	newData map[string]any,
) error {
	payload, _ := json.Marshal(newData)
	_, err := tx.Exec(ctx, `
		INSERT INTO "AuditLog" (
			id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt"
		) VALUES (
			gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW()
		)
	`, companyID, userID, action, entityType, entityID, payload)
	return err
}

func (r *Repository) MarkCompletedTx(ctx context.Context, tx pgx.Tx, intakeID, userID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE "WarehouseIntake"
		SET status = 'COMPLETED',
		    "completedAt" = NOW(),
		    "completedBy" = $2,
		    "updatedAt" = NOW()
		WHERE id = $1
	`, intakeID, userID)
	return err
}

func (r *Repository) MarkCancelledTx(ctx context.Context, tx pgx.Tx, intakeID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE "WarehouseIntake"
		SET status = 'CANCELLED',
		    "updatedAt" = NOW()
		WHERE id = $1
	`, intakeID)
	return err
}

func (r *Repository) FindLatestCompletionActor(ctx context.Context, companyID, intakeID string) (*string, error) {
	var userID *string
	err := r.pool.QueryRow(ctx, `
		SELECT "userId"
		FROM "AuditLog"
		WHERE "companyId" = $1
		  AND "entityType" = 'WAREHOUSE_INTAKE'
		  AND "entityId" = $2
		  AND action = 'warehouse_intake.completed'
		ORDER BY "createdAt" DESC
		LIMIT 1
	`, companyID, intakeID).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return userID, nil
}

func (r *Repository) FindUserFullName(ctx context.Context, userID string) (*string, error) {
	var fullName *string
	err := r.pool.QueryRow(ctx, `
		SELECT "fullName"
		FROM "User"
		WHERE id = $1
	`, userID).Scan(&fullName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return fullName, nil
}

func (r *Repository) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}
