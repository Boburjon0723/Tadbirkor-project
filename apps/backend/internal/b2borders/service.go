package b2borders

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	"github.com/xuri/excelize/v2"
)

const orderDetailInlineItemsMax = 80

type Service struct {
	pool         *pgxpool.Pool
	repo         *Repository
	maxLineItems int
	hub          pkgrealtime.Hub
	notify       *notifications.Service
}

func NewService(pool *pgxpool.Pool, repo *Repository, hub pkgrealtime.Hub, notify *notifications.Service) *Service {
	maxLines := 500
	if raw := strings.TrimSpace(getEnv("B2B_ORDER_MAX_LINE_ITEMS")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			if v > 2000 {
				v = 2000
			}
			maxLines = v
		}
	}
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{
		pool:         pool,
		repo:         repo,
		maxLineItems: maxLines,
		hub:          hub,
		notify:       notify,
	}
}

func (s *Service) notifyOrderAccepted(ctx context.Context, head *orderHeadRecord, sellerCompanyID, status string) {
	if s == nil || s.notify == nil {
		return
	}
	isPartial := status == "PARTIAL_ACCEPTED"
	title := "Buyurtma qabul qilindi"
	msg := fmt.Sprintf("%s buyurtmangizni qabul qildi.", head.SellerName)
	ntype := "SUCCESS"
	eventKey := "b2b.order_accepted"
	if isPartial {
		title = "Buyurtma qisman qabul qilindi"
		msg = fmt.Sprintf("%s buyurtmani qisman qabul qildi (zaxira yetarli emas).", head.SellerName)
		ntype = "WARNING"
		eventKey = "b2b.order_partial_accepted"
	}
	_ = s.notify.NotifyCompany(ctx, head.BuyerCompanyID, title, msg, ntype,
		&notifications.TelegramPayload{
			ModuleKey: "B2B", EventKey: eventKey,
			Details:     map[string]any{"orderId": head.ID, "seller": head.SellerName, "status": status},
			TargetRoles: []string{"OWNER", "MANAGER", "SALES"},
		}, "", 5*time.Minute)
	if isPartial {
		_ = s.notify.NotifyCompany(ctx, sellerCompanyID,
			"Qisman qabul — zaxira yetarli emas",
			fmt.Sprintf("%s buyurtmasi PARTIAL_ACCEPTED holatida. Qolgan miqdorni tekshiring.", head.BuyerName),
			"WARNING",
			&notifications.TelegramPayload{
				ModuleKey: "B2B", EventKey: "b2b.order_partial_accepted",
				Details:     map[string]any{"orderId": head.ID, "status": status},
				TargetRoles: []string{"WAREHOUSE", "MANAGER", "OWNER"},
			}, "", 5*time.Minute)
	}
}

func (s *Service) notifyOrderMutation(companyIDs []string, meta map[string]any) {
	if s == nil || s.hub == nil {
		return
	}
	seen := map[string]struct{}{}
	for _, id := range companyIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		s.hub.EmitOrdersChanged(id, meta)
		s.hub.EmitDashboardRefresh(id)
	}
}

func getEnv(key string) string {
	return strings.TrimSpace(strings.Trim(os.Getenv(key), `"`))
}

func normalizeCurrency(cur string) string {
	if strings.ToUpper(strings.TrimSpace(cur)) == "USD" {
		return "USD"
	}
	return "UZS"
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

type badRequestError struct{ msg string }

func (e badRequestError) Error() string { return e.msg }
func errBadRequest(msg string) error    { return badRequestError{msg: msg} }

func (s *Service) validateOrderItems(items []OrderItemInput, allowEmpty bool) ([]OrderItemInput, error) {
	if !allowEmpty && len(items) == 0 {
		return nil, errBadRequest("Kamida bitta mahsulot kerak")
	}
	if len(items) > s.maxLineItems {
		return nil, errBadRequest(fmt.Sprintf("Bitta buyurtmada %d tadan ortiq mahsulot qo'shib bo'lmaydi", s.maxLineItems))
	}

	out := make([]OrderItemInput, 0, len(items))
	currencies := map[string]struct{}{}
	for _, item := range items {
		name := strings.TrimSpace(item.ProductName)
		if name == "" {
			return nil, errBadRequest("Mahsulot nomi bo'sh bo'lmasligi kerak")
		}
		if item.Quantity <= 0 {
			return nil, errBadRequest("Miqdor 0 dan katta bo'lishi kerak")
		}
		cur := normalizeCurrency(item.ExpectedCurrency)
		currencies[cur] = struct{}{}
		if len(currencies) > 1 {
			return nil, errBadRequest("Bitta buyurtmadagi barcha mahsulotlar bir xil valyutada bo'lishi kerak")
		}
		clone := item
		clone.ProductName = name
		clone.ExpectedCurrency = cur
		clone.ProductVariantID = trimPtr(item.ProductVariantID)
		out = append(out, clone)
	}
	return out, nil
}

func parseDatePtr(v *string) (*time.Time, error) {
	v = trimPtr(v)
	if v == nil {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *v)
	if err == nil {
		return &t, nil
	}
	t2, err2 := time.Parse("2006-01-02", *v)
	if err2 == nil {
		return &t2, nil
	}
	return nil, errBadRequest("expectedDeliveryDate noto'g'ri formatda")
}

func (s *Service) CreateOrder(ctx context.Context, companyID, userID string, input CreateOrderInput) (map[string]any, error) {
	sellerCompanyID := strings.TrimSpace(input.SellerCompanyID)
	if sellerCompanyID == "" {
		return nil, errBadRequest("sellerCompanyId majburiy")
	}
	if _, err := s.repo.EnsureActivePartner(ctx, companyID, sellerCompanyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	items, err := s.validateOrderItems(input.Items, false)
	if err != nil {
		return nil, err
	}
	expectedDeliveryDate, err := parseDatePtr(input.ExpectedDeliveryDate)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	orderID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO "B2BOrder" (
			id, "buyerCompanyId", "sellerCompanyId", status, "expectedDeliveryDate",
			note, "createdBy", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, NOW(), NOW())
	`, orderID, companyID, sellerCompanyID, expectedDeliveryDate, trimPtr(input.Note), userID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		mappingStatus := "PENDING"
		if item.ProductVariantID != nil {
			mappingStatus = "MAPPED"
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO "B2BOrderItem" (
				id, "orderId", "productVariantId", "productNameSnapshot", quantity,
				"expectedPrice", "expectedCurrency", "mappingStatus"
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), orderID, item.ProductVariantID, item.ProductName, item.Quantity, item.ExpectedPrice, item.ExpectedCurrency, mappingStatus)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{companyID, sellerCompanyID}, map[string]any{"orderId": orderID, "reason": "created"})
	return s.FindOne(ctx, orderID, companyID)
}

func (s *Service) UpdateDraftOrder(ctx context.Context, id, companyID string, input UpdateDraftOrderInput) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor buyurtmani tahrirlashi mumkin")
	}
	if head.Status != "DRAFT" {
		return nil, errBadRequest("Faqat DRAFT holatidagi buyurtmani tahrirlash mumkin")
	}
	items, err := s.validateOrderItems(input.Items, false)
	if err != nil {
		return nil, err
	}
	expectedDeliveryDate, err := parseDatePtr(input.ExpectedDeliveryDate)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM "B2BOrderItem" WHERE "orderId" = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE "B2BOrder"
		SET "expectedDeliveryDate" = $2, note = $3, "updatedAt" = NOW()
		WHERE id = $1
	`, id, expectedDeliveryDate, trimPtr(input.Note))
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		mappingStatus := "PENDING"
		if item.ProductVariantID != nil {
			mappingStatus = "MAPPED"
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO "B2BOrderItem" (
				id, "orderId", "productVariantId", "productNameSnapshot", quantity,
				"expectedPrice", "expectedCurrency", "mappingStatus"
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), id, item.ProductVariantID, item.ProductName, item.Quantity, item.ExpectedPrice, item.ExpectedCurrency, mappingStatus)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{companyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "updated"})
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	itemCount, err := s.repo.CountOrderItems(ctx, head.ID)
	if err != nil {
		return nil, err
	}
	inlineItems := itemCount <= orderDetailInlineItemsMax
	items := make([]map[string]any, 0)
	if inlineItems {
		rows, err := s.repo.ListOrderItems(ctx, head.ID)
		if err != nil {
			return nil, err
		}
		items = mapOrderItems(rows)
	}

	result := map[string]any{
		"id":                   head.ID,
		"buyerCompanyId":       head.BuyerCompanyID,
		"sellerCompanyId":      head.SellerCompanyID,
		"status":               head.Status,
		"expectedDeliveryDate": head.ExpectedDeliveryDate,
		"note":                 head.Note,
		"createdBy":            head.CreatedBy,
		"createdAt":            head.CreatedAt,
		"updatedAt":            head.UpdatedAt,
		"buyer": map[string]any{
			"id":      head.BuyerCompanyID,
			"name":    head.BuyerName,
			"tin":     head.BuyerTin,
			"phone":   head.BuyerPhone,
			"address": head.BuyerAddress,
		},
		"seller": map[string]any{
			"id":      head.SellerCompanyID,
			"name":    head.SellerName,
			"tin":     head.SellerTin,
			"phone":   head.SellerPhone,
			"address": head.SellerAddress,
		},
		"_count":         map[string]any{"items": itemCount},
		"itemCount":      itemCount,
		"items":          items,
		"itemsPaginated": !inlineItems,
		"maxLineItems":   s.maxLineItems,
	}
	if !inlineItems {
		var unmappedCount int
		if err := s.pool.QueryRow(ctx, `
			SELECT COUNT(*)::int
			FROM "B2BOrderItem"
			WHERE "orderId" = $1 AND (COALESCE("mappingStatus", 'PENDING') <> 'MAPPED' OR "productVariantId" IS NULL)
		`, head.ID).Scan(&unmappedCount); err != nil {
			return nil, err
		}
		result["unmappedItemCount"] = unmappedCount
		result["amountSummary"] = s.computeOrderAmountSummary(ctx, head.ID)
	}
	orders, err := s.attachDispatchSummaries(ctx, []map[string]any{result})
	if err != nil {
		return nil, err
	}
	return orders[0], nil
}

