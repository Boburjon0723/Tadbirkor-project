package dispatches

import (
	"context"
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

var (
	ErrNotFound      = errors.New("Jo'natma topilmadi")
	ErrOrderNotFound = errors.New("Buyurtma topilmadi")
	ErrWarehouseNF   = errors.New("Ombor topilmadi")
)

type orderItem struct {
	ID                  string
	ProductVariantID    *string
	ProductNameSnapshot string
	Quantity            float64
	MappingStatus       string
}

type orderHead struct {
	ID              string
	BuyerCompanyID  string
	Status          string
	Items           []orderItem
}

func (r *Repository) LoadOrder(ctx context.Context, orderID, sellerCompanyID string) (*orderHead, error) {
	var head orderHead
	err := r.pool.QueryRow(ctx, `
		SELECT id, "buyerCompanyId", status FROM "B2BOrder"
		WHERE id = $1 AND "sellerCompanyId" = $2
	`, orderID, sellerCompanyID).Scan(&head.ID, &head.BuyerCompanyID, &head.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOrderNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, "productVariantId", "productNameSnapshot", quantity, "mappingStatus"
		FROM "B2BOrderItem" WHERE "orderId" = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var it orderItem
		if err := rows.Scan(&it.ID, &it.ProductVariantID, &it.ProductNameSnapshot, &it.Quantity, &it.MappingStatus); err != nil {
			return nil, err
		}
		head.Items = append(head.Items, it)
	}
	return &head, rows.Err()
}

func (r *Repository) WarehouseExists(ctx context.Context, warehouseID, companyID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM "Warehouse" WHERE id = $1 AND "companyId" = $2)
	`, warehouseID, companyID).Scan(&exists)
	return exists, err
}

func (r *Repository) GetSentQtyByVariant(ctx context.Context, orderID string, tx pgx.Tx) (map[string]float64, error) {
	client := queryExec{pool: r.pool, tx: tx}
	rows, err := client.query(ctx, `
		SELECT di."productVariantId", di.quantity
		FROM "DispatchItem" di
		JOIN "Dispatch" d ON d.id = di."dispatchId"
		WHERE d."orderId" = $1 AND d.status = 'SENT'
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]float64{}
	for rows.Next() {
		var variantID string
		var qty float64
		if err := rows.Scan(&variantID, &qty); err != nil {
			return nil, err
		}
		out[variantID] += qty
	}
	return out, rows.Err()
}

func (r *Repository) FindExistingDraft(ctx context.Context, orderID, sellerCompanyID string) (*string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM "Dispatch"
		WHERE "orderId" = $1 AND "sellerCompanyId" = $2 AND status = 'DRAFT'
		ORDER BY "createdAt" DESC LIMIT 1
	`, orderID, sellerCompanyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (r *Repository) GetDispatchWithItems(ctx context.Context, dispatchID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, "dispatchNumber", "orderId", "sellerCompanyId", "buyerCompanyId",
		       "warehouseId", status, "createdBy", "sentAt", "createdAt", "updatedAt"
		FROM "Dispatch" WHERE id = $1
	`, dispatchID)
	var id, dispatchNumber, orderID, sellerID, buyerID, warehouseID, status, createdBy string
	var sentAt *time.Time
	var createdAt, updatedAt time.Time
	if err := row.Scan(&id, &dispatchNumber, &orderID, &sellerID, &buyerID, &warehouseID, &status, &createdBy, &sentAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}

	items, err := r.loadDispatchItems(ctx, dispatchID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "dispatchNumber": dispatchNumber, "orderId": orderID,
		"sellerCompanyId": sellerID, "buyerCompanyId": buyerID, "warehouseId": warehouseID,
		"status": status, "createdBy": createdBy, "sentAt": sentAt,
		"createdAt": createdAt, "updatedAt": updatedAt, "items": items,
	}, nil
}

func (r *Repository) loadDispatchItems(ctx context.Context, dispatchID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, "dispatchId", "productVariantId", "productNameSnapshot", quantity, "createdAt"
		FROM "DispatchItem" WHERE "dispatchId" = $1 ORDER BY "createdAt" ASC
	`, dispatchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, dID, variantID, name string
		var qty float64
		var createdAt time.Time
		if err := rows.Scan(&id, &dID, &variantID, &name, &qty, &createdAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "dispatchId": dID, "productVariantId": variantID,
			"productNameSnapshot": name, "quantity": qty, "createdAt": createdAt,
		})
	}
	return out, rows.Err()
}

func (r *Repository) GenerateDispatchNumber(ctx context.Context, tx pgx.Tx, companyID string) (string, error) {
	now := time.Now().UTC()
	dateStr := now.Format("20060102")
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24*time.Hour - time.Nanosecond)

	var count int
	err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "Dispatch"
		WHERE "sellerCompanyId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
	`, companyID, start, end).Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("DSP-%s-%06d", dateStr, count+1), nil
}

