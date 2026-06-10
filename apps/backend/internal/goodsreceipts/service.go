package goodsreceipts

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jung-kurt/gofpdf"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	"github.com/xuri/excelize/v2"
)

const receiptInlineItemsMax = 80

type Service struct {
	pool   *pgxpool.Pool
	repo   *Repository
	notify *notifications.Service
	hub    pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, repo *Repository, notify *notifications.Service, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{
		pool:   pool,
		repo:   repo,
		notify: notify,
		hub:    hub,
	}
}

type badRequestError struct{ msg string }

func (e badRequestError) Error() string { return e.msg }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }

func normalizeCurrency(cur string) string {
	if strings.ToUpper(strings.TrimSpace(cur)) == "USD" {
		return "USD"
	}
	return "UZS"
}

func toFiniteMoney(v any) float64 {
	switch t := v.(type) {
	case nil:
		return 0
	case float64:
		if math.IsNaN(t) || math.IsInf(t, 0) {
			return 0
		}
		return t
	case float32:
		n := float64(t)
		if math.IsNaN(n) || math.IsInf(n, 0) {
			return 0
		}
		return n
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case string:
		s := strings.TrimSpace(strings.ReplaceAll(t, ",", "."))
		if s == "" {
			return 0
		}
		n, err := strconv.ParseFloat(s, 64)
		if err != nil || math.IsNaN(n) || math.IsInf(n, 0) {
			return 0
		}
		return n
	default:
		return 0
	}
}

func parsePageLimit(pageRaw, limitRaw string, def, max int) (int, int, int) {
	page, _ := strconv.Atoi(strings.TrimSpace(pageRaw))
	limit, _ := strconv.Atoi(strings.TrimSpace(limitRaw))
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = def
	}
	if limit > max {
		limit = max
	}
	return page, limit, (page - 1) * limit
}

func parseDetailLimit(pageRaw, limitRaw string) (int, int) {
	page, _ := strconv.Atoi(strings.TrimSpace(pageRaw))
	limit, _ := strconv.Atoi(strings.TrimSpace(limitRaw))
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = 50
	}
	if limit < 10 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	return page, limit
}

func normalizeKey(v string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(v)), " "))
}

func parseSnapshotParts(snapshot string) (string, string) {
	raw := strings.TrimSpace(snapshot)
	if raw == "" {
		return "Mahsulot", "Standart"
	}
	parts := strings.Split(raw, " - ")
	if len(parts) < 2 {
		return raw, "Standart"
	}
	p := strings.TrimSpace(parts[0])
	v := strings.TrimSpace(strings.Join(parts[1:], " - "))
	if p == "" {
		p = "Mahsulot"
	}
	if v == "" {
		v = "Standart"
	}
	return p, v
}

func receiptStatusLabel(status string) string {
	switch status {
	case "PENDING":
		return "Kutilmoqda"
	case "ACCEPTED":
		return "Qabul qilingan"
	case "PARTIALLY_ACCEPTED":
		return "Qisman qabul"
	case "REJECTED":
		return "Rad etilgan"
	default:
		return status
	}
}

func shortID(prefix, id string) string {
	if len(id) > 8 {
		return fmt.Sprintf("%s-%s", prefix, strings.ToUpper(id[:8]))
	}
	return fmt.Sprintf("%s-%s", prefix, strings.ToUpper(id))
}

func (s *Service) findOrderItemForReceiptLine(bundle *ReceiptBundle, item ReceiptItemRecord) *OrderItemRecord {
	if item.ProductVariantID != nil {
		for i := range bundle.OrderItems {
			if bundle.OrderItems[i].ProductVariantID != nil && *bundle.OrderItems[i].ProductVariantID == *item.ProductVariantID {
				return &bundle.OrderItems[i]
			}
		}
	}

	targetName := normalizeKey(item.ProductNameSnapshot)
	sameNameIdx := make([]int, 0)
	for i := range bundle.OrderItems {
		if normalizeKey(bundle.OrderItems[i].ProductNameSnapshot) == targetName {
			sameNameIdx = append(sameNameIdx, i)
		}
	}
	if len(sameNameIdx) == 1 {
		return &bundle.OrderItems[sameNameIdx[0]]
	}
	if len(sameNameIdx) > 1 {
		for _, idx := range sameNameIdx {
			if math.Abs(bundle.OrderItems[idx].Quantity-item.Quantity) < 0.0001 {
				return &bundle.OrderItems[idx]
			}
		}
		return &bundle.OrderItems[sameNameIdx[0]]
	}
	return nil
}

func (s *Service) findDispatchItemForReceiptLine(bundle *ReceiptBundle, item ReceiptItemRecord) *DispatchItemRecord {
	if item.ProductVariantID != nil {
		for i := range bundle.DispatchItems {
			if bundle.DispatchItems[i].ProductVariantID == *item.ProductVariantID {
				return &bundle.DispatchItems[i]
			}
		}
	}
	targetName := normalizeKey(item.ProductNameSnapshot)
	sameNameIdx := make([]int, 0)
	for i := range bundle.DispatchItems {
		if normalizeKey(bundle.DispatchItems[i].ProductNameSnapshot) == targetName {
			sameNameIdx = append(sameNameIdx, i)
		}
	}
	if len(sameNameIdx) == 1 {
		return &bundle.DispatchItems[sameNameIdx[0]]
	}
	if len(sameNameIdx) > 1 {
		for _, idx := range sameNameIdx {
			if math.Abs(bundle.DispatchItems[idx].Quantity-item.Quantity) < 0.0001 {
				return &bundle.DispatchItems[idx]
			}
		}
		return &bundle.DispatchItems[sameNameIdx[0]]
	}
	return nil
}

func (s *Service) resolveSellerVariantID(bundle *ReceiptBundle, item ReceiptItemRecord, sellerVariants map[string]VariantLite) string {
	if dispatchLine := s.findDispatchItemForReceiptLine(bundle, item); dispatchLine != nil {
		if _, ok := sellerVariants[dispatchLine.ProductVariantID]; ok {
			return dispatchLine.ProductVariantID
		}
	}
	if orderLine := s.findOrderItemForReceiptLine(bundle, item); orderLine != nil && orderLine.ProductVariantID != nil {
		if _, ok := sellerVariants[*orderLine.ProductVariantID]; ok {
			return *orderLine.ProductVariantID
		}
	}
	if item.ProductVariantID != nil {
		if _, ok := sellerVariants[*item.ProductVariantID]; ok {
			return *item.ProductVariantID
		}
	}
	return ""
}

func (s *Service) resolveMapping(mappings []MappingRecord, sellerVariantID, snapshot string, sellerVariant *VariantLite) *MappingRecord {
	if sellerVariantID != "" {
		for i := range mappings {
			if mappings[i].PartnerSKU != nil && *mappings[i].PartnerSKU == sellerVariantID {
				return &mappings[i]
			}
		}
	}
	if sellerVariant != nil && sellerVariant.Barcode != nil && strings.TrimSpace(*sellerVariant.Barcode) != "" {
		barcode := strings.TrimSpace(*sellerVariant.Barcode)
		for i := range mappings {
			if mappings[i].PartnerBarcode != nil && strings.TrimSpace(*mappings[i].PartnerBarcode) == barcode {
				return &mappings[i]
			}
		}
	}
	target := normalizeKey(snapshot)
	for i := range mappings {
		if normalizeKey(mappings[i].PartnerProductName) == target {
			return &mappings[i]
		}
	}
	return nil
}