func (s *Service) computeOrderAmountSummary(ctx context.Context, orderID string) map[string]any {
	rows, err := s.pool.Query(ctx, `
		SELECT quantity, COALESCE("expectedPrice", 0)::float8, COALESCE("expectedCurrency", 'UZS')
		FROM "B2BOrderItem"
		WHERE "orderId" = $1
	`, orderID)
	if err != nil {
		return map[string]any{"lineCount": 0, "byCurrency": map[string]float64{"UZS": 0, "USD": 0}}
	}
	defer rows.Close()
	byCurrency := map[string]float64{"UZS": 0, "USD": 0}
	count := 0
	for rows.Next() {
		var qty, price float64
		var cur string
		if err := rows.Scan(&qty, &price, &cur); err != nil {
			continue
		}
		byCurrency[normalizeCurrency(cur)] += qty * price
		count++
	}
	return map[string]any{"lineCount": count, "byCurrency": byCurrency}
}

func mapOrderItems(rows []orderItemRecord) []map[string]any {
	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		item := map[string]any{
			"id":                  row.ID,
			"orderId":             row.OrderID,
			"quantity":            row.Quantity,
			"expectedPrice":       row.ExpectedPrice,
			"expectedCurrency":    normalizeCurrency(row.ExpectedCurrency),
			"productNameSnapshot": row.ProductNameSnapshot,
			"productVariantId":    row.ProductVariantID,
			"mappingStatus":       row.MappingStatus,
		}
		if row.ProductName != nil || row.VariantName != nil {
			item["productVariant"] = map[string]any{
				"id":      row.ProductVariantID,
				"name":    row.VariantName,
				"sku":     row.VariantSKU,
				"barcode": row.VariantBarcode,
				"product": map[string]any{
					"name": row.ProductName,
				},
			}
		}
		out = append(out, item)
	}
	return out
}

func wantsFullList(query map[string]string) bool {
	all := strings.ToLower(strings.TrimSpace(query["all"]))
	full := strings.ToLower(strings.TrimSpace(query["full"]))
	return all == "1" || all == "true" || full == "1" || full == "true"
}

func parsePageLimit(query map[string]string, defaultLimit, maxLimit int) (int, int, int) {
	page, _ := strconv.Atoi(strings.TrimSpace(query["page"]))
	limit, _ := strconv.Atoi(strings.TrimSpace(query["limit"]))
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit, (page - 1) * limit
}

