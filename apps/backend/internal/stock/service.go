package stock

import (
	"context"
	"errors"
	"fmt"
	"math"
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

func (s *Service) GetMovements(ctx context.Context, companyID, userID, warehouseID string) ([]map[string]any, error) {
	resolved, err := s.resolveWarehouse(ctx, companyID, userID, warehouseID)
	if err != nil {
		return nil, err
	}
	sql := `
		SELECT sm.id, sm."warehouseId", sm."productVariantId", sm.type, sm.quantity, sm."sourceType", sm.note, sm."createdBy", sm."createdAt",
		       w.name, pv.name, p.name, u."fullName"
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
	sql += ` ORDER BY sm."createdAt" DESC LIMIT 100`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, whID, variantID, mType, sourceType string
		var qty float64
		var note, createdBy, userName *string
		var createdAt time.Time
		var whName, variantName, productName string
		if err := rows.Scan(&id, &whID, &variantID, &mType, &qty, &sourceType, &note, &createdBy, &createdAt,
			&whName, &variantName, &productName, &userName); err != nil {
			return nil, err
		}
		var by any = nil
		if createdBy != nil {
			name := "Noma'lum"
			if userName != nil {
				name = *userName
			}
			by = map[string]any{"id": *createdBy, "fullName": name}
		}
		out = append(out, map[string]any{
			"kind": "single", "id": id, "createdAt": createdAt, "type": mType,
			"sourceType": sourceType, "sourceLabel": sourceLabel(sourceType),
			"createdBy": by,
			"warehouse": map[string]any{"id": whID, "name": whName},
			"productVariant": map[string]any{
				"id": variantID, "name": variantName,
				"product": map[string]any{"name": productName},
			},
			"quantity": qty, "note": note,
		})
	}
	return out, nil
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