type createDispatchParams struct {
	OrderID, SellerCompanyID, BuyerCompanyID, WarehouseID, CreatedBy string
	Lines                                                           []dispatchLine
}

func (r *Repository) CreateDispatchTx(ctx context.Context, tx pgx.Tx, p createDispatchParams) (string, error) {
	dispatchNumber, err := r.GenerateDispatchNumber(ctx, tx, p.SellerCompanyID)
	if err != nil {
		return "", err
	}
	dispatchID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO "Dispatch" (
			id, "dispatchNumber", "orderId", "sellerCompanyId", "buyerCompanyId",
			"warehouseId", status, "createdBy", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, NOW(), NOW())
	`, dispatchID, dispatchNumber, p.OrderID, p.SellerCompanyID, p.BuyerCompanyID, p.WarehouseID, p.CreatedBy)
	if err != nil {
		return "", err
	}
	for _, line := range p.Lines {
		_, err = tx.Exec(ctx, `
			INSERT INTO "DispatchItem" (
				id, "dispatchId", "productVariantId", "productNameSnapshot", quantity, "createdAt"
			) VALUES ($1, $2, $3, $4, $5, NOW())
		`, uuid.NewString(), dispatchID, line.ProductVariantID, line.ProductNameSnapshot, line.Quantity)
		if err != nil {
			return "", err
		}
	}
	return dispatchID, nil
}

func (r *Repository) DeleteDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	_, err := tx.Exec(ctx, `DELETE FROM "DispatchItem" WHERE "dispatchId" = $1`, dispatchID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `DELETE FROM "Dispatch" WHERE id = $1`, dispatchID)
	return err
}

type dispatchHead struct {
	ID, DispatchNumber, OrderID, WarehouseID, BuyerCompanyID, SellerCompanyID, Status string
	Items                                                                            []struct {
		ProductVariantID, ProductNameSnapshot string
		Quantity                              float64
	}
}

func (r *Repository) GetDispatchHead(ctx context.Context, id, sellerCompanyID string) (*dispatchHead, error) {
	var head dispatchHead
	err := r.pool.QueryRow(ctx, `
		SELECT id, "dispatchNumber", "orderId", "warehouseId", "buyerCompanyId", "sellerCompanyId", status
		FROM "Dispatch" WHERE id = $1 AND "sellerCompanyId" = $2
	`, id, sellerCompanyID).Scan(&head.ID, &head.DispatchNumber, &head.OrderID, &head.WarehouseID, &head.BuyerCompanyID, &head.SellerCompanyID, &head.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT "productVariantId", "productNameSnapshot", quantity
		FROM "DispatchItem" WHERE "dispatchId" = $1
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var it struct {
			ProductVariantID, ProductNameSnapshot string
			Quantity                              float64
		}
		if err := rows.Scan(&it.ProductVariantID, &it.ProductNameSnapshot, &it.Quantity); err != nil {
			return nil, err
		}
		head.Items = append(head.Items, it)
	}
	return &head, rows.Err()
}

func (r *Repository) IsSent(ctx context.Context, id, sellerCompanyID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM "Dispatch" WHERE id = $1 AND "sellerCompanyId" = $2 AND status = 'SENT')
	`, id, sellerCompanyID).Scan(&exists)
	return exists, err
}

func (r *Repository) GetSellerName(ctx context.Context, companyID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `SELECT name FROM "Company" WHERE id = $1`, companyID).Scan(&name)
	return name, err
}

func (r *Repository) GetOrderItemsQty(ctx context.Context, orderID string) (map[string]float64, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT "productVariantId", quantity FROM "B2BOrderItem" WHERE "orderId" = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]float64{}
	for rows.Next() {
		var variantID *string
		var qty float64
		if err := rows.Scan(&variantID, &qty); err != nil {
			return nil, err
		}
		if variantID != nil {
			out[*variantID] = qty
		}
	}
	return out, rows.Err()
}