func (s *Service) FindAll(ctx context.Context, companyID, role string, query map[string]string) (map[string]any, error) {
	role = strings.ToUpper(strings.TrimSpace(role))
	search := strings.TrimSpace(query["search"])
	status := strings.TrimSpace(strings.ToUpper(query["status"]))
	full := wantsFullList(query)

	baseWhere := ""
	args := []any{companyID}
	if role == "SELLER" {
		if status != "" {
			baseWhere = `o."sellerCompanyId" = $1 AND o.status = $2`
			args = append(args, status)
		} else {
			baseWhere = `o."sellerCompanyId" = $1 AND o.status <> 'DRAFT'`
		}
	} else {
		baseWhere = `o."buyerCompanyId" = $1`
		if status != "" {
			baseWhere += ` AND o.status = $2`
			args = append(args, status)
		}
	}

	n := len(args) + 1
	if search != "" {
		baseWhere += fmt.Sprintf(` AND (o.id ILIKE $%d OR b.name ILIKE $%d OR s.name ILIKE $%d)`, n, n, n)
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" s ON s.id = o."sellerCompanyId"
		WHERE `+baseWhere, args...).Scan(&total); err != nil {
		return nil, err
	}

	sql := `
		SELECT o.id, o."buyerCompanyId", o."sellerCompanyId", o.status, o."expectedDeliveryDate", o.note,
		       o."createdBy", o."createdAt", o."updatedAt",
		       b.name, b.tin, s.name, s.tin,
		       (SELECT COUNT(*)::int FROM "B2BOrderItem" i WHERE i."orderId" = o.id) AS item_count
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" s ON s.id = o."sellerCompanyId"
		WHERE ` + baseWhere + `
		ORDER BY o."createdAt" DESC
	`

	page, limit, skip := parsePageLimit(query, 30, 100)
	if !full {
		sql += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
		args = append(args, limit, skip)
	}
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, buyerCompanyID, sellerCompanyID, orderStatus, createdBy, buyerName, sellerName string
		var expectedDeliveryDate *time.Time
		var note *string
		var createdAt, updatedAt time.Time
		var buyerTin, sellerTin *string
		var itemCount int
		if err := rows.Scan(
			&id, &buyerCompanyID, &sellerCompanyID, &orderStatus, &expectedDeliveryDate, &note,
			&createdBy, &createdAt, &updatedAt,
			&buyerName, &buyerTin, &sellerName, &sellerTin,
			&itemCount,
		); err != nil {
			return nil, err
		}
		itemRows, err := s.repo.ListOrderItems(ctx, id)
		if err != nil {
			return nil, err
		}
		mappedItems := mapOrderItems(itemRows)
		displayCurrency := "UZS"
		for _, line := range mappedItems {
			if c, ok := line["expectedCurrency"].(string); ok && c != "" {
				displayCurrency = normalizeCurrency(c)
				break
			}
		}
		items = append(items, map[string]any{
			"id":                   id,
			"buyerCompanyId":       buyerCompanyID,
			"sellerCompanyId":      sellerCompanyID,
			"status":               orderStatus,
			"expectedDeliveryDate": expectedDeliveryDate,
			"note":                 note,
			"createdBy":            createdBy,
			"createdAt":            createdAt,
			"updatedAt":            updatedAt,
			"buyer":                map[string]any{"name": buyerName, "tin": buyerTin},
			"seller":               map[string]any{"name": sellerName, "tin": sellerTin},
			"_count":               map[string]any{"items": itemCount},
			"items":                mappedItems,
			"displayCurrency":      displayCurrency,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	items, err = s.attachDispatchSummaries(ctx, items)
	if err != nil {
		return nil, err
	}
	if full {
		return map[string]any{
			"items": items,
			"total": total,
		}, nil
	}
	return map[string]any{
		"items":   items,
		"page":    page,
		"limit":   limit,
		"total":   total,
		"hasMore": skip+len(items) < total,
	}, nil
}

func (s *Service) GetListStats(ctx context.Context, companyID, role string) (map[string]any, error) {
	role = strings.ToUpper(strings.TrimSpace(role))
	baseWhere := ""
	args := []any{companyID}
	if role == "SELLER" {
		baseWhere = `"sellerCompanyId" = $1 AND status <> 'DRAFT'`
	} else {
		baseWhere = `"buyerCompanyId" = $1`
	}

	rows, err := s.pool.Query(ctx, `
		SELECT status, COUNT(*)::int
		FROM "B2BOrder"
		WHERE `+baseWhere+`
		GROUP BY status
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byStatus := map[string]int{}
	for rows.Next() {
		var st string
		var cnt int
		if err := rows.Scan(&st, &cnt); err != nil {
			return nil, err
		}
		byStatus[st] = cnt
	}

	mappingNeeded := 0
	if role == "SELLER" {
		_ = s.pool.QueryRow(ctx, `
			SELECT COUNT(*)::int
			FROM "B2BOrder" o
			WHERE o."sellerCompanyId" = $1
			  AND o.status <> 'DRAFT'
			  AND EXISTS (
			    SELECT 1
			    FROM "B2BOrderItem" i
			    WHERE i."orderId" = o.id
			      AND COALESCE(i."mappingStatus", 'PENDING') <> 'MAPPED'
			      AND i."productVariantId" IS NULL
			  )
		`, companyID).Scan(&mappingNeeded)
	}
	return map[string]any{
		"sent":          byStatus["SENT"],
		"accepted":      byStatus["ACCEPTED"],
		"inProgress":    byStatus["IN_PROGRESS"],
		"completed":     byStatus["COMPLETED"],
		"rejected":      byStatus["REJECTED"],
		"cancelled":     byStatus["CANCELLED"],
		"mappingNeeded": mappingNeeded,
	}, nil
}

func (s *Service) GetOrdersHubStats(ctx context.Context, companyID string) (map[string]any, error) {
	my, err := s.GetListStats(ctx, companyID, "BUYER")
	if err != nil {
		return nil, err
	}
	incoming, err := s.GetListStats(ctx, companyID, "SELLER")
	if err != nil {
		return nil, err
	}
	return map[string]any{"my": my, "incoming": incoming}, nil
}

func parseBool(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "1" || v == "true" || v == "yes"
}

func (s *Service) FindOrderItemsPage(ctx context.Context, id, companyID string, query map[string]string) (map[string]any, error) {
	if _, err := s.repo.FindOrderHead(ctx, id, companyID); err != nil {
		return nil, err
	}
	page, limit, skip := parsePageLimit(query, 50, 100)
	search := strings.TrimSpace(query["search"])
	unmappedOnly := parseBool(query["unmappedOnly"])

	where := `"orderId" = $1`
	args := []any{id}
	if unmappedOnly {
		where += ` AND (COALESCE("mappingStatus", 'PENDING') <> 'MAPPED' AND "productVariantId" IS NULL)`
	}
	if search != "" {
		where += fmt.Sprintf(` AND "productNameSnapshot" ILIKE $%d`, len(args)+1)
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "B2BOrderItem" WHERE `+where, args...).Scan(&total); err != nil {
		return nil, err
	}
	sql := fmt.Sprintf(`
		SELECT i.id, i."orderId", i.quantity, COALESCE(i."expectedPrice", 0)::float8,
		       COALESCE(i."expectedCurrency", 'UZS'), i."productNameSnapshot", i."productVariantId",
		       COALESCE(i."mappingStatus", 'PENDING'),
		       pv.name, pv.sku, pv.barcode, p.name
		FROM "B2BOrderItem" i
		LEFT JOIN "ProductVariant" pv ON pv.id = i."productVariantId"
		LEFT JOIN "Product" p ON p.id = pv."productId"
		WHERE %s
		ORDER BY i.id ASC
		LIMIT $%d OFFSET $%d
	`, where, len(args)+1, len(args)+2)
	args = append(args, limit, skip)

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]orderItemRecord, 0)
	for rows.Next() {
		var row orderItemRecord
		if err := rows.Scan(
			&row.ID, &row.OrderID, &row.Quantity, &row.ExpectedPrice, &row.ExpectedCurrency,
			&row.ProductNameSnapshot, &row.ProductVariantID, &row.MappingStatus,
			&row.VariantName, &row.VariantSKU, &row.VariantBarcode, &row.ProductName,
		); err != nil {
			return nil, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	mapped := mapOrderItems(items)
	return map[string]any{
		"items":        mapped,
		"page":         page,
		"limit":        limit,
		"total":        total,
		"hasMore":      skip+len(mapped) < total,
		"maxLineItems": s.maxLineItems,
	}, nil
}

func (s *Service) resolveMappingsAndUpdateTx(ctx context.Context, tx pgx.Tx, sellerCompanyID, buyerCompanyID, orderID string, items []orderItemRecord) error {
	rows, err := tx.Query(ctx, `
		SELECT "partnerProductName", "ownProductVariantId"
		FROM "ProductMapping"
		WHERE "companyId" = $1
		  AND "partnerCompanyId" = $2
		  AND status = 'ACTIVE'
	`, sellerCompanyID, buyerCompanyID)
	if err != nil {
		return err
	}
	defer rows.Close()
	byName := map[string]string{}
	for rows.Next() {
		var name, variantID string
		if err := rows.Scan(&name, &variantID); err != nil {
			return err
		}
		byName[strings.ToLower(strings.TrimSpace(name))] = variantID
	}
	if err := rows.Err(); err != nil {
		return err
	}

	variantSet := map[string]struct{}{}
	for _, item := range items {
		if item.ProductVariantID != nil {
			variantSet[*item.ProductVariantID] = struct{}{}
		}
	}
	activeSet := map[string]struct{}{}
	if len(variantSet) > 0 {
		variantIDs := make([]string, 0, len(variantSet))
		for v := range variantSet {
			variantIDs = append(variantIDs, v)
		}
		activeRows, err := tx.Query(ctx, `
			SELECT id
			FROM "ProductVariant"
			WHERE id = ANY($1) AND "companyId" = $2 AND status = 'ACTIVE'
		`, variantIDs, sellerCompanyID)
		if err != nil {
			return err
		}
		for activeRows.Next() {
			var id string
			if err := activeRows.Scan(&id); err != nil {
				activeRows.Close()
				return err
			}
			activeSet[id] = struct{}{}
		}
		activeRows.Close()
	}

	for _, item := range items {
		key := strings.ToLower(strings.TrimSpace(item.ProductNameSnapshot))
		if mappedVariant, ok := byName[key]; ok {
			_, err := tx.Exec(ctx, `
				UPDATE "B2BOrderItem"
				SET "productVariantId" = $2, "mappingStatus" = 'MAPPED'
				WHERE id = $1
			`, item.ID, mappedVariant)
			if err != nil {
				return err
			}
			continue
		}
		if item.ProductVariantID != nil {
			if _, ok := activeSet[*item.ProductVariantID]; ok {
				_, err := tx.Exec(ctx, `
					UPDATE "B2BOrderItem"
					SET "mappingStatus" = 'MAPPED'
					WHERE id = $1
				`, item.ID)
				if err != nil {
					return err
				}
				continue
			}
		}
		_, err := tx.Exec(ctx, `
			UPDATE "B2BOrderItem"
			SET "productVariantId" = NULL, "mappingStatus" = 'REQUIRED'
			WHERE id = $1
		`, item.ID)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `UPDATE "B2BOrder" SET "updatedAt" = NOW() WHERE id = $1`, orderID)
	return err
}

func (s *Service) SendOrder(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor buyurtmani yubora oladi")
	}
	if head.Status != "DRAFT" {
		return nil, errBadRequest("Faqat DRAFT holatidagi buyurtmani yuborish mumkin")
	}
	items, err := s.repo.ListOrderItems(ctx, id)
	if err != nil {
		return nil, err
	}
	allCatalogLines := true
	for _, item := range items {
		if item.ProductVariantID == nil {
			allCatalogLines = false
			break
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if !allCatalogLines {
		if err := s.resolveMappingsAndUpdateTx(ctx, tx, head.SellerCompanyID, head.BuyerCompanyID, id, items); err != nil {
			return nil, err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE "B2BOrder" SET status = 'SENT', "updatedAt" = NOW() WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.sent', 'B2B_ORDER', $4, NOW())
	`, uuid.NewString(), companyID, userID, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "sent"})
	if s.notify != nil {
		_ = s.notify.NotifyCompany(ctx, head.SellerCompanyID,
			"Yangi buyurtma",
			fmt.Sprintf("%s kompaniyasidan yangi buyurtma keldi.", head.BuyerName),
			"INFO",
			&notifications.TelegramPayload{
				ModuleKey: "B2B", EventKey: "b2b.order_sent",
				Details: map[string]any{"orderId": id, "buyer": head.BuyerName, "status": "SENT"},
				TargetRoles: []string{"OWNER", "MANAGER", "SALES"},
				Actions: []notifications.TelegramAction{
					{Key: "ORDER_ACCEPT", Label: "Qabul qilish", TargetType: "B2B_ORDER", TargetID: id},
					{Key: "ORDER_REJECT", Label: "Bekor qilish", TargetType: "B2B_ORDER", TargetID: id},
				},
			}, "", 5*time.Minute)
	}
	return map[string]any{"success": true, "id": id, "status": "SENT"}, nil
}

