package stock

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

var (
	ErrWarehouseNF = errors.New("Ombor topilmadi")
	ErrVariantNF   = errors.New("Mahsulot varianti topilmadi")
	ErrBadAdjust   = errors.New("Tuzatish miqdori 0 bo'lishi mumkin emas")
	ErrSameWH      = errors.New("Manba va manzil ombori bir xil bo'lishi mumkin emas")
)

type Service struct {
	pool  *pgxpool.Pool
	hub   pkgrealtime.Hub
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, hub pkgrealtime.Hub, c *cache.Cache) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, hub: hub, cache: c}
}

func (s *Service) emitInventoryChanged(ctx context.Context, companyID, warehouseID, variantID, reason string) {
	if s == nil {
		return
	}
	payload := map[string]any{"reason": reason}
	if warehouseID != "" {
		payload["warehouseId"] = warehouseID
	}
	if variantID != "" {
		payload["productVariantId"] = variantID
	}
	pkgrealtime.NotifyInventory(ctx, s.hub, s.cache, companyID, payload)
}

type MovementInput struct {
	WarehouseID      string  `json:"warehouseId"`
	ProductVariantID string  `json:"productVariantId"`
	Quantity         float64 `json:"quantity"`
	Note             *string `json:"note"`
	SourceID         *string `json:"sourceId"`
}

type AdjustmentInput struct {
	WarehouseID      string  `json:"warehouseId"`
	ProductVariantID string  `json:"productVariantId"`
	Quantity         float64 `json:"quantity"`
	Note             string  `json:"note"`
}

type TransferInput struct {
	FromWarehouseID  string  `json:"fromWarehouseId"`
	ToWarehouseID    string  `json:"toWarehouseId"`
	ProductVariantID string  `json:"productVariantId"`
	Quantity         float64 `json:"quantity"`
	Note             *string `json:"note"`
}

func (s *Service) resolveWarehouse(ctx context.Context, companyID, userID, requested string) (string, error) {
	whScope, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return "", err
	}
	return whScope.Resolve(requested)
}

