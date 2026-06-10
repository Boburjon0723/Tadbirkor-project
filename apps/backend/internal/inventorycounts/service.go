package inventorycounts

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

var (
	ErrNotFound      = errors.New("Inventarizatsiya topilmadi")
	ErrItemNotFound  = errors.New("Qator topilmadi")
	ErrWarehouseNF   = errors.New("Ombor topilmadi")
	ErrNoBalances    = errors.New("Inventarizatsiya uchun qoldiq topilmadi")
	ErrActiveCount   = errors.New("Ushbu omborda aktiv inventarizatsiya mavjud")
	ErrBarcodeNF     = errors.New("Ushbu inventarizatsiyada mos mahsulot topilmadi")
)

type Service struct {
	pool   *pgxpool.Pool
	notify *notifications.Service
	hub    pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, notify *notifications.Service, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, notify: notify, hub: hub}
}

func (s *Service) List(ctx context.Context, companyID, status, warehouseID string) ([]map[string]any, error) {
	where := ` WHERE ic."companyId" = $1`
	args := []any{companyID}
	n := 2
	if warehouseID != "" {
		where += fmt.Sprintf(` AND ic."warehouseId" = $%d`, n)
		args = append(args, warehouseID)
		n++
	}
	if status != "" {
		where += fmt.Sprintf(` AND ic.status = $%d`, n)
		args = append(args, strings.ToUpper(status))
	}
	rows, err := s.pool.Query(ctx, `
		SELECT ic.id, ic."companyId", ic."warehouseId", ic.reference, ic.status,
		       ic."startedAt", ic."completedAt", ic."initiatedBy", ic."approvedBy",
		       ic."createdAt", ic."updatedAt",
		       w.id, w.name,
		       (SELECT COUNT(*)::int FROM "InventoryCountItem" ici WHERE ici."inventoryCountId" = ic.id)
		FROM "InventoryCount" ic
		JOIN "Warehouse" w ON w.id = ic."warehouseId"
	`+where+` ORDER BY ic."startedAt" DESC LIMIT 100`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, cid, wid, ref, st, initiatedBy string
		var approvedBy *string
		var startedAt, createdAt, updatedAt time.Time
		var completedAt *time.Time
		var whID, whName string
		var itemCount int
		if err := rows.Scan(
			&id, &cid, &wid, &ref, &st, &startedAt, &completedAt, &initiatedBy, &approvedBy,
			&createdAt, &updatedAt, &whID, &whName, &itemCount,
		); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "companyId": cid, "warehouseId": wid, "reference": ref, "status": st,
			"startedAt": startedAt, "completedAt": completedAt, "initiatedBy": initiatedBy,
			"approvedBy": approvedBy, "createdAt": createdAt, "updatedAt": updatedAt,
			"warehouse": map[string]any{"id": whID, "name": whName},
			"_count":    map[string]any{"items": itemCount},
		})
	}
	return out, rows.Err()
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	head, err := s.loadHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	items, err := s.loadItems(ctx, id)
	if err != nil {
		return nil, err
	}
	head["items"] = items
	return head, nil
}

func (s *Service) loadHead(ctx context.Context, id, companyID string) (map[string]any, error) {
	var cid, wid, ref, st, initiatedBy string
	var approvedBy *string
	var startedAt, createdAt, updatedAt time.Time
	var completedAt *time.Time
	var whID, whName string
	err := s.pool.QueryRow(ctx, `
		SELECT ic."companyId", ic."warehouseId", ic.reference, ic.status,
		       ic."startedAt", ic."completedAt", ic."initiatedBy", ic."approvedBy",
		       ic."createdAt", ic."updatedAt", w.id, w.name
		FROM "InventoryCount" ic
		JOIN "Warehouse" w ON w.id = ic."warehouseId"
		WHERE ic.id = $1 AND ic."companyId" = $2
	`, id, companyID).Scan(
		&cid, &wid, &ref, &st, &startedAt, &completedAt, &initiatedBy, &approvedBy,
		&createdAt, &updatedAt, &whID, &whName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "companyId": cid, "warehouseId": wid, "reference": ref, "status": st,
		"startedAt": startedAt, "completedAt": completedAt, "initiatedBy": initiatedBy,
		"approvedBy": approvedBy, "createdAt": createdAt, "updatedAt": updatedAt,
		"warehouse": map[string]any{"id": whID, "name": whName},
	}, nil
}