func (s *Service) AcceptOrder(ctx context.Context, id, companyID, userID string, input AcceptOrderInput) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.SellerCompanyID != companyID {
		return nil, errBadRequest("Faqat sotuvchi buyurtmani qabul qila oladi")
	}
	forbidden := map[string]struct{}{
		"REJECTED": {}, "CANCELLED": {}, "COMPLETED": {}, "DISPATCHED": {}, "ACCEPTED": {}, "PARTIAL_ACCEPTED": {},
	}
	if _, bad := forbidden[head.Status]; bad {
		return nil, errBadRequest(fmt.Sprintf("Ushbu holatdagi buyurtmani qabul qilib bo'lmaydi: %s", head.Status))
	}
	items, err := s.repo.ListOrderItems(ctx, id)
	if err != nil {
		return nil, err
	}
	allCatalogLines := true
	for _, item := range items {
		if item.ProductVariantID == nil {
			allCatalogLines = false
			break
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if !allCatalogLines {
		if err := s.resolveMappingsAndUpdateTx(ctx, tx, companyID, head.BuyerCompanyID, id, items); err != nil {
			return nil, err
		}
	}

	freshItemsRows, err := tx.Query(ctx, `
		SELECT id, "orderId", quantity, COALESCE("expectedPrice", 0)::float8,
		       COALESCE("expectedCurrency", 'UZS'), "productNameSnapshot", "productVariantId",
		       COALESCE("mappingStatus", 'PENDING')
		FROM "B2BOrderItem"
		WHERE "orderId" = $1
	`, id)
	if err != nil {
		return nil, err
	}
	freshItems := make([]orderItemRecord, 0)
	for freshItemsRows.Next() {
		var row orderItemRecord
		if err := freshItemsRows.Scan(
			&row.ID, &row.OrderID, &row.Quantity, &row.ExpectedPrice, &row.ExpectedCurrency,
			&row.ProductNameSnapshot, &row.ProductVariantID, &row.MappingStatus,
		); err != nil {
			freshItemsRows.Close()
			return nil, err
		}
		freshItems = append(freshItems, row)
	}
	freshItemsRows.Close()

	reservationLines := make([]stock.FulfillmentLine, 0)
	for _, line := range freshItems {
		if line.ProductVariantID != nil && line.MappingStatus == "MAPPED" {
			reservationLines = append(reservationLines, stock.FulfillmentLine{
				ProductVariantID: *line.ProductVariantID,
				Quantity:         line.Quantity,
			})
		}
	}

	nextStatus := "ACCEPTED"
	if len(reservationLines) > 0 {
		warehouseID, err := stock.ResolveWarehouseForOrder(ctx, stock.TxQueryRower(tx), companyID, reservationLines)
		if err != nil {
			return nil, err
		}
		if warehouseID == "" {
			return nil, errBadRequest("ATP: faol ombor topilmadi yoki mahsulot qoldiqlari mavjud emas")
		}

		reservationItems := make([]stock.ReservationItem, 0, len(reservationLines))
		for _, line := range reservationLines {
			reservationItems = append(reservationItems, stock.ReservationItem{
				ProductVariantID: line.ProductVariantID,
				WarehouseID:      warehouseID,
				Quantity:         line.Quantity,
			})
		}

		if input.AllowPartial {
			partial, err := stock.CreatePartialReservationTx(ctx, tx, id, companyID, reservationItems)
			if err != nil {
				return nil, err
			}
			if !partial.Success {
				reasons := make([]string, 0, len(partial.FailedItems))
				for _, f := range partial.FailedItems {
					reasons = append(reasons, f.Reason)
				}
				return nil, errBadRequest("ATP: hech qanday rezerv qo'yib bo'lmadi — " + strings.Join(reasons, "; "))
			}
			if !partial.IsFull {
				nextStatus = "PARTIAL_ACCEPTED"
			}
		} else {
			if err := stock.AssertCanFulfillOrderTx(ctx, tx, companyID, warehouseID, reservationLines); err != nil {
				return nil, errBadRequest(err.Error())
			}
			reservation, err := stock.CreateReservationTx(ctx, tx, id, companyID, reservationItems)
			if err != nil {
				return nil, err
			}
			if !reservation.Success {
				return nil, errBadRequest("ATP rezerv yaratib bo'lmadi: " + stock.FormatReservationFailures(reservation))
			}
		}
	}

	_, err = tx.Exec(ctx, `UPDATE "B2BOrder" SET status = $2, "updatedAt" = NOW() WHERE id = $1`, id, nextStatus)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.accepted', 'B2B_ORDER', $4, NOW())
	`, uuid.NewString(), companyID, userID, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "accepted"})
	s.notifyOrderAccepted(ctx, head, companyID, nextStatus)
	return map[string]any{"success": true, "id": id, "status": nextStatus}, nil
}

func (s *Service) RejectOrder(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.SellerCompanyID != companyID {
		return nil, errBadRequest("Faqat sotuvchi buyurtmani rad eta oladi")
	}
	forbidden := map[string]struct{}{"DRAFT": {}, "COMPLETED": {}, "DISPATCHED": {}, "CANCELLED": {}, "REJECTED": {}}
	if _, bad := forbidden[head.Status]; bad {
		return nil, errBadRequest(fmt.Sprintf("Ushbu holatdagi buyurtmani rad etib bo'lmaydi: %s", head.Status))
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE "B2BOrder" SET status = 'REJECTED', "updatedAt" = NOW() WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if err := stock.ReleaseReservationTx(ctx, tx, id, "RELEASED"); err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.rejected', 'B2B_ORDER', $4, NOW())
	`, uuid.NewString(), companyID, userID, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "rejected"})
	if s.notify != nil {
		_ = s.notify.NotifyCompany(ctx, head.BuyerCompanyID,
			"Buyurtma rad etildi",
			fmt.Sprintf("%s buyurtmangizni rad etdi.", head.SellerName),
			"ERROR",
			&notifications.TelegramPayload{
				ModuleKey: "B2B", EventKey: "b2b.order_rejected",
				Details: map[string]any{"orderId": id, "seller": head.SellerName, "status": "REJECTED"},
				TargetRoles: []string{"OWNER", "MANAGER", "SALES"},
			}, "", 5*time.Minute)
	}
	return map[string]any{"success": true, "id": id, "status": "REJECTED"}, nil
}