func (s *Service) loadSellerVariants(ctx context.Context, bundle *ReceiptBundle) (map[string]VariantLite, error) {
	candidates := make([]string, 0)
	seen := make(map[string]struct{})
	add := func(id *string) {
		if id == nil || strings.TrimSpace(*id) == "" {
			return
		}
		if _, ok := seen[*id]; ok {
			return
		}
		seen[*id] = struct{}{}
		candidates = append(candidates, *id)
	}
	for i := range bundle.Items {
		add(bundle.Items[i].ProductVariantID)
	}
	for i := range bundle.OrderItems {
		add(bundle.OrderItems[i].ProductVariantID)
	}
	for i := range bundle.DispatchItems {
		id := bundle.DispatchItems[i].ProductVariantID
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		candidates = append(candidates, id)
	}
	return s.repo.LoadVariantsByIDs(ctx, bundle.Head.SellerCompanyID, candidates)
}

func (s *Service) buildReceiptView(ctx context.Context, bundle *ReceiptBundle, full bool) (map[string]any, error) {
	var (
		mappings       []MappingRecord
		sellerVariants map[string]VariantLite
		buyerVariants  map[string]VariantLite
		err            error
	)

	if full {
		mappings, err = s.repo.LoadMappings(ctx, bundle.Head.BuyerCompanyID, bundle.Head.SellerCompanyID)
		if err != nil {
			return nil, err
		}
		sellerVariants, err = s.loadSellerVariants(ctx, bundle)
		if err != nil {
			return nil, err
		}

		variantIDs := make([]string, 0)
		seen := make(map[string]struct{})
		for i := range bundle.Items {
			if bundle.Items[i].ProductVariantID != nil {
				id := *bundle.Items[i].ProductVariantID
				if _, ok := seen[id]; !ok {
					seen[id] = struct{}{}
					variantIDs = append(variantIDs, id)
				}
			}
		}
		for i := range mappings {
			id := mappings[i].OwnProductVariantID
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				variantIDs = append(variantIDs, id)
			}
		}
		buyerVariants, err = s.repo.LoadVariantsByIDs(ctx, bundle.Head.BuyerCompanyID, variantIDs)
		if err != nil {
			return nil, err
		}
	}

	items := make([]map[string]any, 0, len(bundle.Items))
	totalAmount := 0.0
	displayCurrency := ""
	isPartialShipment := false
	isPartialAcceptance := bundle.Head.Status == "PARTIALLY_ACCEPTED"

	for i := range bundle.Items {
		item := bundle.Items[i]
		orderItem := s.findOrderItemForReceiptLine(bundle, item)

		expectedPrice := 0.0
		expectedCurrency := "UZS"
		orderedQuantity := 0.0
		if orderItem != nil {
			expectedPrice = toFiniteMoney(orderItem.ExpectedPrice)
			expectedCurrency = normalizeCurrency(orderItem.ExpectedCurrency)
			orderedQuantity = toFiniteMoney(orderItem.Quantity)
		}
		if displayCurrency == "" {
			displayCurrency = expectedCurrency
		}

		receivedQty := item.Quantity
		if item.ReceivedQuantity != nil {
			receivedQty = *item.ReceivedQuantity
		}
		if orderedQuantity > 0 && item.Quantity > 0 && item.Quantity < orderedQuantity {
			isPartialShipment = true
		}
		if receivedQty < item.Quantity {
			isPartialAcceptance = true
		}

		row := map[string]any{
			"id":                  item.ID,
			"receiptId":           item.ReceiptID,
			"productVariantId":    item.ProductVariantID,
			"productNameSnapshot": item.ProductNameSnapshot,
			"quantity":            item.Quantity,
			"receivedQuantity":    receivedQty,
			"expectedPrice":       expectedPrice,
			"expectedCurrency":    expectedCurrency,
			"orderedQuantity":     orderedQuantity,
			"shippedQuantity":     item.Quantity,
			"isPartialLine":       orderedQuantity > 0 && item.Quantity > 0 && item.Quantity < orderedQuantity,
		}

		if full {
			var sellerVariantID string
			if sellerVariants != nil {
				sellerVariantID = s.resolveSellerVariantID(bundle, item, sellerVariants)
				if sellerVariantID != "" {
					row["sellerVariantId"] = sellerVariantID
				}
			}

			var sellerVariant *VariantLite
			if sellerVariantID != "" {
				if sv, ok := sellerVariants[sellerVariantID]; ok {
					sellerVariant = &sv
				}
			}
			mapping := s.resolveMapping(mappings, sellerVariantID, item.ProductNameSnapshot, sellerVariant)
			suggestedVariantID := ""
			if mapping != nil {
				row["mapping"] = map[string]any{
					"id":                  mapping.ID,
					"partnerProductName":  mapping.PartnerProductName,
					"partnerSku":          mapping.PartnerSKU,
					"partnerBarcode":      mapping.PartnerBarcode,
					"ownProductVariantId": mapping.OwnProductVariantID,
				}
				suggestedVariantID = mapping.OwnProductVariantID
			}
			if suggestedVariantID == "" && item.ProductVariantID != nil {
				if _, ok := buyerVariants[*item.ProductVariantID]; ok {
					suggestedVariantID = *item.ProductVariantID
				}
			}
			if suggestedVariantID != "" {
				row["suggestedVariantId"] = suggestedVariantID
				row["inboundStatus"] = "EXISTING"
			} else {
				row["suggestedVariantId"] = nil
				row["inboundStatus"] = "AUTO_NEW"
			}

			if item.ProductVariantID != nil {
				if v, ok := buyerVariants[*item.ProductVariantID]; ok {
					row["productVariant"] = map[string]any{
						"id":      v.ID,
						"name":    v.Name,
						"sku":     v.SKU,
						"barcode": v.Barcode,
						"product": map[string]any{
							"id":   v.ProductID,
							"name": v.ProductName,
							"category": map[string]any{
								"id":   v.CategoryID,
								"name": v.CategoryName,
							},
						},
					}
				}
			}
		}

		items = append(items, row)
		totalAmount += item.Quantity * expectedPrice
	}

	if displayCurrency == "" {
		displayCurrency = "UZS"
	}

	orderItems := make([]map[string]any, 0, len(bundle.OrderItems))
	for i := range bundle.OrderItems {
		row := bundle.OrderItems[i]
		orderItems = append(orderItems, map[string]any{
			"productVariantId":    row.ProductVariantID,
			"productNameSnapshot": row.ProductNameSnapshot,
			"quantity":            row.Quantity,
			"expectedPrice":       row.ExpectedPrice,
			"expectedCurrency":    normalizeCurrency(row.ExpectedCurrency),
		})
	}

	dispatchItems := make([]map[string]any, 0, len(bundle.DispatchItems))
	for i := range bundle.DispatchItems {
		row := bundle.DispatchItems[i]
		dispatchItems = append(dispatchItems, map[string]any{
			"productVariantId":    row.ProductVariantID,
			"productNameSnapshot": row.ProductNameSnapshot,
			"quantity":            row.Quantity,
		})
	}

	resp := map[string]any{
		"id":              bundle.Head.ID,
		"orderId":         bundle.Head.OrderID,
		"dispatchId":      bundle.Head.DispatchID,
		"buyerCompanyId":  bundle.Head.BuyerCompanyID,
		"sellerCompanyId": bundle.Head.SellerCompanyID,
		"status":          bundle.Head.Status,
		"createdAt":       bundle.Head.CreatedAt,
		"updatedAt":       bundle.Head.UpdatedAt,
		"receivedAt":      bundle.Head.ReceivedAt,
		"buyerCompany": map[string]any{
			"name": bundle.Head.BuyerName,
		},
		"sellerCompany": map[string]any{
			"name": bundle.Head.SellerName,
			"tin":  bundle.Head.SellerTin,
		},
		"order": map[string]any{
			"id":    bundle.Head.OrderID,
			"items": orderItems,
		},
		"dispatch": map[string]any{
			"id":    bundle.Head.DispatchID,
			"items": dispatchItems,
		},
		"items":               items,
		"isPartialShipment":   isPartialShipment,
		"isPartialAcceptance": isPartialAcceptance,
		"totalAmount":         totalAmount,
		"displayCurrency":     normalizeCurrency(displayCurrency),
	}
	return resp, nil
}