func (s *Service) GetBalances(ctx context.Context, companyID, userID, warehouseID string) ([]map[string]any, error) {
	resolved, err := s.resolveWarehouse(ctx, companyID, userID, warehouseID)
	if err != nil {
		return nil, err
	}
	sql := `
		SELECT sb.id, sb."warehouseId", sb."productVariantId", sb.quantity, sb."reservedQuantity",
		       COALESCE(sb."blockedQuantity", 0), sb."updatedAt",
		       w.id, w.name, w.status,
		       pv.id, pv.name, pv.sku, pv.barcode, pv."salePrice", pv.currency,
		       p.id, p.name, p.unit, p."imageUrl"
		FROM "StockBalance" sb
		JOIN "Warehouse" w ON w.id = sb."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sb."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE sb."companyId" = $1 AND w.status <> 'ARCHIVED'
	`
	args := []any{companyID}
	if resolved != "" {
		sql += ` AND sb."warehouseId" = $2`
		args = append(args, resolved)
	}
	sql += ` ORDER BY sb."updatedAt" DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, whID, variantID string
		var qty, reserved, blocked float64
		var updatedAt time.Time
		var wID, wName, wStatus string
		var pvID, pvName, currency string
		var sku, barcode, image *string
		var salePrice float64
		var pID, pName, unit string
		if err := rows.Scan(&id, &whID, &variantID, &qty, &reserved, &blocked, &updatedAt,
			&wID, &wName, &wStatus, &pvID, &pvName, &sku, &barcode, &salePrice, &currency, &pID, &pName, &unit, &image); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "warehouseId": whID, "productVariantId": variantID,
			"quantity": qty, "reservedQuantity": reserved, "blockedQuantity": blocked, "updatedAt": updatedAt,
			"warehouse": map[string]any{"id": wID, "name": wName, "status": wStatus},
			"productVariant": map[string]any{
				"id": pvID, "name": pvName, "sku": sku, "barcode": barcode, "salePrice": salePrice, "currency": currency,
				"product": map[string]any{"id": pID, "name": pName, "unit": unit, "imageUrl": image},
			},
		})
	}
	return out, rows.Err()
}

func sourceLabel(sourceType string) string {
	switch sourceType {
	case "WAREHOUSE_INTAKE":
		return "Ombor kirimi"
	case "MANUAL":
		return "Qo'lda"
	case "POS_SALE":
		return "POS sotuv"
	case "PARTNER_SALE":
		return "Hamkor sotuvi"
	case "DISPATCH":
		return "Jo'natma"
	case "GOODS_RECEIPT":
		return "B2B qabul"
	case "STOCK_IN_MANUAL":
		return "Qo'lda kirim"
	case "STOCK_OUT_MANUAL":
		return "Qo'lda chiqim"
	case "ADJUSTMENT":
		return "Tuzatish"
	case "TRANSFER":
		return "Ko'chirish"
	case "PRODUCT_INITIAL":
		return "Boshlang'ich qoldiq"
	default:
		if sourceType == "" {
			return "Boshqa"
		}
		return sourceType
	}
}

type movementHistoryRow struct {
	id, whID, variantID, mType, sourceType string
	sourceID                                 *string
	qty                                      float64
	note, createdBy, userName                *string
	createdAt                                time.Time
	whName, variantName, productID, productName, unit string
	barcode, sku                             *string
}

func movementCreatedBy(createdBy, userName *string) any {
	if createdBy == nil {
		return nil
	}
	name := "Noma'lum"
	if userName != nil {
		name = *userName
	}
	return map[string]any{"id": *createdBy, "fullName": name}
}

func (s *Service) GetMovements(ctx context.Context, companyID, userID, warehouseID string) ([]map[string]any, error) {
	resolved, err := s.resolveWarehouse(ctx, companyID, userID, warehouseID)
	if err != nil {
		return nil, err
	}
	sql := `
		SELECT sm.id, sm."warehouseId", sm."productVariantId", sm.type, sm.quantity, sm."sourceType", sm."sourceId", sm.note, sm."createdBy", sm."createdAt",
		       w.name, pv.name, pv.barcode, pv.sku, p.id, p.name, COALESCE(p.unit, 'dona'), u."fullName"
		FROM "StockMovement" sm
		JOIN "Warehouse" w ON w.id = sm."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "User" u ON u.id = sm."createdBy"
		WHERE sm."companyId" = $1 AND w.status <> 'ARCHIVED'
	`
	args := []any{companyID}
	if resolved != "" {
		sql += ` AND sm."warehouseId" = $2`
		args = append(args, resolved)
	}
	sql += ` ORDER BY sm."createdAt" DESC LIMIT 300`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	movements := []movementHistoryRow{}
	for rows.Next() {
		var row movementHistoryRow
		if err := rows.Scan(
			&row.id, &row.whID, &row.variantID, &row.mType, &row.qty, &row.sourceType, &row.sourceID, &row.note, &row.createdBy, &row.createdAt,
			&row.whName, &row.variantName, &row.barcode, &row.sku, &row.productID, &row.productName, &row.unit, &row.userName,
		); err != nil {
			return nil, err
		}
		movements = append(movements, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(movements) == 0 {
		return []map[string]any{}, nil
	}

	intakeIDs := []string{}
	seenIntake := map[string]struct{}{}
	for _, m := range movements {
		if m.sourceType == "WAREHOUSE_INTAKE" && m.sourceID != nil && strings.TrimSpace(*m.sourceID) != "" {
			if _, ok := seenIntake[*m.sourceID]; !ok {
				seenIntake[*m.sourceID] = struct{}{}
				intakeIDs = append(intakeIDs, *m.sourceID)
			}
		}
	}

	intakeMeta := map[string]struct{ reference, note *string }{}
	if len(intakeIDs) > 0 {
		irows, err := s.pool.Query(ctx, `
			SELECT id, reference, note FROM "WarehouseIntake"
			WHERE "companyId" = $1 AND id = ANY($2)
		`, companyID, intakeIDs)
		if err != nil {
			return nil, err
		}
		for irows.Next() {
			var id, reference string
			var note *string
			if err := irows.Scan(&id, &reference, &note); err != nil {
				irows.Close()
				return nil, err
			}
			intakeMeta[id] = struct{ reference, note *string }{reference: &reference, note: note}
		}
		irows.Close()
	}

	intakeGroups := map[string][]movementHistoryRow{}
	singles := []movementHistoryRow{}
	for _, m := range movements {
		if m.sourceType == "WAREHOUSE_INTAKE" && m.sourceID != nil {
			intakeGroups[*m.sourceID] = append(intakeGroups[*m.sourceID], m)
		} else {
			singles = append(singles, m)
		}
	}

	history := []map[string]any{}
	for sourceID, lines := range intakeGroups {
		if len(lines) == 0 {
			continue
		}
		anchor := lines[0]
		for _, l := range lines[1:] {
			if l.createdAt.After(anchor.createdAt) {
				anchor = l
			}
		}
		meta := intakeMeta[sourceID]
		reference := "Ombor kirimi"
		if meta.reference != nil && strings.TrimSpace(*meta.reference) != "" {
			reference = *meta.reference
		} else if anchor.note != nil && strings.TrimSpace(*anchor.note) != "" {
			reference = *anchor.note
		}
		totalUnits := 0.0
		intakeLines := make([]map[string]any, 0, len(lines))
		for _, l := range lines {
			totalUnits += l.qty
			intakeLines = append(intakeLines, map[string]any{
				"id": l.id, "productName": l.productName, "variantName": l.variantName,
				"quantity": l.qty, "unit": l.unit,
				"barcode": l.barcode, "sku": l.sku,
			})
		}
		sort.Slice(intakeLines, func(i, j int) bool {
			a, _ := intakeLines[i]["productName"].(string)
			b, _ := intakeLines[j]["productName"].(string)
			return strings.Compare(a, b) < 0
		})
		var intakeNote any
		if meta.note != nil {
			intakeNote = *meta.note
		}
		history = append(history, map[string]any{
			"kind": "intake", "id": sourceID, "intakeId": sourceID, "reference": reference,
			"createdAt": anchor.createdAt, "type": "IN", "sourceType": "WAREHOUSE_INTAKE",
			"sourceLabel": sourceLabel("WAREHOUSE_INTAKE"),
			"createdBy": movementCreatedBy(anchor.createdBy, anchor.userName),
			"warehouse": map[string]any{"id": anchor.whID, "name": anchor.whName},
			"totalUnits": totalUnits, "lineCount": len(lines), "note": intakeNote,
			"lines": intakeLines,
		})
	}

	for _, m := range singles {
		history = append(history, map[string]any{
			"kind": "single", "id": m.id, "createdAt": m.createdAt, "type": m.mType,
			"sourceType": m.sourceType, "sourceLabel": sourceLabel(m.sourceType),
			"createdBy": movementCreatedBy(m.createdBy, m.userName),
			"warehouse": map[string]any{"id": m.whID, "name": m.whName},
			"productVariant": map[string]any{
				"id": m.variantID, "name": m.variantName,
				"product": map[string]any{"id": m.productID, "name": m.productName, "unit": m.unit},
			},
			"quantity": m.qty, "unit": m.unit, "note": m.note,
		})
	}

	sort.Slice(history, func(i, j int) bool {
		ti, _ := history[i]["createdAt"].(time.Time)
		tj, _ := history[j]["createdAt"].(time.Time)
		return ti.After(tj)
	})
	if len(history) > 100 {
		history = history[:100]
	}
	return history, nil
}

func (s *Service) verifyEntities(ctx context.Context, companyID, warehouseID, variantID string) error {
	var id string
	if err := s.pool.QueryRow(ctx, `SELECT id FROM "Warehouse" WHERE id = $1 AND "companyId" = $2`, warehouseID, companyID).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrWarehouseNF
		}
		return err
	}
	if err := s.pool.QueryRow(ctx, `SELECT id FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2`, variantID, companyID).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrVariantNF
		}
		return err
	}
	return nil
}

func noteStr(n *string) string {
	if n == nil {
		return ""
	}
	return *n
}

func (s *Service) RecordIn(ctx context.Context, companyID, userID string, in MovementInput) (map[string]any, error) {
	if err := s.verifyEntities(ctx, companyID, in.WarehouseID, in.ProductVariantID); err != nil {
		return nil, err
	}
	src := ""
	if in.SourceID != nil {
		src = *in.SourceID
	}
	id, err := RecordSingle(ctx, s.pool, companyID, userID, "IN", "MANUAL", Line{
		WarehouseID: in.WarehouseID, ProductVariantID: in.ProductVariantID,
		Quantity: in.Quantity, Note: noteStr(in.Note), SourceID: src,
	})
	if err != nil {
		return nil, err
	}
	s.emitInventoryChanged(ctx, companyID, in.WarehouseID, in.ProductVariantID, "MANUAL")
	return s.movementByID(ctx, id)
}

func (s *Service) RecordOut(ctx context.Context, companyID, userID string, in MovementInput) (map[string]any, error) {
	if err := s.verifyEntities(ctx, companyID, in.WarehouseID, in.ProductVariantID); err != nil {
		return nil, err
	}
	src := ""
	if in.SourceID != nil {
		src = *in.SourceID
	}
	id, err := RecordSingle(ctx, s.pool, companyID, userID, "OUT", "MANUAL", Line{
		WarehouseID: in.WarehouseID, ProductVariantID: in.ProductVariantID,
		Quantity: in.Quantity, Note: noteStr(in.Note), SourceID: src,
	})
	if err != nil {
		return nil, err
	}
	s.emitInventoryChanged(ctx, companyID, in.WarehouseID, in.ProductVariantID, "MANUAL")
	return s.movementByID(ctx, id)
}

func (s *Service) Adjust(ctx context.Context, companyID, userID string, in AdjustmentInput) (map[string]any, error) {
	if in.Quantity == 0 {
		return nil, ErrBadAdjust
	}
	mType := "IN"
	qty := math.Abs(in.Quantity)
	if in.Quantity < 0 {
		mType = "OUT"
	}
	if err := s.verifyEntities(ctx, companyID, in.WarehouseID, in.ProductVariantID); err != nil {
		return nil, err
	}
	id, err := RecordSingle(ctx, s.pool, companyID, userID, mType, "ADJUSTMENT", Line{
		WarehouseID: in.WarehouseID, ProductVariantID: in.ProductVariantID, Quantity: qty, Note: in.Note,
	})
	if err != nil {
		return nil, err
	}
	s.emitInventoryChanged(ctx, companyID, in.WarehouseID, in.ProductVariantID, "ADJUSTMENT")
	return s.movementByID(ctx, id)
}

func (s *Service) Transfer(ctx context.Context, companyID, userID string, in TransferInput) (map[string]any, error) {
	if in.FromWarehouseID == in.ToWarehouseID {
		return nil, ErrSameWH
	}
	if err := s.verifyEntities(ctx, companyID, in.FromWarehouseID, in.ProductVariantID); err != nil {
		return nil, err
	}
	if err := s.verifyEntities(ctx, companyID, in.ToWarehouseID, in.ProductVariantID); err != nil {
		return nil, err
	}
	note := ""
	if in.Note != nil {
		note = *in.Note
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = recordOne(ctx, tx, companyID, userID, "OUT", "TRANSFER", Line{
		WarehouseID: in.FromWarehouseID, ProductVariantID: in.ProductVariantID, Quantity: in.Quantity,
		Note: fmt.Sprintf("Transfer to %s. %s", in.ToWarehouseID, note),
	}, -1)
	if err != nil {
		return nil, err
	}
	destID, err := recordOne(ctx, tx, companyID, userID, "IN", "TRANSFER", Line{
		WarehouseID: in.ToWarehouseID, ProductVariantID: in.ProductVariantID, Quantity: in.Quantity,
		Note: fmt.Sprintf("Transfer from %s. %s", in.FromWarehouseID, note),
	}, 1)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.emitInventoryChanged(ctx, companyID, in.FromWarehouseID, in.ProductVariantID, "TRANSFER")
	return s.movementByID(ctx, destID)
}

type BatchAvailabilityInput struct {
	WarehouseID string   `json:"warehouseId"`
	VariantIDs  []string `json:"variantIds"`
}

func (s *Service) GetBatchAvailability(ctx context.Context, companyID, userID string, in BatchAvailabilityInput) ([]map[string]any, error) {
	whScope, _ := scope.ForUser(ctx, s.pool, companyID, userID)
	warehouseID, err := whScope.Resolve(strings.TrimSpace(in.WarehouseID))
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(in.VariantIDs))
	for _, variantID := range in.VariantIDs {
		if strings.TrimSpace(variantID) == "" {
			continue
		}
		item, err := s.GetAvailability(ctx, companyID, variantID, warehouseID)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, nil
}

func (s *Service) GetAvailability(ctx context.Context, companyID, variantID, warehouseID string) (map[string]any, error) {
	var onHand, reserved, blocked float64
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(quantity, 0), COALESCE("reservedQuantity", 0), COALESCE("blockedQuantity", 0)
		FROM "StockBalance" WHERE "productVariantId" = $1 AND "warehouseId" = $2 AND "companyId" = $3
	`, variantID, warehouseID, companyID).Scan(&onHand, &reserved, &blocked)
	if errors.Is(err, pgx.ErrNoRows) {
		onHand, reserved, blocked = 0, 0, 0
	} else if err != nil {
		return nil, err
	}
	free := onHand - reserved - blocked
	if free < 0 {
		free = 0
	}
	return map[string]any{
		"productVariantId": variantID, "warehouseId": warehouseID,
		"onHand": onHand, "reserved": reserved, "blocked": blocked, "free": free,
	}, nil
}

func (s *Service) movementByID(ctx context.Context, id string) (map[string]any, error) {
	var whID, variantID, mType, sourceType string
	var qty float64
	var note *string
	var createdAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT "warehouseId", "productVariantId", type, quantity, "sourceType", note, "createdAt"
		FROM "StockMovement" WHERE id = $1
	`, id).Scan(&whID, &variantID, &mType, &qty, &sourceType, &note, &createdAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "warehouseId": whID, "productVariantId": variantID,
		"type": mType, "quantity": qty, "sourceType": sourceType, "note": note, "createdAt": createdAt,
	}, nil
}