func (r *Repository) SendDispatchTx(ctx context.Context, tx pgx.Tx, head dispatchHead, companyID, userID string) error {
	if err := r.createGoodsReceiptTx(ctx, tx, head); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		UPDATE "Dispatch" SET status = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW() WHERE id = $1
	`, head.ID)
	if err != nil {
		return err
	}

	sentByVariant, err := r.GetSentQtyByVariant(ctx, head.OrderID, tx)
	if err != nil {
		return err
	}
	orderItems, err := r.GetOrderItemsQty(ctx, head.OrderID)
	if err != nil {
		return err
	}
	fullyDispatched := true
	for variantID, ordered := range orderItems {
		sent := sentByVariant[variantID]
		if sent < ordered {
			fullyDispatched = false
			break
		}
	}
	newStatus := "PARTIALLY_DISPATCHED"
	if fullyDispatched {
		newStatus = "DISPATCHED"
	}
	_, err = tx.Exec(ctx, `UPDATE "B2BOrder" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, newStatus, head.OrderID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'dispatch.sent', 'DISPATCH', $4, NOW())
	`, uuid.NewString(), companyID, userID, head.ID)
	return err
}

func (r *Repository) createGoodsReceiptTx(ctx context.Context, tx pgx.Tx, head dispatchHead) error {
	receiptID := uuid.NewString()
	_, err := tx.Exec(ctx, `
		INSERT INTO "GoodsReceipt" (
			id, "orderId", "dispatchId", "buyerCompanyId", "sellerCompanyId", status, "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())
	`, receiptID, head.OrderID, head.ID, head.BuyerCompanyID, head.SellerCompanyID)
	if err != nil {
		return err
	}
	for _, item := range head.Items {
		_, err = tx.Exec(ctx, `
			INSERT INTO "GoodsReceiptItem" (
				id, "receiptId", "productVariantId", "productNameSnapshot", quantity, "createdAt"
			) VALUES ($1, $2, $3, $4, $5, NOW())
		`, uuid.NewString(), receiptID, item.ProductVariantID, item.ProductNameSnapshot, item.Quantity)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CancelDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE "Dispatch" SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1
	`, dispatchID)
	return err
}

func (r *Repository) FindDraftForCancel(ctx context.Context, id, sellerCompanyID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM "Dispatch" WHERE id = $1 AND "sellerCompanyId" = $2 AND status = 'DRAFT')
	`, id, sellerCompanyID).Scan(&exists)
	return exists, err
}

func parsePageLimit(pageStr, limitStr string) (page, limit, skip int) {
	page, _ = strconv.Atoi(pageStr)
	limit, _ = strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	skip = (page - 1) * limit
	return page, limit, skip
}

func (r *Repository) FindAll(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	page, limit, skip := parsePageLimit(q["page"], q["limit"])
	status := strings.TrimSpace(strings.ToUpper(q["status"]))
	search := strings.TrimSpace(q["search"])

	where := `d."sellerCompanyId" = $1`
	args := []any{companyID}
	n := 2

	if status != "" {
		where += fmt.Sprintf(` AND d.status = $%d`, n)
		args = append(args, status)
		n++
	}
	if search != "" {
		where += fmt.Sprintf(` AND (
			d.id ILIKE $%d OR d."dispatchNumber" ILIKE $%d OR
			buyer.name ILIKE $%d OR seller.name ILIKE $%d
		)`, n, n, n, n)
		args = append(args, "%"+search+"%")
		n++
	}

	var total int
	countSQL := fmt.Sprintf(`
		SELECT COUNT(*)::int FROM "Dispatch" d
		JOIN "Company" buyer ON buyer.id = d."buyerCompanyId"
		JOIN "Company" seller ON seller.id = d."sellerCompanyId"
		WHERE %s
	`, where)
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, err
	}

	listSQL := fmt.Sprintf(`
		SELECT d.id, d."dispatchNumber", d."orderId", d."sellerCompanyId", d."buyerCompanyId",
		       d."warehouseId", d.status, d."createdBy", d."sentAt", d."createdAt", d."updatedAt",
		       buyer.name, seller.name, w.name,
		       (SELECT COUNT(*)::int FROM "DispatchItem" di WHERE di."dispatchId" = d.id)
		FROM "Dispatch" d
		JOIN "Company" buyer ON buyer.id = d."buyerCompanyId"
		JOIN "Company" seller ON seller.id = d."sellerCompanyId"
		JOIN "Warehouse" w ON w.id = d."warehouseId"
		WHERE %s
		ORDER BY d."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, n, n+1)
	args = append(args, limit, skip)

	rows, err := r.pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, dispatchNumber, orderID, sellerID, buyerID, warehouseID, status, createdBy string
		var sentAt *time.Time
		var createdAt, updatedAt time.Time
		var buyerName, sellerName, warehouseName string
		var itemCount int
		if err := rows.Scan(
			&id, &dispatchNumber, &orderID, &sellerID, &buyerID, &warehouseID, &status, &createdBy, &sentAt, &createdAt, &updatedAt,
			&buyerName, &sellerName, &warehouseName, &itemCount,
		); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": id, "dispatchNumber": dispatchNumber, "orderId": orderID,
			"sellerCompanyId": sellerID, "buyerCompanyId": buyerID, "warehouseId": warehouseID,
			"status": status, "createdBy": createdBy, "sentAt": sentAt,
			"createdAt": createdAt, "updatedAt": updatedAt,
			"buyer":     map[string]any{"name": buyerName},
			"seller":    map[string]any{"name": sellerName},
			"warehouse": map[string]any{"name": warehouseName},
			"_count":    map[string]any{"items": itemCount},
		})
	}
	if items == nil {
		items = []map[string]any{}
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}, rows.Err()
}