func (s *Service) FindAll(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	page, limit, skip := parsePageLimit(q["page"], q["limit"], 30, 100)
	rows, total, err := s.repo.ListReceipts(ctx, companyID, ListQuery{
		Status: q["status"],
		Search: q["search"],
		Limit:  limit,
		Skip:   skip,
	})
	if err != nil {
		return nil, err
	}

	receiptIDs := make([]string, 0, len(rows))
	orderIDs := make([]string, 0, len(rows))
	for i := range rows {
		receiptIDs = append(receiptIDs, rows[i].ID)
		orderIDs = append(orderIDs, rows[i].OrderID)
	}

	itemsByReceipt, err := s.repo.LoadReceiptItemsByIDs(ctx, receiptIDs)
	if err != nil {
		return nil, err
	}
	orderItemsByOrder, err := s.repo.LoadOrderItemsByIDs(ctx, orderIDs)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(rows))
	for i := range rows {
		bundle := &ReceiptBundle{
			Head:       rows[i],
			Items:      itemsByReceipt[rows[i].ID],
			OrderItems: orderItemsByOrder[rows[i].OrderID],
		}
		view, err := s.buildReceiptView(ctx, bundle, false)
		if err != nil {
			return nil, err
		}
		items = append(items, view)
	}

	summary, err := s.repo.ReceiptStatusSummary(ctx, companyID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"items":   items,
		"page":    page,
		"limit":   limit,
		"total":   total,
		"hasMore": skip+len(items) < total,
		"summary": summary,
	}, nil
}

func (s *Service) FindOne(ctx context.Context, id, companyID, mode, pageRaw, limitRaw string) (map[string]any, error) {
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != "full" {
		mode = "view"
	}
	page, limit := parseDetailLimit(pageRaw, limitRaw)

	bundle, err := s.repo.LoadReceiptBundle(ctx, id, companyID)
	if err != nil {
		return nil, err
	}

	full := mode == "full"
	view, err := s.buildReceiptView(ctx, bundle, full)
	if err != nil {
		return nil, err
	}

	rawItems, _ := view["items"].([]map[string]any)
	totalItems := len(rawItems)
	needsPagination := mode == "view" && totalItems > receiptInlineItemsMax
	if needsPagination {
		start := (page - 1) * limit
		if start > totalItems {
			start = totalItems
		}
		end := start + limit
		if end > totalItems {
			end = totalItems
		}
		view["items"] = rawItems[start:end]
		view["itemsPaginated"] = map[string]any{
			"page":    page,
			"limit":   limit,
			"total":   totalItems,
			"hasMore": end < totalItems,
		}
	}

	if bundle.Head.Status == "ACCEPTED" || bundle.Head.Status == "PARTIALLY_ACCEPTED" {
		inbound, err := s.repo.LoadInboundMovements(ctx, bundle.Head.ID, bundle.Head.BuyerCompanyID)
		if err != nil {
			return nil, err
		}
		inboundMapped := make([]map[string]any, 0, len(inbound))
		for i := range inbound {
			inboundMapped = append(inboundMapped, map[string]any{
				"warehouseId":      inbound[i].WarehouseID,
				"warehouseName":    inbound[i].WarehouseName,
				"productVariantId": inbound[i].ProductVariantID,
				"productName":      inbound[i].ProductName,
				"variantName":      inbound[i].VariantName,
				"sku":              inbound[i].SKU,
				"quantity":         inbound[i].Quantity,
			})
		}
		view["inboundStock"] = inboundMapped
	} else {
		view["inboundStock"] = []map[string]any{}
	}

	return view, nil
}

func (s *Service) findAllForExport(ctx context.Context, companyID string) ([]map[string]any, error) {
	skip := 0
	limit := 300
	total := 1
	out := make([]map[string]any, 0)

	for skip < total {
		rows, rowTotal, err := s.repo.ListReceipts(ctx, companyID, ListQuery{
			Limit: limit,
			Skip:  skip,
		})
		if err != nil {
			return nil, err
		}
		total = rowTotal
		if len(rows) == 0 {
			break
		}

		receiptIDs := make([]string, 0, len(rows))
		orderIDs := make([]string, 0, len(rows))
		for i := range rows {
			receiptIDs = append(receiptIDs, rows[i].ID)
			orderIDs = append(orderIDs, rows[i].OrderID)
		}
		itemsByReceipt, err := s.repo.LoadReceiptItemsByIDs(ctx, receiptIDs)
		if err != nil {
			return nil, err
		}
		orderItemsByOrder, err := s.repo.LoadOrderItemsByIDs(ctx, orderIDs)
		if err != nil {
			return nil, err
		}
		for i := range rows {
			bundle := &ReceiptBundle{
				Head:       rows[i],
				Items:      itemsByReceipt[rows[i].ID],
				OrderItems: orderItemsByOrder[rows[i].OrderID],
			}
			view, err := s.buildReceiptView(ctx, bundle, false)
			if err != nil {
				return nil, err
			}
			out = append(out, view)
		}
		skip += len(rows)
	}
	return out, nil
}