func (s *Service) MapIncomingOrderItem(
	ctx context.Context,
	orderID, itemID, companyID, userID string,
	input MapIncomingOrderItemInput,
) (map[string]any, error) {
	head, err := s.repo.FindOrderHeadForSeller(ctx, orderID, companyID)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListOrderItems(ctx, orderID)
	if err != nil {
		return nil, err
	}
	var target *orderItemRecord
	for i := range items {
		if items[i].ID == itemID {
			target = &items[i]
			break
		}
	}
	if target == nil {
		return nil, errBadRequest("Buyurtma mahsuloti topilmadi")
	}
	var ownPrice float64
	var ownCurrency string
	err = s.pool.QueryRow(ctx, `
		SELECT COALESCE("salePrice", 0)::float8, COALESCE(currency, 'UZS')
		FROM "ProductVariant"
		WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, input.OwnProductVariantID, companyID).Scan(&ownPrice, &ownCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errBadRequest("Tanlangan mahsulot varianti topilmadi")
	}
	if err != nil {
		return nil, err
	}
	price := ownPrice
	if input.SellerPrice != nil {
		price = *input.SellerPrice
	}
	if price <= 0 {
		return nil, errBadRequest("Narx 0 dan katta bo'lishi kerak")
	}
	currency := normalizeCurrency(ownCurrency)
	if input.SellerCurrency != nil {
		currency = normalizeCurrency(*input.SellerCurrency)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var existingID string
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM "ProductMapping"
		WHERE "companyId" = $1
		  AND "partnerCompanyId" = $2
		  AND "partnerProductName" = $3
		  AND "partnerSku" IS NULL
		LIMIT 1
	`, companyID, head.BuyerCompanyID, target.ProductNameSnapshot).Scan(&existingID)
	if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE "ProductMapping"
			SET "ownProductVariantId" = $2, status = 'ACTIVE', "updatedAt" = NOW()
			WHERE id = $1
		`, existingID, input.OwnProductVariantID)
		if err != nil {
			return nil, err
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		_, err = tx.Exec(ctx, `
			INSERT INTO "ProductMapping" (
				id, "companyId", "partnerCompanyId", "partnerProductName",
				"ownProductVariantId", status, "createdBy", "createdAt", "updatedAt"
			) VALUES (
				$1, $2, $3, $4, $5, 'ACTIVE', $6, NOW(), NOW()
			)
		`, uuid.NewString(), companyID, head.BuyerCompanyID, target.ProductNameSnapshot, input.OwnProductVariantID, userID)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE "B2BOrderItem"
		SET "productVariantId" = $2,
		    "expectedPrice" = $3,
		    "expectedCurrency" = $4,
		    "mappingStatus" = 'MAPPED'
		WHERE id = $1
	`, itemID, input.OwnProductVariantID, price, currency)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.item_mapped', 'B2B_ORDER_ITEM', $4, NOW())
	`, uuid.NewString(), companyID, userID, itemID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) closeRemainder(ctx context.Context, id, companyID, userID string, fromIncoming bool) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	closable := map[string]struct{}{"PARTIALLY_DISPATCHED": {}, "DISPATCHED": {}, "RECEIVED": {}}
	if _, ok := closable[head.Status]; !ok {
		return nil, errBadRequest("Ushbu buyurtma uchun qolgan qismni yopib bo'lmaydi")
	}
	isBuyer := head.BuyerCompanyID == companyID
	isSeller := head.SellerCompanyID == companyID
	if !isBuyer && !isSeller {
		return nil, errBadRequest("Ruxsat yo'q")
	}

	items, err := s.repo.ListOrderItems(ctx, id)
	if err != nil {
		return nil, err
	}
	sentQty := map[string]float64{}
	rows, err := s.pool.Query(ctx, `
		SELECT di."productVariantId", COALESCE(SUM(di.quantity), 0)::float8
		FROM "DispatchItem" di
		JOIN "Dispatch" d ON d.id = di."dispatchId"
		WHERE d."orderId" = $1 AND d.status = 'SENT'
		GROUP BY di."productVariantId"
	`, id)
	if err == nil {
		for rows.Next() {
			var variantID string
			var qty float64
			if scanErr := rows.Scan(&variantID, &qty); scanErr == nil {
				sentQty[variantID] = qty
			}
		}
		rows.Close()
	}
	hasRemaining := false
	for _, item := range items {
		if item.ProductVariantID == nil {
			continue
		}
		if item.Quantity-sentQty[*item.ProductVariantID] > 0 {
			hasRemaining = true
			break
		}
	}
	if !hasRemaining {
		return nil, errBadRequest("Qolgan jo'natiladigan miqdor yo'q")
	}

	action := "order.remainder_closed_seller"
	if isBuyer {
		action = "order.remainder_declined_buyer"
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE "B2BOrder" SET status = 'DISPATCHED', "updatedAt" = NOW() WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, $4, 'B2B_ORDER', $5, NOW())
	`, uuid.NewString(), companyID, userID, action, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "remainder_closed"})
	return map[string]any{"success": true}, nil
}