func (s *Service) loadItems(ctx context.Context, countID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT ici.id, ici."inventoryCountId", ici."productVariantId", ici."binLocation",
		       ici."systemQuantity", ici."countedQuantity", ici.variance, ici."variancePct",
		       ici.status, ici."scannedAt", ici."scannedBy", ici.note,
		       pv.id, pv.name, pv.sku, pv.barcode, p.name
		FROM "InventoryCountItem" ici
		JOIN "ProductVariant" pv ON pv.id = ici."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE ici."inventoryCountId" = $1
		ORDER BY ici.id ASC
	`, countID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var itemID, invID, variantID, itemStatus string
		var bin, note, scannedBy, sku, barcode, variantName, productName *string
		var systemQty float64
		var countedQty, variance, variancePct *float64
		var scannedAt *time.Time
		var pvID string
		if err := rows.Scan(
			&itemID, &invID, &variantID, &bin, &systemQty, &countedQty, &variance, &variancePct,
			&itemStatus, &scannedAt, &scannedBy, &note,
			&pvID, &variantName, &sku, &barcode, &productName,
		); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": itemID, "inventoryCountId": invID, "productVariantId": variantID,
			"binLocation": bin, "systemQuantity": systemQty, "countedQuantity": countedQty,
			"variance": variance, "variancePct": variancePct, "status": itemStatus,
			"scannedAt": scannedAt, "scannedBy": scannedBy, "note": note,
			"productVariant": map[string]any{
				"id": pvID, "name": variantName, "sku": sku, "barcode": barcode,
				"product": map[string]any{"name": productName},
			},
		})
	}
	return out, rows.Err()
}

func (s *Service) generateReference(ctx context.Context, tx pgx.Tx, companyID string) (string, error) {
	now := time.Now().UTC()
	prefix := fmt.Sprintf("INV-%04d%02d%02d", now.Year(), now.Month(), now.Day())
	var count int
	err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "InventoryCount"
		WHERE "companyId" = $1 AND reference LIKE $2
	`, companyID, prefix+"%").Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%04d", prefix, count+1), nil
}

func (s *Service) Start(ctx context.Context, companyID, userID string, in StartInput) (map[string]any, error) {
	var whExists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE')
	`, in.WarehouseID, companyID).Scan(&whExists)
	if err != nil {
		return nil, err
	}
	if !whExists {
		return nil, ErrWarehouseNF
	}

	var activeRef *string
	err = s.pool.QueryRow(ctx, `
		SELECT reference FROM "InventoryCount"
		WHERE "companyId" = $1 AND "warehouseId" = $2 AND status IN ('IN_PROGRESS', 'PENDING_APPROVAL')
		LIMIT 1
	`, companyID, in.WarehouseID).Scan(&activeRef)
	if err == nil && activeRef != nil {
		return nil, fmt.Errorf("%s: %s", ErrActiveCount.Error(), *activeRef)
	}

	balSQL := `
		SELECT "productVariantId", quantity FROM "StockBalance"
		WHERE "companyId" = $1 AND "warehouseId" = $2
	`
	args := []any{companyID, in.WarehouseID}
	if len(in.ProductVariantIDs) > 0 {
		balSQL += ` AND "productVariantId" = ANY($3)`
		args = append(args, in.ProductVariantIDs)
	}
	rows, err := s.pool.Query(ctx, balSQL, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	balances := []balanceRow{}
	for rows.Next() {
		var b balanceRow
		if err := rows.Scan(&b.ProductVariantID, &b.Quantity); err != nil {
			return nil, err
		}
		balances = append(balances, b)
	}
	if len(balances) == 0 {
		return nil, ErrNoBalances
	}

	positive := []balanceRow{}
	for _, b := range balances {
		if b.Quantity > 0 {
			positive = append(positive, b)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	ref, err := s.generateReference(ctx, tx, companyID)
	if err != nil {
		return nil, err
	}
	countID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO "InventoryCount" (
			id, "companyId", "warehouseId", reference, status, "initiatedBy", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, NOW(), NOW())
	`, countID, companyID, in.WarehouseID, ref, userID)
	if err != nil {
		return nil, err
	}
	for _, b := range balances {
		_, err = tx.Exec(ctx, `
			INSERT INTO "InventoryCountItem" (
				id, "inventoryCountId", "productVariantId", "systemQuantity", status
			) VALUES ($1, $2, $3, $4, 'PENDING')
		`, uuid.NewString(), countID, b.ProductVariantID, b.Quantity)
		if err != nil {
			return nil, err
		}
	}
	if err := applyInventoryBlocks(ctx, tx, countID, companyID, in.WarehouseID, userID, positive); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	count, err := s.FindOne(ctx, countID, companyID)
	if err != nil {
		return nil, err
	}
	whName, _ := count["warehouse"].(map[string]any)["name"].(string)
	items, _ := count["items"].([]map[string]any)
	go func() {
		_ = s.notify.NotifyCompanyRoles(context.Background(), companyID, []string{"WAREHOUSE", "MANAGER"},
			"Inventarizatsiya boshlandi", fmt.Sprintf("%s — %s, %d ta mahsulot", ref, whName, len(items)),
			"INFO", "WAREHOUSE", "inventory.started")
	}()
	return count, nil
}