func (s *Service) ExportAllToExcel(ctx context.Context, companyID string) ([]byte, string, error) {
	receipts, err := s.findAllForExport(ctx, companyID)
	if err != nil {
		return nil, "", err
	}

	f := excelize.NewFile()
	listSheet := "Qabullar"
	linesSheet := "Qatorlar"
	f.SetSheetName("Sheet1", listSheet)
	_, _ = f.NewSheet(linesSheet)

	listHeaders := []string{"Qabul №", "Buyurtma №", "Sotuvchi", "STIR", "Summa", "Valyuta", "Mahsulotlar", "Status", "Sana"}
	for i, h := range listHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(listSheet, cell, h)
	}
	_ = f.SetColWidth(listSheet, "A", "A", 16)
	_ = f.SetColWidth(listSheet, "B", "B", 16)
	_ = f.SetColWidth(listSheet, "C", "C", 28)
	_ = f.SetColWidth(listSheet, "D", "D", 16)
	_ = f.SetColWidth(listSheet, "E", "E", 14)
	_ = f.SetColWidth(listSheet, "F", "F", 10)
	_ = f.SetColWidth(listSheet, "G", "G", 12)
	_ = f.SetColWidth(listSheet, "H", "H", 16)
	_ = f.SetColWidth(listSheet, "I", "I", 22)

	lineHeaders := []string{"Qabul №", "Mahsulot", "Miqdor", "Narx", "Valyuta", "Jami"}
	for i, h := range lineHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(linesSheet, cell, h)
	}
	_ = f.SetColWidth(linesSheet, "A", "A", 16)
	_ = f.SetColWidth(linesSheet, "B", "B", 36)
	_ = f.SetColWidth(linesSheet, "C", "C", 10)
	_ = f.SetColWidth(linesSheet, "D", "D", 12)
	_ = f.SetColWidth(linesSheet, "E", "E", 10)
	_ = f.SetColWidth(linesSheet, "F", "F", 14)

	listRow := 2
	lineRow := 2
	for i := range receipts {
		r := receipts[i]
		id := mapAnyString(r["id"])
		orderID := mapAnyString(r["orderId"])
		seller := mapAnyMap(r["sellerCompany"])
		items := mapAnyItems(r["items"])

		_ = f.SetCellValue(listSheet, fmt.Sprintf("A%d", listRow), shortID("RCP", id))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("B%d", listRow), shortID("ORD", orderID))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("C%d", listRow), mapAnyString(seller["name"]))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("D%d", listRow), mapAnyString(seller["tin"]))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("E%d", listRow), toFiniteMoney(r["totalAmount"]))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("F%d", listRow), mapAnyString(r["displayCurrency"]))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("G%d", listRow), len(items))
		_ = f.SetCellValue(listSheet, fmt.Sprintf("H%d", listRow), receiptStatusLabel(mapAnyString(r["status"])))
		createdAt, _ := r["createdAt"].(time.Time)
		_ = f.SetCellValue(listSheet, fmt.Sprintf("I%d", listRow), createdAt.Format("2006-01-02 15:04"))
		listRow++

		for j := range items {
			qty := toFiniteMoney(items[j]["quantity"])
			price := toFiniteMoney(items[j]["expectedPrice"])
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("A%d", lineRow), shortID("RCP", id))
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("B%d", lineRow), mapAnyString(items[j]["productNameSnapshot"]))
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("C%d", lineRow), qty)
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("D%d", lineRow), price)
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("E%d", lineRow), mapAnyString(items[j]["expectedCurrency"]))
			_ = f.SetCellValue(linesSheet, fmt.Sprintf("F%d", lineRow), qty*price)
			lineRow++
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("qabullar-%s.xlsx", time.Now().UTC().Format("2006-01-02"))
	return buf.Bytes(), filename, nil
}

func (s *Service) ExportReceiptToExcel(ctx context.Context, id, companyID string) ([]byte, string, error) {
	bundle, err := s.repo.LoadReceiptBundle(ctx, id, companyID)
	if err != nil {
		return nil, "", err
	}
	view, err := s.buildReceiptView(ctx, bundle, true)
	if err != nil {
		return nil, "", err
	}
	items := mapAnyItems(view["items"])

	f := excelize.NewFile()
	infoSheet := "Qabul"
	itemsSheet := "Mahsulotlar"
	f.SetSheetName("Sheet1", infoSheet)
	_, _ = f.NewSheet(itemsSheet)

	_ = f.SetCellValue(infoSheet, "A1", "Maydon")
	_ = f.SetCellValue(infoSheet, "B1", "Qiymat")
	_ = f.SetCellValue(infoSheet, "A2", "Qabul №")
	_ = f.SetCellValue(infoSheet, "B2", shortID("RCP", bundle.Head.ID))
	_ = f.SetCellValue(infoSheet, "A3", "Buyurtma №")
	_ = f.SetCellValue(infoSheet, "B3", shortID("ORD", bundle.Head.OrderID))
	_ = f.SetCellValue(infoSheet, "A4", "Sana")
	_ = f.SetCellValue(infoSheet, "B4", bundle.Head.CreatedAt.Format("2006-01-02 15:04"))
	_ = f.SetCellValue(infoSheet, "A5", "Status")
	_ = f.SetCellValue(infoSheet, "B5", receiptStatusLabel(bundle.Head.Status))
	_ = f.SetCellValue(infoSheet, "A6", "Sotuvchi")
	_ = f.SetCellValue(infoSheet, "B6", bundle.Head.SellerName)
	_ = f.SetCellValue(infoSheet, "A7", "Sotuvchi STIR")
	_ = f.SetCellValue(infoSheet, "B7", mapAnyString(bundle.Head.SellerTin))
	_ = f.SetCellValue(infoSheet, "A8", "Xaridor")
	_ = f.SetCellValue(infoSheet, "B8", bundle.Head.BuyerName)
	_ = f.SetCellValue(infoSheet, "A9", "Jami summa")
	_ = f.SetCellValue(infoSheet, "B9", toFiniteMoney(view["totalAmount"]))
	_ = f.SetColWidth(infoSheet, "A", "A", 22)
	_ = f.SetColWidth(infoSheet, "B", "B", 48)

	headers := []string{"#", "Mahsulot", "Miqdor", "Narx", "Valyuta", "Jami", "Omborga"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(itemsSheet, cell, h)
	}
	_ = f.SetColWidth(itemsSheet, "A", "A", 6)
	_ = f.SetColWidth(itemsSheet, "B", "B", 36)
	_ = f.SetColWidth(itemsSheet, "C", "C", 10)
	_ = f.SetColWidth(itemsSheet, "D", "D", 14)
	_ = f.SetColWidth(itemsSheet, "E", "E", 10)
	_ = f.SetColWidth(itemsSheet, "F", "F", 14)
	_ = f.SetColWidth(itemsSheet, "G", "G", 16)

	for i := range items {
		row := i + 2
		qty := toFiniteMoney(items[i]["quantity"])
		price := toFiniteMoney(items[i]["expectedPrice"])
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("A%d", row), i+1)
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("B%d", row), mapAnyString(items[i]["productNameSnapshot"]))
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("C%d", row), qty)
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("D%d", row), price)
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("E%d", row), mapAnyString(items[i]["expectedCurrency"]))
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("F%d", row), qty*price)
		inbound := "Yangi (avtomatik)"
		if mapAnyString(items[i]["inboundStatus"]) == "EXISTING" || items[i]["mapping"] != nil {
			inbound = "Mavjud"
		}
		_ = f.SetCellValue(itemsSheet, fmt.Sprintf("G%d", row), inbound)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("qabul-%s.xlsx", shortID("RCP", bundle.Head.ID))
	return buf.Bytes(), filename, nil
}

func (s *Service) ExportReceiptToPDF(ctx context.Context, id, companyID string) ([]byte, string, error) {
	bundle, err := s.repo.LoadReceiptBundle(ctx, id, companyID)
	if err != nil {
		return nil, "", err
	}
	view, err := s.buildReceiptView(ctx, bundle, false)
	if err != nil {
		return nil, "", err
	}
	items := mapAnyItems(view["items"])

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 13)
	pdf.Cell(0, 8, "Qabul hujjati")
	pdf.Ln(10)

	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Qabul №: %s", shortID("RCP", bundle.Head.ID)))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Buyurtma №: %s", shortID("ORD", bundle.Head.OrderID)))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Sana: %s", bundle.Head.CreatedAt.Format("2006-01-02 15:04")))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Status: %s", receiptStatusLabel(bundle.Head.Status)))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Sotuvchi: %s", bundle.Head.SellerName))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Xaridor: %s", bundle.Head.BuyerName))
	pdf.Ln(8)

	headers := []string{"#", "Mahsulot", "Miqdor", "Qabul", "Narx", "Jami"}
	widths := []float64{10, 84, 20, 20, 25, 31}
	pdf.SetFont("Arial", "B", 9)
	for i := range headers {
		pdf.CellFormat(widths[i], 7, headers[i], "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for i := range items {
		qty := toFiniteMoney(items[i]["quantity"])
		received := toFiniteMoney(items[i]["receivedQuantity"])
		price := toFiniteMoney(items[i]["expectedPrice"])
		row := []string{
			strconv.Itoa(i + 1),
			mapAnyString(items[i]["productNameSnapshot"]),
			fmt.Sprintf("%.2f", qty),
			fmt.Sprintf("%.2f", received),
			fmt.Sprintf("%.2f", price),
			fmt.Sprintf("%.2f", qty*price),
		}
		for col := range row {
			align := "L"
			if col == 0 || col >= 2 {
				align = "C"
			}
			pdf.CellFormat(widths[col], 6, row[col], "1", 0, align, false, 0, "")
		}
		pdf.Ln(-1)
	}

	pdf.Ln(4)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Jami: %.2f %s", toFiniteMoney(view["totalAmount"]), mapAnyString(view["displayCurrency"])))

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("qabul-%s.pdf", shortID("RCP", bundle.Head.ID))
	return buf.Bytes(), filename, nil
}