func (s *Service) CloseUndispatchedRemainder(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	return s.closeRemainder(ctx, id, companyID, userID, false)
}

func (s *Service) CancelOrder(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor buyurtmani bekor qila oladi")
	}
	forbidden := map[string]struct{}{"DISPATCHED": {}, "RECEIVED": {}, "COMPLETED": {}}
	if _, bad := forbidden[head.Status]; bad {
		return nil, errBadRequest("Ushbu holatdagi buyurtmani bekor qilib bo'lmaydi")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE "B2BOrder" SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if err := stock.ReleaseReservationTx(ctx, tx, id, "RELEASED"); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.cancelled', 'B2B_ORDER', $4, NOW())
	`, uuid.NewString(), companyID, userID, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "cancelled"})
	return map[string]any{"success": true, "id": id, "status": "CANCELLED"}, nil
}

func (s *Service) DeleteOrder(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor buyurtmani o'chira oladi")
	}
	allowed := map[string]struct{}{"DRAFT": {}, "CANCELLED": {}, "REJECTED": {}}
	if _, ok := allowed[head.Status]; !ok {
		return nil, errBadRequest("Faqat DRAFT, CANCELLED yoki REJECTED buyurtmani o'chirish mumkin")
	}
	var dispatchCount, receiptCount, invoiceCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Dispatch" WHERE "orderId" = $1`, id).Scan(&dispatchCount); err != nil {
		return nil, err
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "GoodsReceipt" WHERE "orderId" = $1`, id).Scan(&receiptCount); err != nil {
		return nil, err
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Invoice" WHERE "orderId" = $1`, id).Scan(&invoiceCount); err != nil {
		return nil, err
	}
	if dispatchCount > 0 || receiptCount > 0 || invoiceCount > 0 {
		return nil, errBadRequest("Buyurtmaga bog'liq hujjatlar bor, o'chirib bo'lmaydi")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM "B2BOrderItem" WHERE "orderId" = $1`, id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM "B2BOrder" WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "createdAt")
		VALUES ($1, $2, $3, 'order.deleted', 'B2B_ORDER', $4, NOW())
	`, uuid.NewString(), companyID, userID, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.notifyOrderMutation([]string{head.BuyerCompanyID, head.SellerCompanyID}, map[string]any{"orderId": id, "reason": "deleted"})
	return map[string]any{"success": true}, nil
}