func (s *Service) RecordByBarcode(ctx context.Context, countID, companyID, userID, barcode string, qty float64) (map[string]any, error) {
	code := strings.TrimSpace(barcode)
	if code == "" {
		return nil, errors.New("Barcode yoki SKU kiriting")
	}
	var itemID string
	err := s.pool.QueryRow(ctx, `
		SELECT ici.id FROM "InventoryCountItem" ici
		JOIN "InventoryCount" ic ON ic.id = ici."inventoryCountId"
		JOIN "ProductVariant" pv ON pv.id = ici."productVariantId"
		WHERE ici."inventoryCountId" = $1 AND ic."companyId" = $2
		  AND (pv.barcode = $3 OR pv.sku = $3)
		LIMIT 1
	`, countID, companyID, code).Scan(&itemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBarcodeNF
	}
	if err != nil {
		return nil, err
	}
	return s.RecordCount(ctx, itemID, companyID, userID, qty)
}

func (s *Service) RecordCount(ctx context.Context, itemID, companyID, userID string, countedQty float64) (map[string]any, error) {
	if math.IsNaN(countedQty) || math.IsInf(countedQty, 0) || countedQty < 0 {
		return nil, errors.New("Sanalgan miqdor noto'g'ri")
	}

	var countID, countStatus, variantName string
	var systemQty float64
	err := s.pool.QueryRow(ctx, `
		SELECT ici."inventoryCountId", ic.status, ici."systemQuantity", pv.name
		FROM "InventoryCountItem" ici
		JOIN "InventoryCount" ic ON ic.id = ici."inventoryCountId"
		JOIN "ProductVariant" pv ON pv.id = ici."productVariantId"
		WHERE ici.id = $1 AND ic."companyId" = $2
	`, itemID, companyID).Scan(&countID, &countStatus, &systemQty, &variantName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrItemNotFound
	}
	if err != nil {
		return nil, err
	}
	if countStatus != "IN_PROGRESS" && countStatus != "PENDING_APPROVAL" {
		return nil, errors.New("Inventarizatsiya aktiv emas")
	}

	var tolerance float64 = 1
	_ = s.pool.QueryRow(ctx, `SELECT COALESCE("inventoryVarianceTolerancePct", 1) FROM "Company" WHERE id = $1`, companyID).Scan(&tolerance)

	variance := countedQty - systemQty
	variancePct := 0.0
	if systemQty > 0 {
		variancePct = math.Abs(variance) / systemQty * 100
	} else if countedQty > 0 {
		variancePct = 100
	}
	needsApproval := variancePct > tolerance
	itemStatus := "APPROVED"
	if needsApproval {
		itemStatus = "COUNTED"
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE "InventoryCountItem" SET
			"countedQuantity" = $1, variance = $2, "variancePct" = $3,
			status = $4, "scannedAt" = NOW(), "scannedBy" = $5
		WHERE id = $6
	`, countedQty, variance, variancePct, itemStatus, userID, itemID)
	if err != nil {
		return nil, err
	}
	if needsApproval {
		_, _ = s.pool.Exec(ctx, `UPDATE "InventoryCount" SET status = 'PENDING_APPROVAL', "updatedAt" = NOW() WHERE id = $1`, countID)
		go func() {
			_ = s.notify.NotifyCompanyRoles(context.Background(), companyID, []string{"MANAGER", "OWNER"},
				"Inventarizatsiya farqi",
				fmt.Sprintf("%s: tizim %g, sanalgan %g (%.1f%%)", variantName, systemQty, countedQty, variancePct),
				"WARNING", "WAREHOUSE", "inventory.variance_detected")
		}()
	}

	return map[string]any{
		"id": itemID, "countedQuantity": countedQty, "variance": variance,
		"variancePct": variancePct, "status": itemStatus, "needsApproval": needsApproval,
	}, nil
}

func (s *Service) ApproveItem(ctx context.Context, itemID, companyID string) (map[string]any, error) {
	var status string
	err := s.pool.QueryRow(ctx, `
		SELECT ici.status FROM "InventoryCountItem" ici
		JOIN "InventoryCount" ic ON ic.id = ici."inventoryCountId"
		WHERE ici.id = $1 AND ic."companyId" = $2
	`, itemID, companyID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrItemNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "COUNTED" {
		return nil, errors.New("Faqat COUNTED holatidagi qatorni tasdiqlash mumkin")
	}
	_, err = s.pool.Exec(ctx, `UPDATE "InventoryCountItem" SET status = 'APPROVED' WHERE id = $1`, itemID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": itemID, "status": "APPROVED"}, nil
}

func (s *Service) Complete(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	count, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	st, _ := count["status"].(string)
	if st != "IN_PROGRESS" && st != "PENDING_APPROVAL" {
		return nil, errors.New("Inventarizatsiyani yakunlab bo'lmaydi")
	}
	items, _ := count["items"].([]map[string]any)
	for _, it := range items {
		itemSt, _ := it["status"].(string)
		if itemSt == "PENDING" {
			return nil, errors.New("Hali sanalmagan qatorlar bor")
		}
		if itemSt == "COUNTED" {
			return nil, errors.New("Manager tasdiqlashini kutayotgan farqlar bor")
		}
	}

	warehouseID, _ := count["warehouseId"].(string)
	ref, _ := count["reference"].(string)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for _, it := range items {
		itemSt, _ := it["status"].(string)
		if itemSt != "APPROVED" {
			continue
		}
		variance := float64(0)
		switch v := it["variance"].(type) {
		case float64:
			variance = v
		case *float64:
			if v != nil {
				variance = *v
			}
		}
		if variance == 0 {
			continue
		}
		variantID, _ := it["productVariantId"].(string)
		movType := "OUT"
		if variance > 0 {
			movType = "IN"
		}
		line := stock.Line{
			WarehouseID: warehouseID, ProductVariantID: variantID,
			Quantity: math.Abs(variance), Note: "Inventarizatsiya " + ref,
		}
		if err := stock.RecordMovements(ctx, tx, companyID, userID, movType, "ADJUSTMENT", []stock.Line{line}); err != nil {
			return nil, err
		}
	}
	_, err = tx.Exec(ctx, `
		UPDATE "InventoryCount" SET status = 'COMPLETED', "completedAt" = NOW(), "approvedBy" = $1, "updatedAt" = NOW()
		WHERE id = $2
	`, userID, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if err := releaseBlocksForCount(ctx, s.pool, id, companyID); err != nil {
		return nil, err
	}
	s.hub.EmitInventoryChanged(companyID, map[string]any{
		"warehouseId": warehouseID,
		"reason":      "INVENTORY_COUNT",
	})
	s.hub.EmitDashboardRefresh(companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Cancel(ctx context.Context, id, companyID string) (map[string]any, error) {
	count, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	st, _ := count["status"].(string)
	if st != "IN_PROGRESS" && st != "PENDING_APPROVAL" && st != "DRAFT" {
		return nil, errors.New("Inventarizatsiyani bekor qilib bo'lmaydi")
	}
	if err := releaseBlocksForCount(ctx, s.pool, id, companyID); err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `UPDATE "InventoryCount" SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}