func (s *Service) Accept(ctx context.Context, id, companyID, userID string, input AcceptReceiptInput) (map[string]any, error) {
	warehouseID := strings.TrimSpace(input.WarehouseID)
	if warehouseID == "" {
		return nil, errBadRequest("warehouseId majburiy")
	}
	warehouseName, err := s.repo.FindWarehouseName(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}

	qtyOverride := make(map[string]float64, len(input.Items))
	for i := range input.Items {
		itemID := strings.TrimSpace(input.Items[i].ItemID)
		if itemID == "" {
			continue
		}
		qtyOverride[itemID] = toFiniteMoney(input.Items[i].ReceivedQuantity)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	bundle, err := s.repo.LoadReceiptBundleTx(ctx, tx, id, companyID, true)
	if err != nil {
		return nil, err
	}
	if bundle.Head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor tovarni qabul qila oladi")
	}
	if bundle.Head.Status == "ACCEPTED" {
		return map[string]any{"success": true}, nil
	}
	if bundle.Head.Status != "PENDING" {
		return nil, errBadRequest("Faqat PENDING holatidagi hujjatni qabul qilish mumkin")
	}

	result, err := s.processAcceptanceTx(ctx, tx, bundle, companyID, userID, warehouseID, input.Note, qtyOverride, true, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": warehouseID,
		"reason":      "GOODS_RECEIPT",
	})
	s.enrichInboundLines(ctx, companyID, result.Inbound)
	inboundMovements, _ := s.repo.LoadInboundMovements(ctx, id, companyID)
	s.notifyReceiptAccepted(bundle.Head, result.TotalDebt, result.DebtCurrency, result.Status)

	return map[string]any{
		"success":          true,
		"warehouseId":      warehouseID,
		"warehouseName":    warehouseName,
		"inbound":          result.Inbound,
		"inboundMovements": inboundMovementsToMap(inboundMovements),
	}, nil
}

func (s *Service) PartialAccept(ctx context.Context, id, companyID, userID string, input PartialAcceptReceiptInput) (map[string]any, error) {
	warehouseID := strings.TrimSpace(input.WarehouseID)
	if warehouseID == "" {
		return nil, errBadRequest("warehouseId majburiy")
	}
	warehouseName, err := s.repo.FindWarehouseName(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	if len(input.Items) == 0 {
		return nil, errBadRequest("Kamida bitta mahsulot uchun qabul miqdori 0 dan katta bo'lishi kerak")
	}

	qtyOverride := make(map[string]float64, len(input.Items))
	for i := range input.Items {
		itemID := strings.TrimSpace(input.Items[i].ItemID)
		if itemID == "" {
			continue
		}
		qtyOverride[itemID] = toFiniteMoney(input.Items[i].ReceivedQuantity)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	bundle, err := s.repo.LoadReceiptBundleTx(ctx, tx, id, companyID, true)
	if err != nil {
		return nil, err
	}
	if bundle.Head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor qabul qila oladi")
	}
	if bundle.Head.Status == "ACCEPTED" || bundle.Head.Status == "PARTIALLY_ACCEPTED" {
		return map[string]any{"success": true}, nil
	}
	if bundle.Head.Status != "PENDING" {
		return nil, errBadRequest("Faqat PENDING holatidagi yukni qisman qabul qilish mumkin")
	}

	result, err := s.processAcceptanceTx(ctx, tx, bundle, companyID, userID, warehouseID, input.Note, qtyOverride, false, true)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": warehouseID,
		"reason":      "GOODS_RECEIPT",
	})
	s.enrichInboundLines(ctx, companyID, result.Inbound)
	inboundMovements, _ := s.repo.LoadInboundMovements(ctx, id, companyID)
	s.notifyReceiptAccepted(bundle.Head, result.TotalDebt, result.DebtCurrency, result.Status)

	return map[string]any{
		"success":          true,
		"warehouseId":      warehouseID,
		"warehouseName":    warehouseName,
		"inbound":          result.Inbound,
		"inboundMovements": inboundMovementsToMap(inboundMovements),
	}, nil
}