func (s *Service) GetSellerPriceSuggestion(ctx context.Context, buyerCompanyID, sellerCompanyID, productName string) (map[string]any, error) {
	if strings.TrimSpace(sellerCompanyID) == "" || strings.TrimSpace(productName) == "" {
		return nil, nil
	}
	if _, err := s.repo.EnsureActivePartner(ctx, buyerCompanyID, sellerCompanyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	trySearch := func(where string, args ...any) (map[string]any, error) {
		row := s.pool.QueryRow(ctx, `
			SELECT pv.id, p.name, pv.name, COALESCE(pv."salePrice", 0)::float8, COALESCE(pv.currency, 'UZS')
			FROM "ProductVariant" pv
			JOIN "Product" p ON p.id = pv."productId"
			WHERE `+where+`
			ORDER BY pv."updatedAt" DESC
			LIMIT 1
		`, args...)
		var variantID, pName, vName, currency string
		var price float64
		if err := row.Scan(&variantID, &pName, &vName, &price, &currency); errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else if err != nil {
			return nil, err
		}
		return map[string]any{
			"productVariantId": variantID,
			"productName":      pName,
			"variantName":      vName,
			"expectedPrice":    price,
			"expectedCurrency": normalizeCurrency(currency),
			"price":            price,
		}, nil
	}
	query := strings.TrimSpace(productName)
	res, err := trySearch(`
		pv."companyId" = $1
		AND pv.status = 'ACTIVE'
		AND (
			LOWER(p.name) = LOWER($2)
			OR p.name ILIKE $3
			OR pv.name ILIKE $3
			OR LOWER(COALESCE(pv.sku, '')) = LOWER($2)
		)
	`, sellerCompanyID, query, "%"+query+"%")
	if err != nil || res != nil {
		return res, err
	}

	parts := strings.Split(query, "-")
	if len(parts) >= 2 {
		productPart := strings.TrimSpace(parts[0])
		variantPart := strings.TrimSpace(parts[1])
		res, err = trySearch(`
			pv."companyId" = $1
			AND pv.status = 'ACTIVE'
			AND p.name ILIKE $2
			AND pv.name ILIKE $3
		`, sellerCompanyID, "%"+productPart+"%", "%"+variantPart+"%")
		if err != nil || res != nil {
			return res, err
		}
		res, err = trySearch(`
			pv."companyId" = $1
			AND pv.status = 'ACTIVE'
			AND pv.name ILIKE $2
		`, sellerCompanyID, "%"+variantPart+"%")
		if err != nil || res != nil {
			return res, err
		}
	}
	return nil, nil
}

func parseWarehouseVisibility(raw []byte, buyerCompanyID, sellerCompanyID string) []string {
	if len(raw) == 0 {
		return nil
	}
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil
	}
	for _, key := range []string{buyerCompanyID, sellerCompanyID} {
		val, ok := obj[key]
		if !ok {
			continue
		}
		arr, ok := val.([]any)
		if !ok {
			continue
		}
		out := make([]string, 0, len(arr))
		for _, v := range arr {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				out = append(out, s)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return nil
}

func attrString(attrs []byte, keys ...string) *string {
	if len(attrs) == 0 {
		return nil
	}
	var obj map[string]any
	if err := json.Unmarshal(attrs, &obj); err != nil {
		return nil
	}
	for _, key := range keys {
		if v, ok := obj[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				return &s
			}
		}
	}
	return nil
}

func (s *Service) GetSellerCatalogForBuyer(ctx context.Context, buyerCompanyID, sellerCompanyID, search string) (map[string]any, error) {
	if strings.TrimSpace(sellerCompanyID) == "" {
		return nil, errBadRequest("sellerCompanyId majburiy")
	}
	visRaw, err := s.repo.EnsureActivePartner(ctx, buyerCompanyID, sellerCompanyID)
	if err != nil {
		return nil, errBadRequest(err.Error())
	}
	visibleIDs := parseWarehouseVisibility(visRaw, buyerCompanyID, sellerCompanyID)
	activeVisible := map[string]struct{}{}
	if len(visibleIDs) > 0 {
		rows, err := s.pool.Query(ctx, `
			SELECT id
			FROM "Warehouse"
			WHERE "companyId" = $1
			  AND status = 'ACTIVE'
			  AND id = ANY($2)
		`, sellerCompanyID, visibleIDs)
		if err == nil {
			for rows.Next() {
				var id string
				if scanErr := rows.Scan(&id); scanErr == nil {
					activeVisible[id] = struct{}{}
				}
			}
			rows.Close()
		}
	}

	args := []any{sellerCompanyID}
	whereSearch := ""
	if strings.TrimSpace(search) != "" {
		args = append(args, "%"+strings.TrimSpace(search)+"%")
		whereSearch = ` AND (pv.name ILIKE $2 OR COALESCE(pv.sku, '') ILIKE $2 OR p.name ILIKE $2)`
	}
	rows, err := s.pool.Query(ctx, `
		SELECT pv.id, pv."productId", pv.name, pv.sku, COALESCE(pv."salePrice", 0)::float8, COALESCE(pv.currency, 'UZS'),
		       pv."attributesJson", p.name, p."imageUrl",
		       sb."warehouseId", COALESCE(sb.quantity, 0)::float8
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "StockBalance" sb ON sb."productVariantId" = pv.id
		WHERE pv."companyId" = $1
		  AND pv.status = 'ACTIVE'
		  AND p.status = 'ACTIVE'`+whereSearch+`
		ORDER BY p.name ASC, pv.name ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type variantAgg struct {
		ProductID   string
		ProductName string
		VariantID   string
		VariantName string
		SKU         *string
		Color       *string
		ImageURL    *string
		Price       float64
		Currency    string
		Quantity    float64
	}

	byVariant := map[string]*variantAgg{}
	productImage := map[string]*string{}

	for rows.Next() {
		var variantID, productID, variantName, productName, currency string
		var sku, pImage *string
		var salePrice float64
		var attrs []byte
		var warehouseID *string
		var qty float64
		if err := rows.Scan(
			&variantID, &productID, &variantName, &sku, &salePrice, &currency,
			&attrs, &productName, &pImage,
			&warehouseID, &qty,
		); err != nil {
			return nil, err
		}
		agg := byVariant[variantID]
		if agg == nil {
			color := attrString(attrs, "color")
			img := pImage
			if img == nil {
				img = attrString(attrs, "imageUrl", "image", "photo", "thumbnail")
			}
			agg = &variantAgg{
				ProductID:   productID,
				ProductName: productName,
				VariantID:   variantID,
				VariantName: variantName,
				SKU:         sku,
				Color:       color,
				ImageURL:    img,
				Price:       salePrice,
				Currency:    normalizeCurrency(currency),
			}
			byVariant[variantID] = agg
			if img != nil && productImage[productID] == nil {
				productImage[productID] = img
			}
		}
		if warehouseID == nil {
			continue
		}
		if len(activeVisible) > 0 {
			if _, ok := activeVisible[*warehouseID]; !ok {
				continue
			}
		}
		agg.Quantity += qty
	}

	items := make([]map[string]any, 0, len(byVariant))
	for _, row := range byVariant {
		img := row.ImageURL
		if img == nil {
			img = productImage[row.ProductID]
		}
		items = append(items, map[string]any{
			"productId":   row.ProductID,
			"productName": row.ProductName,
			"variantId":   row.VariantID,
			"variantName": row.VariantName,
			"sku":         row.SKU,
			"color":       row.Color,
			"imageUrl":    img,
			"salePrice":   row.Price,
			"currency":    row.Currency,
			"quantity":    row.Quantity,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		a := strings.ToLower(fmt.Sprintf("%v", items[i]["productName"]))
		b := strings.ToLower(fmt.Sprintf("%v", items[j]["productName"]))
		if a == b {
			return strings.ToLower(fmt.Sprintf("%v", items[i]["variantName"])) < strings.ToLower(fmt.Sprintf("%v", items[j]["variantName"]))
		}
		return a < b
	})
	return map[string]any{
		"sellerCompanyId":       sellerCompanyID,
		"total":                 len(items),
		"warehouseFilterActive": len(activeVisible) > 0,
		"items":                 items,
	}, nil
}

func parseSnapshotName(snapshot string) (string, string) {
	trimmed := strings.TrimSpace(snapshot)
	if trimmed == "" {
		return "Mahsulot", "—"
	}
	parts := strings.Split(trimmed, " - ")
	if len(parts) >= 2 {
		return strings.TrimSpace(parts[0]), strings.TrimSpace(strings.Join(parts[1:], " - "))
	}
	return trimmed, "—"
}

func (s *Service) ExportOrderToExcel(ctx context.Context, id, companyID string) ([]byte, string, error) {
	head, err := s.repo.FindOrderHead(ctx, id, companyID)
	if err != nil {
		return nil, "", err
	}
	items, err := s.repo.ListOrderItems(ctx, id)
	if err != nil {
		return nil, "", err
	}

	type row struct {
		Code      string
		Product   string
		Variant   string
		Qty       float64
		Price     float64
		Currency  string
		LineTotal float64
	}

	byKey := map[string]*row{}
	for _, item := range items {
		code := "—"
		if item.VariantSKU != nil && strings.TrimSpace(*item.VariantSKU) != "" {
			code = strings.TrimSpace(*item.VariantSKU)
		} else if item.VariantBarcode != nil && strings.TrimSpace(*item.VariantBarcode) != "" {
			code = strings.TrimSpace(*item.VariantBarcode)
		}
		product := ""
		variant := ""
		if item.ProductName != nil {
			product = strings.TrimSpace(*item.ProductName)
		}
		if item.VariantName != nil {
			variant = strings.TrimSpace(*item.VariantName)
		}
		if product == "" || variant == "" {
			snProd, snVar := parseSnapshotName(item.ProductNameSnapshot)
			if product == "" {
				product = snProd
			}
			if variant == "" {
				variant = snVar
			}
		}
		cur := normalizeCurrency(item.ExpectedCurrency)
		key := strings.ToUpper(strings.Join([]string{code, product, variant, fmt.Sprintf("%f", item.ExpectedPrice), cur}, "|"))
		if byKey[key] == nil {
			byKey[key] = &row{
				Code:      code,
				Product:   product,
				Variant:   variant,
				Qty:       0,
				Price:     item.ExpectedPrice,
				Currency:  cur,
				LineTotal: 0,
			}
		}
		byKey[key].Qty += item.Quantity
		byKey[key].LineTotal = byKey[key].Qty * byKey[key].Price
	}
	exportRows := make([]*row, 0, len(byKey))
	total := 0.0
	for _, r := range byKey {
		exportRows = append(exportRows, r)
		total += r.LineTotal
	}
	sort.Slice(exportRows, func(i, j int) bool {
		if exportRows[i].Product == exportRows[j].Product {
			return exportRows[i].Variant < exportRows[j].Variant
		}
		return exportRows[i].Product < exportRows[j].Product
	})

	f := excelize.NewFile()
	infoSheet := "Buyurtma"
	productsSheet := "Mahsulotlar"
	f.SetSheetName("Sheet1", infoSheet)
	_, _ = f.NewSheet(productsSheet)

	_ = f.SetCellValue(infoSheet, "A1", "Maydon")
	_ = f.SetCellValue(infoSheet, "B1", "Qiymat")
	orderLabel := "ORD-" + strings.ToUpper(head.ID[:8])
	_ = f.SetCellValue(infoSheet, "A2", "Buyurtma №")
	_ = f.SetCellValue(infoSheet, "B2", orderLabel)
	_ = f.SetCellValue(infoSheet, "A3", "ID")
	_ = f.SetCellValue(infoSheet, "B3", head.ID)
	_ = f.SetCellValue(infoSheet, "A4", "Sana")
	_ = f.SetCellValue(infoSheet, "B4", head.CreatedAt.Format("2006-01-02 15:04:05"))
	_ = f.SetCellValue(infoSheet, "A5", "Status")
	_ = f.SetCellValue(infoSheet, "B5", head.Status)
	_ = f.SetCellValue(infoSheet, "A6", "Sotuvchi")
	_ = f.SetCellValue(infoSheet, "B6", head.SellerName)
	_ = f.SetCellValue(infoSheet, "A7", "Xaridor")
	_ = f.SetCellValue(infoSheet, "B7", head.BuyerName)
	_ = f.SetCellValue(infoSheet, "A8", "Jami summa")
	_ = f.SetCellValue(infoSheet, "B8", total)

	headers := []string{"#", "Kod (SKU)", "Mahsulot", "Variant", "Miqdor", "Narx", "Valyuta", "Jami"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(productsSheet, cell, h)
	}
	for i, row := range exportRows {
		rn := i + 2
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("A%d", rn), i+1)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("B%d", rn), row.Code)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("C%d", rn), row.Product)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("D%d", rn), row.Variant)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("E%d", rn), row.Qty)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("F%d", rn), row.Price)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("G%d", rn), row.Currency)
		_ = f.SetCellValue(productsSheet, fmt.Sprintf("H%d", rn), row.LineTotal)
	}

	_ = f.SetColWidth(infoSheet, "A", "A", 22)
	_ = f.SetColWidth(infoSheet, "B", "B", 42)
	_ = f.SetColWidth(productsSheet, "A", "A", 6)
	_ = f.SetColWidth(productsSheet, "B", "B", 16)
	_ = f.SetColWidth(productsSheet, "C", "C", 28)
	_ = f.SetColWidth(productsSheet, "D", "D", 18)
	_ = f.SetColWidth(productsSheet, "E", "E", 10)
	_ = f.SetColWidth(productsSheet, "F", "F", 14)
	_ = f.SetColWidth(productsSheet, "G", "G", 10)
	_ = f.SetColWidth(productsSheet, "H", "H", 16)
	f.SetActiveSheet(0)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("buyurtma-%s.xlsx", orderLabel)
	return buf.Bytes(), filename, nil
}

func (s *Service) attachDispatchSummaries(ctx context.Context, orders []map[string]any) ([]map[string]any, error) {
	if len(orders) == 0 {
		return orders, nil
	}
	orderIDs := make([]string, 0)
	allowed := map[string]struct{}{
		"DISPATCHED": {}, "PARTIALLY_DISPATCHED": {}, "RECEIVED": {}, "PARTIAL_ACCEPTED": {},
	}
	for _, order := range orders {
		id, _ := order["id"].(string)
		status, _ := order["status"].(string)
		if id == "" {
			continue
		}
		if _, ok := allowed[status]; ok {
			orderIDs = append(orderIDs, id)
		}
	}
	if len(orderIDs) == 0 {
		return orders, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT d."orderId", di."productVariantId", COALESCE(SUM(di.quantity), 0)::float8,
		       MAX(d."sentAt"), MAX(d."dispatchNumber")
		FROM "DispatchItem" di
		JOIN "Dispatch" d ON d.id = di."dispatchId"
		WHERE d."orderId" = ANY($1) AND d.status = 'SENT'
		GROUP BY d."orderId", di."productVariantId"
	`, orderIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	qtyByOrderVariant := map[string]map[string]float64{}
	latestByOrder := map[string]map[string]any{}
	for rows.Next() {
		var orderID, variantID string
		var qty float64
		var sentAt *time.Time
		var dispatchNumber *string
		if err := rows.Scan(&orderID, &variantID, &qty, &sentAt, &dispatchNumber); err != nil {
			return nil, err
		}
		if qtyByOrderVariant[orderID] == nil {
			qtyByOrderVariant[orderID] = map[string]float64{}
		}
		qtyByOrderVariant[orderID][variantID] += qty
		if latestByOrder[orderID] == nil {
			latestByOrder[orderID] = map[string]any{"dispatchNumber": dispatchNumber, "sentAt": sentAt}
		} else {
			prev, _ := latestByOrder[orderID]["sentAt"].(*time.Time)
			if prev == nil || (sentAt != nil && sentAt.After(*prev)) {
				latestByOrder[orderID] = map[string]any{"dispatchNumber": dispatchNumber, "sentAt": sentAt}
			}
		}
	}

	for _, order := range orders {
		id, _ := order["id"].(string)
		perVariant := qtyByOrderVariant[id]
		rawItems, _ := order["items"].([]map[string]any)
		if len(rawItems) == 0 {
			continue
		}
		hasDispatch := false
		isPartial := false
		canDispatchMore := false
		dispatchedTotalAmount := 0.0
		for i := range rawItems {
			orderedQty := asFloat(rawItems[i]["quantity"])
			variantID, _ := rawItems[i]["productVariantId"].(*string)
			dispatchedQty := 0.0
			if variantID != nil {
				dispatchedQty = perVariant[*variantID]
			}
			if dispatchedQty > 0 {
				hasDispatch = true
			}
			remaining := orderedQty - dispatchedQty
			if remaining < 0 {
				remaining = 0
			}
			if remaining > 0 {
				canDispatchMore = true
			}
			if dispatchedQty < orderedQty {
				isPartial = true
			}
			dispatchedTotalAmount += dispatchedQty * asFloat(rawItems[i]["expectedPrice"])
			rawItems[i]["orderedQuantity"] = orderedQty
			rawItems[i]["dispatchedQuantity"] = dispatchedQty
			rawItems[i]["remainingToDispatch"] = remaining
		}
		order["items"] = rawItems
		order["hasDispatch"] = hasDispatch
		order["isPartialDispatch"] = isPartial
		order["canDispatchMore"] = canDispatchMore
		order["dispatchedTotalAmount"] = dispatchedTotalAmount
		order["latestDispatch"] = latestByOrder[id]
	}
	return orders, nil
}

func asFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}