func (r *Repository) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT d.id, d."dispatchNumber", d."orderId", d."sellerCompanyId", d."buyerCompanyId",
		       d."warehouseId", d.status, d."createdBy", d."sentAt", d."createdAt", d."updatedAt",
		       w.id, w.name, w.address, w.status,
		       o.id, o.status, o."buyerCompanyId", o."sellerCompanyId"
		FROM "Dispatch" d
		JOIN "Warehouse" w ON w.id = d."warehouseId"
		JOIN "B2BOrder" o ON o.id = d."orderId"
		WHERE d.id = $1 AND (d."sellerCompanyId" = $2 OR d."buyerCompanyId" = $2)
	`, id, companyID)

	var dispatchID, dispatchNumber, orderID, sellerID, buyerID, warehouseID, status, createdBy string
	var sentAt *time.Time
	var createdAt, updatedAt time.Time
	var wID, wName string
	var wAddress *string
	var wStatus string
	var oID, oStatus, oBuyerID, oSellerID string

	err := row.Scan(
		&dispatchID, &dispatchNumber, &orderID, &sellerID, &buyerID, &warehouseID, &status, &createdBy, &sentAt, &createdAt, &updatedAt,
		&wID, &wName, &wAddress, &wStatus,
		&oID, &oStatus, &oBuyerID, &oSellerID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	itemRows, err := r.pool.Query(ctx, `
		SELECT di.id, di."dispatchId", di."productVariantId", di."productNameSnapshot", di.quantity, di."createdAt",
		       pv.id, pv.name, pv.sku, pv.barcode,
		       p.id, p.name, p.unit, p."imageUrl"
		FROM "DispatchItem" di
		JOIN "ProductVariant" pv ON pv.id = di."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE di."dispatchId" = $1
		ORDER BY di."createdAt" ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	items := []map[string]any{}
	for itemRows.Next() {
		var itemID, dID, variantID, name string
		var qty float64
		var itemCreated time.Time
		var pvID, pvName string
		var sku, barcode, image *string
		var pID, pName, unit string
		if err := itemRows.Scan(
			&itemID, &dID, &variantID, &name, &qty, &itemCreated,
			&pvID, &pvName, &sku, &barcode,
			&pID, &pName, &unit, &image,
		); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": itemID, "dispatchId": dID, "productVariantId": variantID,
			"productNameSnapshot": name, "quantity": qty, "createdAt": itemCreated,
			"productVariant": map[string]any{
				"id": pvID, "name": pvName, "sku": sku, "barcode": barcode,
				"product": map[string]any{"id": pID, "name": pName, "unit": unit, "imageUrl": image},
			},
		})
	}
	if err := itemRows.Err(); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": dispatchID, "dispatchNumber": dispatchNumber, "orderId": orderID,
		"sellerCompanyId": sellerID, "buyerCompanyId": buyerID, "warehouseId": warehouseID,
		"status": status, "createdBy": createdBy, "sentAt": sentAt,
		"createdAt": createdAt, "updatedAt": updatedAt,
		"warehouse": map[string]any{"id": wID, "name": wName, "address": wAddress, "status": wStatus},
		"order":     map[string]any{"id": oID, "status": oStatus, "buyerCompanyId": oBuyerID, "sellerCompanyId": oSellerID},
		"items":     items,
	}, nil
}

type queryExec struct {
	pool *pgxpool.Pool
	tx   pgx.Tx
}

func (q queryExec) query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if q.tx != nil {
		return q.tx.Query(ctx, sql, args...)
	}
	return q.pool.Query(ctx, sql, args...)
}