func (s *Service) Reject(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	_ = userID
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	bundle, err := s.repo.LoadReceiptBundleTx(ctx, tx, id, companyID, true)
	if err != nil {
		return nil, err
	}
	if bundle.Head.BuyerCompanyID != companyID {
		return nil, errBadRequest("Faqat xaridor rad eta oladi")
	}
	if _, err := tx.Exec(ctx, `UPDATE "GoodsReceipt" SET status = 'REJECTED', "updatedAt" = NOW() WHERE id = $1`, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	s.notifyReceiptRejected(bundle.Head)
	return map[string]any{
		"id":      id,
		"status":  "REJECTED",
		"success": true,
	}, nil
}

type acceptanceResult struct {
	Status       string
	TotalDebt    float64
	DebtCurrency string
	Inbound      []map[string]any
}

func (s *Service) processAcceptanceTx(
	ctx context.Context,
	tx pgx.Tx,
	bundle *ReceiptBundle,
	companyID, userID, warehouseID string,
	note *string,
	qtyOverride map[string]float64,
	allowImplicit bool,
	forcePartial bool,
) (*acceptanceResult, error) {
	mappings, err := s.repo.LoadMappings(ctx, companyID, bundle.Head.SellerCompanyID)
	if err != nil {
		return nil, err
	}
	sellerVariants, err := s.loadSellerVariants(ctx, bundle)
	if err != nil {
		return nil, err
	}

	cacheResolved := make(map[string]string)
	cacheVariantCompany := make(map[string]bool)
	defaultCategoryID := ""
	defaultWarehouseID := ""

	lines := make([]stock.Line, 0)
	inbound := make([]map[string]any, 0)
	totalDebt := 0.0
	debtCurrency := "UZS"
	processed := 0
	allLinesFull := true

	for i := range bundle.Items {
		item := bundle.Items[i]
		shipped := toFiniteMoney(item.Quantity)
		received := 0.0
		if val, ok := qtyOverride[item.ID]; ok {
			received = toFiniteMoney(val)
		} else if allowImplicit {
			received = shipped
		}
		if received < 0 {
			return nil, errBadRequest("Qabul miqdori manfiy bo'lishi mumkin emas")
		}
		if received > shipped {
			return nil, errBadRequest(fmt.Sprintf("Qabul miqdori jo'natilgan miqdordan oshib ketdi: %s", item.ProductNameSnapshot))
		}
		if received <= 0 {
			allLinesFull = false
			continue
		}
		if received < shipped {
			allLinesFull = false
		}
		processed++

		orderItem := s.findOrderItemForReceiptLine(bundle, item)
		expectedPrice := 0.0
		expectedCurrency := "UZS"
		if orderItem != nil {
			expectedPrice = toFiniteMoney(orderItem.ExpectedPrice)
			expectedCurrency = normalizeCurrency(orderItem.ExpectedCurrency)
		}
		debtCurrency = expectedCurrency

		ownVariantID, mappingKind, sellerVariantID, err := s.resolveOrCreateOwnVariantTx(
			ctx,
			tx,
			bundle,
			item,
			orderItem,
			companyID,
			userID,
			sellerVariants,
			&mappings,
			cacheResolved,
			cacheVariantCompany,
			&defaultCategoryID,
			&defaultWarehouseID,
		)
		if err != nil {
			return nil, err
		}

		lineNote := "Yuk qabul qilindi"
		if forcePartial || received < shipped {
			lineNote = "Yuk qisman qabul qilindi"
		}
		if note != nil && strings.TrimSpace(*note) != "" {
			lineNote = strings.TrimSpace(*note)
		}

		lines = append(lines, stock.Line{
			WarehouseID:      warehouseID,
			ProductVariantID: ownVariantID,
			Quantity:         received,
			SourceID:         bundle.Head.ID,
			Note:             fmt.Sprintf("%s: %s", lineNote, bundle.Head.ID),
		})

		if _, err := tx.Exec(ctx, `
			UPDATE "GoodsReceiptItem"
			SET "productVariantId" = $2, "receivedQuantity" = $3
			WHERE id = $1
		`, item.ID, ownVariantID, received); err != nil {
			return nil, err
		}

		totalDebt += expectedPrice * received
		inbound = append(inbound, map[string]any{
			"productNameSnapshot": item.ProductNameSnapshot,
			"variantName":         item.ProductNameSnapshot,
			"productName":         "",
			"quantity":            received,
			"mappingKind":         mappingKind,
			"ownVariantId":        ownVariantID,
			"sellerVariantId":     sellerVariantID,
		})
	}

	if processed == 0 {
		return nil, errBadRequest("Kamida bitta mahsulot uchun qabul miqdori 0 dan katta bo'lishi kerak")
	}

	if err := stock.RecordMovements(ctx, tx, companyID, userID, "IN", "GOODS_RECEIPT", lines); err != nil {
		if errors.Is(err, stock.ErrInsufficientStock) {
			return nil, errBadRequest(err.Error())
		}
		return nil, err
	}

	nextStatus := "PARTIALLY_ACCEPTED"
	if !forcePartial && allLinesFull {
		nextStatus = "ACCEPTED"
	}
	if _, err := tx.Exec(ctx, `
		UPDATE "GoodsReceipt"
		SET status = $2, "receivedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $1
	`, bundle.Head.ID, nextStatus); err != nil {
		return nil, err
	}

	if totalDebt > 0 {
		_, err := tx.Exec(ctx, `
			INSERT INTO "DebtEntry" (
				id, "debtorId", "creditorId", amount, "remainingAmount", currency, "receiptId", status, "createdAt", "updatedAt"
			)
			VALUES (
				gen_random_uuid()::text, $1, $2, $3, $3, $4, $5, 'OPEN', NOW(), NOW()
			)
		`, bundle.Head.BuyerCompanyID, bundle.Head.SellerCompanyID, totalDebt, debtCurrency, bundle.Head.ID)
		if err != nil {
			return nil, err
		}
	}

	if !forcePartial {
		orderStatus, err := s.resolveOrderStatusAfterReceiptTx(ctx, tx, bundle.Head.OrderID)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE "B2BOrder" SET status = $2, "updatedAt" = NOW() WHERE id = $1`, bundle.Head.OrderID, orderStatus); err != nil {
			return nil, err
		}
	}

	return &acceptanceResult{
		Status:       nextStatus,
		TotalDebt:    totalDebt,
		DebtCurrency: debtCurrency,
		Inbound:      inbound,
	}, nil
}

func (s *Service) variantInCompanyTx(ctx context.Context, tx pgx.Tx, companyID, variantID string, cache map[string]bool) (bool, error) {
	key := companyID + ":" + variantID
	if v, ok := cache[key]; ok {
		return v, nil
	}
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "ProductVariant"
			WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
		)
	`, variantID, companyID).Scan(&exists); err != nil {
		return false, err
	}
	cache[key] = exists
	return exists, nil
}

func (s *Service) resolveOrCreateOwnVariantTx(
	ctx context.Context,
	tx pgx.Tx,
	bundle *ReceiptBundle,
	item ReceiptItemRecord,
	orderItem *OrderItemRecord,
	companyID, userID string,
	sellerVariants map[string]VariantLite,
	mappings *[]MappingRecord,
	resolutionCache map[string]string,
	variantCompanyCache map[string]bool,
	defaultCategoryID *string,
	defaultWarehouseID *string,
) (string, string, string, error) {
	sellerVariantID := s.resolveSellerVariantID(bundle, item, sellerVariants)
	cacheKey := "name:" + normalizeKey(item.ProductNameSnapshot)
	if sellerVariantID != "" {
		cacheKey = "sv:" + sellerVariantID
	}
	if v, ok := resolutionCache[cacheKey]; ok && v != "" {
		return v, "EXISTING", sellerVariantID, nil
	}

	if item.ProductVariantID != nil && strings.TrimSpace(*item.ProductVariantID) != "" {
		ok, err := s.variantInCompanyTx(ctx, tx, companyID, *item.ProductVariantID, variantCompanyCache)
		if err != nil {
			return "", "", sellerVariantID, err
		}
		if ok {
			resolutionCache[cacheKey] = *item.ProductVariantID
			return *item.ProductVariantID, "EXISTING", sellerVariantID, nil
		}
	}

	var sellerVariant *VariantLite
	if sellerVariantID != "" {
		if sv, ok := sellerVariants[sellerVariantID]; ok {
			sellerVariant = &sv
		}
	}

	mapping := s.resolveMapping(*mappings, sellerVariantID, item.ProductNameSnapshot, sellerVariant)
	if mapping != nil {
		ok, err := s.variantInCompanyTx(ctx, tx, companyID, mapping.OwnProductVariantID, variantCompanyCache)
		if err != nil {
			return "", "", sellerVariantID, err
		}
		if ok {
			resolutionCache[cacheKey] = mapping.OwnProductVariantID
			return mapping.OwnProductVariantID, "EXISTING", sellerVariantID, nil
		}
	}

	if sellerVariant != nil {
		var byCodeID string
		sku := ""
		barcode := ""
		if sellerVariant.SKU != nil {
			sku = strings.TrimSpace(*sellerVariant.SKU)
		}
		if sellerVariant.Barcode != nil {
			barcode = strings.TrimSpace(*sellerVariant.Barcode)
		}
		if sku != "" || barcode != "" {
			err := tx.QueryRow(ctx, `
				SELECT id
				FROM "ProductVariant"
				WHERE "companyId" = $1
				  AND status = 'ACTIVE'
				  AND (
					($2 <> '' AND sku = $2)
					OR ($3 <> '' AND barcode = $3)
				  )
				ORDER BY "updatedAt" DESC
				LIMIT 1
			`, companyID, sku, barcode).Scan(&byCodeID)
			if err == nil && byCodeID != "" {
				if err := s.upsertMappingTx(ctx, tx, companyID, bundle.Head.SellerCompanyID, userID, item.ProductNameSnapshot, sellerVariantID, barcode, byCodeID); err == nil {
					*mappings = append(*mappings, MappingRecord{
						PartnerProductName:  item.ProductNameSnapshot,
						PartnerSKU:          ptrIfNotEmpty(sellerVariantID),
						PartnerBarcode:      ptrIfNotEmpty(barcode),
						OwnProductVariantID: byCodeID,
					})
				}
				resolutionCache[cacheKey] = byCodeID
				return byCodeID, "EXISTING", sellerVariantID, nil
			}
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return "", "", sellerVariantID, err
			}
		}
	}

	expectedPrice := 0.0
	expectedCurrency := "UZS"
	if orderItem != nil {
		expectedPrice = toFiniteMoney(orderItem.ExpectedPrice)
		expectedCurrency = normalizeCurrency(orderItem.ExpectedCurrency)
	}

	ownVariantID, err := s.createAutoVariantTx(
		ctx, tx, companyID, userID, item.ProductNameSnapshot, expectedPrice, expectedCurrency,
		sellerVariant, defaultCategoryID, defaultWarehouseID,
	)
	if err != nil {
		return "", "", sellerVariantID, err
	}
	barcode := ""
	if sellerVariant != nil && sellerVariant.Barcode != nil {
		barcode = strings.TrimSpace(*sellerVariant.Barcode)
	}
	_ = s.upsertMappingTx(ctx, tx, companyID, bundle.Head.SellerCompanyID, userID, item.ProductNameSnapshot, sellerVariantID, barcode, ownVariantID)
	*mappings = append(*mappings, MappingRecord{
		PartnerProductName:  item.ProductNameSnapshot,
		PartnerSKU:          ptrIfNotEmpty(sellerVariantID),
		PartnerBarcode:      ptrIfNotEmpty(barcode),
		OwnProductVariantID: ownVariantID,
	})
	resolutionCache[cacheKey] = ownVariantID
	return ownVariantID, "NEW", sellerVariantID, nil
}

