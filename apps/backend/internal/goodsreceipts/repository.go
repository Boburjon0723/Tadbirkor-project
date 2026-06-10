package goodsreceipts

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("Qabul hujjati topilmadi")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type ListQuery struct {
	Status string
	Search string
	Limit  int
	Skip   int
}

type ReceiptRecord struct {
	ID              string
	OrderID         string
	DispatchID      *string
	BuyerCompanyID  string
	SellerCompanyID string
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	ReceivedAt      *time.Time
	BuyerName       string
	SellerName      string
	SellerTin       *string
}

type ReceiptItemRecord struct {
	ID                  string
	ReceiptID           string
	ProductVariantID    *string
	ProductNameSnapshot string
	Quantity            float64
	ReceivedQuantity    *float64
}

type OrderItemRecord struct {
	OrderID             string
	ProductVariantID    *string
	ProductNameSnapshot string
	Quantity            float64
	ExpectedPrice       float64
	ExpectedCurrency    string
}

type DispatchItemRecord struct {
	DispatchID          string
	ProductVariantID    string
	ProductNameSnapshot string
	Quantity            float64
}

type ReceiptBundle struct {
	Head          ReceiptRecord
	Items         []ReceiptItemRecord
	OrderItems    []OrderItemRecord
	DispatchItems []DispatchItemRecord
}

type InboundMovement struct {
	WarehouseID      string
	WarehouseName    string
	ProductVariantID string
	ProductName      string
	VariantName      string
	SKU              *string
	Quantity         float64
}

type MappingRecord struct {
	ID                  string
	PartnerProductName  string
	PartnerSKU          *string
	PartnerBarcode      *string
	OwnProductVariantID string
}

type VariantLite struct {
	ID           string
	Name         string
	SKU          *string
	Barcode      *string
	ProductID    string
	ProductName  string
	CategoryID   *string
	CategoryName *string
}

type queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Repository) ListReceipts(ctx context.Context, companyID string, q ListQuery) ([]ReceiptRecord, int, error) {
	where := `gr."buyerCompanyId" = $1`
	args := []any{companyID}
	n := 2

	if st := strings.ToUpper(strings.TrimSpace(q.Status)); st != "" {
		where += fmt.Sprintf(` AND gr.status = $%d`, n)
		args = append(args, st)
		n++
	}
	if search := strings.TrimSpace(q.Search); search != "" {
		where += fmt.Sprintf(` AND (
			gr.id ILIKE $%d
			OR seller.name ILIKE $%d
			OR buyer.name ILIKE $%d
			OR COALESCE(seller.tin, '') ILIKE $%d
		)`, n, n, n, n)
		args = append(args, "%"+search+"%")
		n++
	}

	var total int
	countSQL := `
		SELECT COUNT(*)::int
		FROM "GoodsReceipt" gr
		JOIN "Company" buyer ON buyer.id = gr."buyerCompanyId"
		JOIN "Company" seller ON seller.id = gr."sellerCompanyId"
		WHERE ` + where
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listSQL := fmt.Sprintf(`
		SELECT
			gr.id, gr."orderId", gr."dispatchId", gr."buyerCompanyId", gr."sellerCompanyId",
			gr.status, gr."createdAt", gr."updatedAt", gr."receivedAt",
			buyer.name, seller.name, seller.tin
		FROM "GoodsReceipt" gr
		JOIN "Company" buyer ON buyer.id = gr."buyerCompanyId"
		JOIN "Company" seller ON seller.id = gr."sellerCompanyId"
		WHERE %s
		ORDER BY gr."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, n, n+1)
	args = append(args, q.Limit, q.Skip)

	rows, err := r.pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]ReceiptRecord, 0)
	for rows.Next() {
		var row ReceiptRecord
		if err := rows.Scan(
			&row.ID,
			&row.OrderID,
			&row.DispatchID,
			&row.BuyerCompanyID,
			&row.SellerCompanyID,
			&row.Status,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.ReceivedAt,
			&row.BuyerName,
			&row.SellerName,
			&row.SellerTin,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

func (r *Repository) ReceiptStatusSummary(ctx context.Context, companyID string) (map[string]int, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT status, COUNT(*)::int
		FROM "GoodsReceipt"
		WHERE "buyerCompanyId" = $1
		GROUP BY status
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{
		"pending":  0,
		"accepted": 0,
		"rejected": 0,
		"other":    0,
	}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		switch status {
		case "PENDING":
			counts["pending"] += count
		case "ACCEPTED", "PARTIALLY_ACCEPTED":
			counts["accepted"] += count
		case "REJECTED":
			counts["rejected"] += count
		default:
			counts["other"] += count
		}
	}
	return counts, rows.Err()
}

func (r *Repository) LoadReceiptBundle(ctx context.Context, id, companyID string) (*ReceiptBundle, error) {
	return r.loadReceiptBundleQ(ctx, r.pool, id, companyID, false)
}

func (r *Repository) LoadReceiptBundleTx(ctx context.Context, tx pgx.Tx, id, companyID string, forUpdate bool) (*ReceiptBundle, error) {
	return r.loadReceiptBundleQ(ctx, tx, id, companyID, forUpdate)
}

func (r *Repository) loadReceiptBundleQ(ctx context.Context, q queryer, id, companyID string, forUpdate bool) (*ReceiptBundle, error) {
	suffix := ""
	if forUpdate {
		suffix = " FOR UPDATE"
	}
	var head ReceiptRecord
	err := q.QueryRow(ctx, `
		SELECT
			gr.id, gr."orderId", gr."dispatchId", gr."buyerCompanyId", gr."sellerCompanyId",
			gr.status, gr."createdAt", gr."updatedAt", gr."receivedAt",
			buyer.name, seller.name, seller.tin
		FROM "GoodsReceipt" gr
		JOIN "Company" buyer ON buyer.id = gr."buyerCompanyId"
		JOIN "Company" seller ON seller.id = gr."sellerCompanyId"
		WHERE gr.id = $1
		  AND (gr."buyerCompanyId" = $2 OR gr."sellerCompanyId" = $2)`+suffix,
		id, companyID,
	).Scan(
		&head.ID,
		&head.OrderID,
		&head.DispatchID,
		&head.BuyerCompanyID,
		&head.SellerCompanyID,
		&head.Status,
		&head.CreatedAt,
		&head.UpdatedAt,
		&head.ReceivedAt,
		&head.BuyerName,
		&head.SellerName,
		&head.SellerTin,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	items, err := r.loadReceiptItemsQ(ctx, q, head.ID)
	if err != nil {
		return nil, err
	}
	orderItems, err := r.loadOrderItemsQ(ctx, q, head.OrderID)
	if err != nil {
		return nil, err
	}
	dispatchItems := make([]DispatchItemRecord, 0)
	if head.DispatchID != nil && strings.TrimSpace(*head.DispatchID) != "" {
		dispatchItems, err = r.loadDispatchItemsQ(ctx, q, *head.DispatchID)
		if err != nil {
			return nil, err
		}
	}

	return &ReceiptBundle{
		Head:          head,
		Items:         items,
		OrderItems:    orderItems,
		DispatchItems: dispatchItems,
	}, nil
}

func (r *Repository) loadReceiptItemsQ(ctx context.Context, q queryer, receiptID string) ([]ReceiptItemRecord, error) {
	rows, err := q.Query(ctx, `
		SELECT id, "receiptId", "productVariantId", "productNameSnapshot", quantity, "receivedQuantity"
		FROM "GoodsReceiptItem"
		WHERE "receiptId" = $1
		ORDER BY "createdAt" ASC, id ASC
	`, receiptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]ReceiptItemRecord, 0)
	for rows.Next() {
		var row ReceiptItemRecord
		if err := rows.Scan(
			&row.ID,
			&row.ReceiptID,
			&row.ProductVariantID,
			&row.ProductNameSnapshot,
			&row.Quantity,
			&row.ReceivedQuantity,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) loadOrderItemsQ(ctx context.Context, q queryer, orderID string) ([]OrderItemRecord, error) {
	rows, err := q.Query(ctx, `
		SELECT "orderId", "productVariantId", "productNameSnapshot", quantity, COALESCE("expectedPrice", 0)::float8, COALESCE("expectedCurrency", 'UZS')
		FROM "B2BOrderItem"
		WHERE "orderId" = $1
		ORDER BY id ASC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]OrderItemRecord, 0)
	for rows.Next() {
		var row OrderItemRecord
		if err := rows.Scan(
			&row.OrderID,
			&row.ProductVariantID,
			&row.ProductNameSnapshot,
			&row.Quantity,
			&row.ExpectedPrice,
			&row.ExpectedCurrency,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) loadDispatchItemsQ(ctx context.Context, q queryer, dispatchID string) ([]DispatchItemRecord, error) {
	rows, err := q.Query(ctx, `
		SELECT "dispatchId", "productVariantId", "productNameSnapshot", quantity
		FROM "DispatchItem"
		WHERE "dispatchId" = $1
		ORDER BY "createdAt" ASC, id ASC
	`, dispatchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]DispatchItemRecord, 0)
	for rows.Next() {
		var row DispatchItemRecord
		if err := rows.Scan(
			&row.DispatchID,
			&row.ProductVariantID,
			&row.ProductNameSnapshot,
			&row.Quantity,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadReceiptItemsByIDs(ctx context.Context, receiptIDs []string) (map[string][]ReceiptItemRecord, error) {
	if len(receiptIDs) == 0 {
		return map[string][]ReceiptItemRecord{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, "receiptId", "productVariantId", "productNameSnapshot", quantity, "receivedQuantity"
		FROM "GoodsReceiptItem"
		WHERE "receiptId" = ANY($1)
		ORDER BY "createdAt" ASC, id ASC
	`, receiptIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string][]ReceiptItemRecord)
	for rows.Next() {
		var row ReceiptItemRecord
		if err := rows.Scan(
			&row.ID,
			&row.ReceiptID,
			&row.ProductVariantID,
			&row.ProductNameSnapshot,
			&row.Quantity,
			&row.ReceivedQuantity,
		); err != nil {
			return nil, err
		}
		out[row.ReceiptID] = append(out[row.ReceiptID], row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadOrderItemsByIDs(ctx context.Context, orderIDs []string) (map[string][]OrderItemRecord, error) {
	if len(orderIDs) == 0 {
		return map[string][]OrderItemRecord{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT "orderId", "productVariantId", "productNameSnapshot", quantity, COALESCE("expectedPrice", 0)::float8, COALESCE("expectedCurrency", 'UZS')
		FROM "B2BOrderItem"
		WHERE "orderId" = ANY($1)
		ORDER BY id ASC
	`, orderIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string][]OrderItemRecord)
	for rows.Next() {
		var row OrderItemRecord
		if err := rows.Scan(
			&row.OrderID,
			&row.ProductVariantID,
			&row.ProductNameSnapshot,
			&row.Quantity,
			&row.ExpectedPrice,
			&row.ExpectedCurrency,
		); err != nil {
			return nil, err
		}
		out[row.OrderID] = append(out[row.OrderID], row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadInboundMovements(ctx context.Context, receiptID, companyID string) ([]InboundMovement, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			sm."warehouseId",
			COALESCE(w.name, '—'),
			sm."productVariantId",
			COALESCE(p.name, ''),
			COALESCE(pv.name, ''),
			pv.sku,
			sm.quantity
		FROM "StockMovement" sm
		LEFT JOIN "Warehouse" w ON w.id = sm."warehouseId"
		LEFT JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
		LEFT JOIN "Product" p ON p.id = pv."productId"
		WHERE sm."companyId" = $1
		  AND sm.type = 'IN'
		  AND sm."sourceType" = 'GOODS_RECEIPT'
		  AND (sm."sourceId" = $2 OR COALESCE(sm.note, '') ILIKE '%%' || $2 || '%%')
		ORDER BY sm."createdAt" DESC
	`, companyID, receiptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]InboundMovement, 0)
	for rows.Next() {
		var row InboundMovement
		if err := rows.Scan(
			&row.WarehouseID,
			&row.WarehouseName,
			&row.ProductVariantID,
			&row.ProductName,
			&row.VariantName,
			&row.SKU,
			&row.Quantity,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadMappings(ctx context.Context, buyerCompanyID, sellerCompanyID string) ([]MappingRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, "partnerProductName", "partnerSku", "partnerBarcode", "ownProductVariantId"
		FROM "ProductMapping"
		WHERE "companyId" = $1
		  AND "partnerCompanyId" = $2
		  AND status = 'ACTIVE'
		ORDER BY "updatedAt" DESC
	`, buyerCompanyID, sellerCompanyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]MappingRecord, 0)
	for rows.Next() {
		var row MappingRecord
		if err := rows.Scan(
			&row.ID,
			&row.PartnerProductName,
			&row.PartnerSKU,
			&row.PartnerBarcode,
			&row.OwnProductVariantID,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadVariantsByIDs(ctx context.Context, companyID string, ids []string) (map[string]VariantLite, error) {
	return r.loadVariantsByIDsQ(ctx, r.pool, companyID, ids)
}

func (r *Repository) LoadVariantsByIDsTx(ctx context.Context, tx pgx.Tx, companyID string, ids []string) (map[string]VariantLite, error) {
	return r.loadVariantsByIDsQ(ctx, tx, companyID, ids)
}

func (r *Repository) loadVariantsByIDsQ(ctx context.Context, q queryer, companyID string, ids []string) (map[string]VariantLite, error) {
	out := make(map[string]VariantLite)
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT
			pv.id, pv.name, pv.sku, pv.barcode,
			p.id, p.name, c.id, c.name
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "ProductCategory" c ON c.id = p."categoryId"
		WHERE pv."companyId" = $1
		  AND pv.status = 'ACTIVE'
		  AND pv.id = ANY($2)
	`, companyID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var row VariantLite
		if err := rows.Scan(
			&row.ID,
			&row.Name,
			&row.SKU,
			&row.Barcode,
			&row.ProductID,
			&row.ProductName,
			&row.CategoryID,
			&row.CategoryName,
		); err != nil {
			return nil, err
		}
		out[row.ID] = row
	}
	return out, rows.Err()
}

func (r *Repository) FindWarehouseName(ctx context.Context, companyID, warehouseID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `
		SELECT name
		FROM "Warehouse"
		WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, warehouseID, companyID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("Faol ombor topilmadi")
	}
	return name, err
}