func (s *Service) resolveOrderStatusAfterReceiptTx(ctx context.Context, tx pgx.Tx, orderID string) (string, error) {
	rows, err := tx.Query(ctx, `
		SELECT "productVariantId", quantity
		FROM "B2BOrderItem"
		WHERE "orderId" = $1
	`, orderID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	orderQty := make(map[string]float64)
	for rows.Next() {
		var variantID *string
		var qty float64
		if err := rows.Scan(&variantID, &qty); err != nil {
			return "", err
		}
		if variantID != nil {
			orderQty[*variantID] += qty
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}

	sentRows, err := tx.Query(ctx, `
		SELECT di."productVariantId", COALESCE(SUM(di.quantity), 0)::float8
		FROM "DispatchItem" di
		JOIN "Dispatch" d ON d.id = di."dispatchId"
		WHERE d."orderId" = $1 AND d.status = 'SENT'
		GROUP BY di."productVariantId"
	`, orderID)
	if err != nil {
		return "", err
	}
	defer sentRows.Close()

	sentQty := make(map[string]float64)
	for sentRows.Next() {
		var variantID string
		var qty float64
		if err := sentRows.Scan(&variantID, &qty); err != nil {
			return "", err
		}
		sentQty[variantID] = qty
	}
	if err := sentRows.Err(); err != nil {
		return "", err
	}

	for variantID, ordered := range orderQty {
		if sentQty[variantID] < ordered {
			return "PARTIALLY_DISPATCHED", nil
		}
	}
	return "RECEIVED", nil
}

func (s *Service) ensureDefaultCategoryTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID string,
	defaultCategoryID *string,
	defaultWarehouseID *string,
) (string, error) {
	if strings.TrimSpace(*defaultCategoryID) != "" {
		return *defaultCategoryID, nil
	}
	var catID string
	err := tx.QueryRow(ctx, `
		SELECT id
		FROM "ProductCategory"
		WHERE "companyId" = $1 AND status = 'ACTIVE'
		ORDER BY "updatedAt" DESC
		LIMIT 1
	`, companyID).Scan(&catID)
	if err == nil {
		*defaultCategoryID = catID
		return catID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	warehouseID := strings.TrimSpace(*defaultWarehouseID)
	if warehouseID == "" {
		if err := tx.QueryRow(ctx, `
			SELECT id
			FROM "Warehouse"
			WHERE "companyId" = $1 AND status = 'ACTIVE'
			ORDER BY "updatedAt" DESC
			LIMIT 1
		`, companyID).Scan(&warehouseID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", errBadRequest("Faol ombor topilmadi")
			}
			return "", err
		}
		*defaultWarehouseID = warehouseID
	}

	if err := tx.QueryRow(ctx, `
		INSERT INTO "ProductCategory" (
			id, "companyId", "warehouseId", name, status, "createdAt", "updatedAt"
		)
		VALUES (
			gen_random_uuid()::text, $1, $2, 'Boshqa', 'ACTIVE', NOW(), NOW()
		)
		RETURNING id
	`, companyID, warehouseID).Scan(&catID); err != nil {
		return "", err
	}
	*defaultCategoryID = catID
	return catID, nil
}

func (s *Service) createAutoVariantTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, userID, snapshot string,
	expectedPrice float64,
	expectedCurrency string,
	sellerVariant *VariantLite,
	defaultCategoryID *string,
	defaultWarehouseID *string,
) (string, error) {
	categoryID, err := s.ensureDefaultCategoryTx(ctx, tx, companyID, defaultCategoryID, defaultWarehouseID)
	if err != nil {
		return "", err
	}

	productName, variantName := parseSnapshotParts(snapshot)
	var productID string
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM "Product"
		WHERE "companyId" = $1 AND status = 'ACTIVE' AND LOWER(name) = LOWER($2)
		ORDER BY "updatedAt" DESC
		LIMIT 1
	`, companyID, productName).Scan(&productID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		if err := tx.QueryRow(ctx, `
			INSERT INTO "Product" (
				id, "companyId", name, "categoryId", unit, type, status, "createdBy", "createdAt", "updatedAt"
			)
			VALUES (
				gen_random_uuid()::text, $1, $2, $3, 'dona', 'GOODS', 'ACTIVE', $4, NOW(), NOW()
			)
			RETURNING id
		`, companyID, productName, categoryID, userID).Scan(&productID); err != nil {
			return "", err
		}
	}

	var existingVariantID string
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM "ProductVariant"
		WHERE "companyId" = $1
		  AND "productId" = $2
		  AND status = 'ACTIVE'
		  AND LOWER(name) = LOWER($3)
		LIMIT 1
	`, companyID, productID, variantName).Scan(&existingVariantID)
	if err == nil && existingVariantID != "" {
		_, _ = tx.Exec(ctx, `
			UPDATE "ProductVariant"
			SET "purchasePrice" = CASE WHEN $2 > 0 THEN $2 ELSE "purchasePrice" END,
			    currency = $3,
			    "updatedAt" = NOW()
			WHERE id = $1
		`, existingVariantID, expectedPrice, normalizeCurrency(expectedCurrency))
		return existingVariantID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	sku := ""
	barcode := ""
	if sellerVariant != nil {
		if sellerVariant.SKU != nil {
			sku = strings.TrimSpace(*sellerVariant.SKU)
		}
		if sellerVariant.Barcode != nil {
			barcode = strings.TrimSpace(*sellerVariant.Barcode)
		}
	}

	if sku != "" {
		free, err := s.isSKUFreeTx(ctx, tx, companyID, sku)
		if err != nil {
			return "", err
		}
		if !free {
			sku = ""
		}
	}
	if barcode != "" {
		free, err := s.isBarcodeFreeTx(ctx, tx, companyID, barcode)
		if err != nil {
			return "", err
		}
		if !free {
			barcode = ""
		}
	}

	var variantID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "ProductVariant" (
			id, "companyId", "productId", name, sku, barcode, "salePrice", "purchasePrice", currency, status, "createdBy", "createdAt", "updatedAt"
		)
		VALUES (
			gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, NOW(), NOW()
		)
		RETURNING id
	`, companyID, productID, variantName, nullIfEmpty(sku), nullIfEmpty(barcode), expectedPrice, expectedPrice, normalizeCurrency(expectedCurrency), userID).Scan(&variantID)
	if err != nil {
		return "", err
	}
	return variantID, nil
}

func (s *Service) isSKUFreeTx(ctx context.Context, tx pgx.Tx, companyID, sku string) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "ProductVariant"
			WHERE "companyId" = $1 AND sku = $2
		)
	`, companyID, sku).Scan(&exists); err != nil {
		return false, err
	}
	return !exists, nil
}

func (s *Service) isBarcodeFreeTx(ctx context.Context, tx pgx.Tx, companyID, barcode string) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "ProductVariant"
			WHERE "companyId" = $1 AND barcode = $2
		)
	`, companyID, barcode).Scan(&exists); err != nil {
		return false, err
	}
	return !exists, nil
}

func (s *Service) upsertMappingTx(
	ctx context.Context,
	tx pgx.Tx,
	companyID, partnerCompanyID, userID, partnerProductName, sellerVariantID, partnerBarcode, ownVariantID string,
) error {
	var existingID string
	if strings.TrimSpace(sellerVariantID) != "" {
		err := tx.QueryRow(ctx, `
			SELECT id
			FROM "ProductMapping"
			WHERE "companyId" = $1
			  AND "partnerCompanyId" = $2
			  AND status = 'ACTIVE'
			  AND "partnerSku" = $3
			LIMIT 1
		`, companyID, partnerCompanyID, sellerVariantID).Scan(&existingID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
	}
	if existingID == "" {
		err := tx.QueryRow(ctx, `
			SELECT id
			FROM "ProductMapping"
			WHERE "companyId" = $1
			  AND "partnerCompanyId" = $2
			  AND status = 'ACTIVE'
			  AND LOWER("partnerProductName") = LOWER($3)
			LIMIT 1
		`, companyID, partnerCompanyID, partnerProductName).Scan(&existingID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
	}

	if existingID != "" {
		_, err := tx.Exec(ctx, `
			UPDATE "ProductMapping"
			SET "ownProductVariantId" = $2,
			    "partnerBarcode" = COALESCE($3, "partnerBarcode"),
			    status = 'ACTIVE',
			    "updatedAt" = NOW()
			WHERE id = $1
		`, existingID, ownVariantID, nullIfEmpty(partnerBarcode))
		return err
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO "ProductMapping" (
			id, "companyId", "partnerCompanyId", "partnerProductName",
			"partnerSku", "partnerBarcode", "ownProductVariantId",
			"conversionRatio", status, "createdBy", "createdAt", "updatedAt"
		)
		VALUES (
			gen_random_uuid()::text, $1, $2, $3,
			$4, $5, $6,
			1, 'ACTIVE', $7, NOW(), NOW()
		)
	`, companyID, partnerCompanyID, partnerProductName, nullIfEmpty(sellerVariantID), nullIfEmpty(partnerBarcode), ownVariantID, userID)
	return err
}

func (s *Service) enrichInboundLines(ctx context.Context, companyID string, inbound []map[string]any) {
	ids := make([]string, 0, len(inbound))
	seen := make(map[string]struct{})
	for i := range inbound {
		id := mapAnyString(inbound[i]["ownVariantId"])
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}
	variants, err := s.repo.LoadVariantsByIDs(ctx, companyID, ids)
	if err != nil {
		return
	}
	for i := range inbound {
		id := mapAnyString(inbound[i]["ownVariantId"])
		if v, ok := variants[id]; ok {
			inbound[i]["variantName"] = v.Name
			inbound[i]["productName"] = v.ProductName
		}
	}
}

func (s *Service) notifyReceiptAccepted(head ReceiptRecord, totalDebt float64, currency, status string) {
	if s.notify == nil {
		return
	}
	cur := normalizeCurrency(currency)
	isPartial := status == "PARTIALLY_ACCEPTED"
	title := "Yuk qabul qilindi"
	sellerMsg := fmt.Sprintf("%s jo'natmani to'liq qabul qildi.", head.BuyerName)
	level := "SUCCESS"
	event := "receipt.accepted"
	buyerTitle := "Qabul qilish muvaffaqiyatli"
	buyerMsg := fmt.Sprintf("Jo'natma muvaffaqiyatli qabul qilindi. Qarz summasi: %.2f %s.", totalDebt, cur)
	if isPartial {
		title = "Yuk qisman qabul qilindi"
		sellerMsg = fmt.Sprintf("%s jo'natmani qisman qabul qildi.", head.BuyerName)
		level = "WARNING"
		event = "receipt.partial_accepted"
		buyerTitle = "Qisman qabul muvaffaqiyatli"
		buyerMsg = fmt.Sprintf("Jo'natma qisman qabul qilindi. Qarz summasi: %.2f %s.", totalDebt, cur)
	}
	roles := []string{"OWNER", "MANAGER", "SALES", "WAREHOUSE"}
	go func() {
		ctx := context.Background()
		_ = s.notify.NotifyCompany(ctx, head.SellerCompanyID, title, sellerMsg, level,
			&notifications.TelegramPayload{
				ModuleKey: "B2B", EventKey: event,
				Details: map[string]any{
					"receiptId": head.ID, "orderId": head.OrderID, "amount": totalDebt, "status": status,
				},
				TargetRoles: roles,
			}, "", 5*time.Minute)
		_ = s.notify.NotifyCompany(ctx, head.BuyerCompanyID, buyerTitle, buyerMsg, level, nil, "", 0)
	}()
}

func (s *Service) notifyReceiptRejected(head ReceiptRecord) {
	if s.notify == nil {
		return
	}
	roles := []string{"OWNER", "MANAGER", "SALES", "WAREHOUSE"}
	go func() {
		_ = s.notify.NotifyCompany(context.Background(), head.SellerCompanyID,
			"Yuk rad etildi",
			fmt.Sprintf("%s jo'natmani rad etdi.", head.BuyerName),
			"WARNING",
			&notifications.TelegramPayload{
				ModuleKey: "B2B", EventKey: "receipt.rejected",
				Details: map[string]any{"receiptId": head.ID, "orderId": head.OrderID, "status": "REJECTED"},
				TargetRoles: roles,
			}, "", 5*time.Minute)
	}()
}

func inboundMovementsToMap(items []InboundMovement) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for i := range items {
		out = append(out, map[string]any{
			"warehouseId":      items[i].WarehouseID,
			"warehouseName":    items[i].WarehouseName,
			"productVariantId": items[i].ProductVariantID,
			"productName":      items[i].ProductName,
			"variantName":      items[i].VariantName,
			"sku":              items[i].SKU,
			"quantity":         items[i].Quantity,
		})
	}
	return out
}

func mapAnyString(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case *string:
		if t == nil {
			return ""
		}
		return *t
	default:
		return fmt.Sprintf("%v", t)
	}
}

func mapAnyMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	if m == nil {
		return map[string]any{}
	}
	return m
}

func mapAnyItems(v any) []map[string]any {
	items, _ := v.([]map[string]any)
	if items == nil {
		return []map[string]any{}
	}
	return items
}

func nullIfEmpty(v string) any {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return v
}

func ptrIfNotEmpty(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}
