package partnerledger

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

var qtySummaryRe = regexp.MustCompile(`^(.+?)\s*[×x]\s*([\d.,]+)$`)

func (s *Service) GetSaleCatalog(ctx context.Context, companyID, warehouseID string, search, pageStr, limitStr *string) (map[string]any, error) {
	warehouseID = strings.TrimSpace(warehouseID)
	if warehouseID == "" {
		return nil, errBadRequest("warehouseId majburiy")
	}
	whName, err := s.repo.WarehouseExists(ctx, warehouseID, companyID)
	if err != nil {
		return nil, err
	}
	searchVal := ""
	if search != nil {
		searchVal = *search
	}
	page, limit := parsePageLimit(derefStr(pageStr, "1"), derefStr(limitStr, "60"))
	if limit > 200 {
		limit = 200
	}
	if limit < 1 {
		limit = 60
	}
	total, err := s.repo.CountSaleCatalog(ctx, companyID, warehouseID, searchVal)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListSaleCatalog(ctx, companyID, warehouseID, searchVal, page, limit)
	if err != nil {
		return nil, err
	}
	skip := (page - 1) * limit
	return map[string]any{
		"warehouse": map[string]any{"id": warehouseID, "name": whName},
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}, nil
}

func (s *Service) PreviewSaleOrderExcel(ctx context.Context, companyID, warehouseID string, fileData []byte) (map[string]any, error) {
	whName, err := s.repo.WarehouseExists(ctx, warehouseID, companyID)
	if err != nil {
		return nil, err
	}
	parsed, err := loadPartnerOrderRowsFromBuffer(fileData)
	if err != nil {
		return nil, err
	}
	if len(parsed) == 0 {
		return nil, errBadRequest("Buyurtma qatorlari topilmadi. «Buyurtma» varag'ini tekshiring.")
	}

	variants, err := s.repo.ListWarehouseVariants(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	candidates := make([]orderVariantCandidate, len(variants))
	bySku := map[string]int{}
	for i, v := range variants {
		candidates[i] = orderVariantCandidate{
			ID: v.ID, Name: v.Name, SKU: v.SKU, Barcode: v.Barcode, ProductName: v.ProductName,
		}
		if v.SKU != nil {
			key := strings.ToLower(strings.TrimSpace(*v.SKU))
			bySku[key]++
		}
	}

	lines := []map[string]any{}
	errs := []map[string]any{}
	for _, row := range parsed {
		if row.Quantity <= 0 {
			errs = append(errs, map[string]any{
				"rowNumber": row.RowNumber, "message": "Miqdor noto'g'ri yoki kiritilmagan",
				"sku": nilIfEmptyStr(row.SKU), "barcode": nilIfEmptyStr(row.Barcode),
			})
			continue
		}
		matched := matchPartnerOrderVariant(row, candidates)
		if matched == nil {
			skuKey := strings.ToLower(strings.TrimSpace(row.SKU))
			ambiguous := skuKey != "" && bySku[skuKey] > 1 && row.VariantHint == ""
			msg := "Mahsulot topilmadi (SKU, shtrix-kod yoki mahsulot + variant)"
			if ambiguous {
				msg = "Bir nechta variant topildi — «Variant» ustunini kiriting (masalan: Tilla)"
			}
			errs = append(errs, map[string]any{
				"rowNumber": row.RowNumber, "message": msg,
				"sku": nilIfEmptyStr(row.SKU), "barcode": nilIfEmptyStr(row.Barcode),
			})
			continue
		}
		var v variantRow
		for _, item := range variants {
			if item.ID == matched.ID {
				v = item
				break
			}
		}
		line := map[string]any{
			"rowNumber": row.RowNumber, "productVariantId": v.ID,
			"productName": v.ProductName, "name": v.Name,
			"sku": v.SKU, "barcode": v.Barcode,
			"salePrice": v.SalePrice, "currency": NormalizeCurrency(v.Currency),
			"stockQty": v.StockQty, "quantity": row.Quantity,
			"lineTotal": row.Quantity * v.SalePrice,
		}
		lines = append(lines, line)
		if row.Quantity > v.StockQty {
			errs = append(errs, map[string]any{
				"rowNumber": row.RowNumber,
				"message":   fmt.Sprintf("Omborda yetarli emas (mavjud: %v)", v.StockQty),
				"sku":       v.SKU,
			})
		}
	}

	validCount := len(lines)
	for _, e := range errs {
		if msg, _ := e["message"].(string); strings.Contains(msg, "yetarli") {
			validCount--
		}
	}
	return map[string]any{
		"warehouse": map[string]any{"id": warehouseID, "name": whName},
		"lines": lines, "errors": errs, "validCount": validCount,
	}, nil
}

func (s *Service) CreateSaleOrder(ctx context.Context, companyID, userID, contactID string, input CreatePartnerLedgerSaleOrderInput) (map[string]any, error) {
	contactName, telegramChatID, err := s.repo.GetContactBrief(ctx, companyID, contactID)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.WarehouseExists(ctx, input.WarehouseID, companyID); err != nil {
		return nil, err
	}

	lines := []PartnerLedgerSaleLineInput{}
	for _, l := range input.Lines {
		if l.Quantity > 0 {
			lines = append(lines, l)
		}
	}
	if len(lines) == 0 {
		return nil, errBadRequest("Kamida bitta qator kerak")
	}

	ids := uniqueVariantIDs(lines)
	variantMap, err := s.repo.LoadVariantsByIDs(ctx, companyID, ids)
	if err != nil {
		return nil, err
	}
	if len(variantMap) != len(ids) {
		return nil, errBadRequest("Ba'zi mahsulot variantlari topilmadi")
	}

	dispatchLines := make([]stock.DispatchLine, len(lines))
	for i, l := range lines {
		v := variantMap[l.ProductVariantID]
		dispatchLines[i] = stock.DispatchLine{
			ProductVariantID: l.ProductVariantID,
			Quantity:         l.Quantity,
			Label:            fmt.Sprintf("%s / %s", v.ProductName, v.Name),
		}
	}
	if err := stock.AssertDispatchStockAvailablePool(ctx, s.pool, companyID, input.WarehouseID, dispatchLines); err != nil {
		return nil, err
	}

	operationDate := time.Now()
	if input.OperationDate != nil && strings.TrimSpace(*input.OperationDate) != "" {
		operationDate, err = parseOperationDate(*input.OperationDate)
		if err != nil {
			return nil, errBadRequest("Sana noto'g'ri")
		}
	}

	amountTotals := map[string]float64{}
	summaryParts := []string{}
	var totalQty float64
	for _, line := range lines {
		v := variantMap[line.ProductVariantID]
		totalQty += line.Quantity
		for _, a := range buildAmountsFromVariant(v.SalePrice, v.PurchasePrice, v.Currency, line.Quantity, "OUT") {
			if a.Amount > 0 {
				cur := NormalizeCurrency(a.Currency)
				amountTotals[cur] += a.Amount
			}
		}
		sku := ""
		if v.SKU != nil && *v.SKU != "" {
			sku = " [" + *v.SKU + "]"
		}
		summaryParts = append(summaryParts, fmt.Sprintf("%s / %s%s ×%v", v.ProductName, v.Name, sku, line.Quantity))
	}

	ledgerAmounts := []amountLine{}
	for cur, amt := range amountTotals {
		if amt > 0 {
			ledgerAmounts = append(ledgerAmounts, amountLine{Amount: amt, Currency: cur})
		}
	}
	if len(ledgerAmounts) == 0 {
		return nil, errBadRequest("Buyurtma summasi 0 — mahsulotlarning sotuv narxini tekshiring")
	}

	productSummary := strings.Join(summaryParts, "; ")
	if len(summaryParts) > 6 {
		productSummary = strings.Join(summaryParts[:5], "; ") + fmt.Sprintf("; +%d ta", len(summaryParts)-5)
	}
	ledgerNotes := buildLedgerNotes(input, contactName)
	batchID := uuid.NewString()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	movementIDs := []string{}
	for _, line := range lines {
		movementID, err := stock.RecordOneOutInTx(ctx, tx, companyID, userID, "MANUAL", stock.Line{
			WarehouseID:      input.WarehouseID,
			ProductVariantID: line.ProductVariantID,
			Quantity:         line.Quantity,
			SourceID:         batchID,
			Note:             fmt.Sprintf("Hamkor sotuvi: %s", contactName),
		})
		if err != nil {
			return nil, err
		}
		movementIDs = append(movementIDs, movementID)
	}

	qtyPtr := totalQty
	operationIDs, err := recordFromStockOutboundTx(ctx, tx, companyID, userID, contactID,
		"PARTNER_SALE_ORDER", batchID, ledgerAmounts, &qtyPtr, productSummary, ledgerNotes, operationDate)
	if err != nil {
		return nil, err
	}

	comment := "Seller tomonidan tasdiqlandi"
	if err := s.repo.AppendSaleOrderStatusTx(ctx, tx, companyID, contactID, batchID, "ACCEPTED", "BOT", &comment, &userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": input.WarehouseID,
		"reason":      "PARTNER_SALE_ORDER",
	})

	totalsText := formatTotalsText(ledgerAmounts)
	qtyText := formatNumber(totalQty)
	if telegramChatID != nil && strings.TrimSpace(*telegramChatID) != "" {
		_ = s.notify.EnqueueChatTelegram(ctx, companyID, *telegramChatID,
			"Buyurtmangiz tasdiqlandi",
			strings.Join([]string{
				"Hamkor: " + contactName,
				"Buyurtma raqami: " + batchID,
				"Jami summa: " + totalsText,
				"Miqdor: " + qtyText,
			}, "\n"),
			"SUCCESS",
			&notifications.TelegramPayload{
				ModuleKey: "PARTNER_LEDGER", EventKey: "partner_ledger.sale_order.confirmed",
				Details: map[string]any{"batchId": batchID, "totalQty": totalQty, "totals": totalsText},
			},
			fmt.Sprintf("%s:PARTNER_LEDGER:partner_ledger.sale_order.confirmed:chat:%s", companyID, batchID),
			false,
		)
	}
	_ = s.notify.NotifyCompanyRoles(ctx, companyID, []string{"OWNER", "MANAGER"},
		"Hamkor sotuvi tasdiqlandi",
		fmt.Sprintf("%s: %s · %s dona", contactName, totalsText, qtyText),
		"SUCCESS", "PARTNER_LEDGER", "partner_ledger.sale_order.confirmed")

	return map[string]any{
		"batchId": batchID, "movementIds": movementIDs, "operationIds": operationIDs,
		"totals": amountsToMaps(ledgerAmounts), "productSummary": productSummary,
		"contactName": contactName,
	}, nil
}

func (s *Service) SendSaleOrderToPartner(ctx context.Context, companyID, userID, contactID, batchID string) (map[string]any, error) {
	contactName, telegramChatID, err := s.repo.GetContactBrief(ctx, companyID, contactID)
	if err != nil {
		return nil, err
	}
	if telegramChatID == nil || strings.TrimSpace(*telegramChatID) == "" {
		return nil, ErrTelegramNotLinked
	}

	detail, err := s.getSaleOrderLines(ctx, companyID, contactID, batchID)
	if err != nil {
		return nil, err
	}
	totals, _ := detail["totals"].([]map[string]any)
	lines, _ := detail["lines"].([]map[string]any)
	totalsText := formatTotalsFromMaps(totals)
	linesCount := len(lines)

	chatMsg := strings.Join([]string{
		"Hamkor: " + contactName,
		"Buyurtma raqami: " + batchID,
		fmt.Sprintf("Qatorlar: %d", linesCount),
		"Jami summa: " + totalsText,
		"", "Quyidan holatni tanlang:",
	}, "\n")
	tgPayload := &notifications.TelegramPayload{
		ModuleKey: "PARTNER_LEDGER", EventKey: "partner_ledger.sale_order.dispatched",
		Details: map[string]any{"batchId": batchID, "linesCount": linesCount, "totals": totalsText},
		Actions: []notifications.TelegramAction{
			{Key: "PL_ORDER_ACCEPT", Label: "✅ Qabul qildim", TargetType: "PARTNER_LEDGER_ORDER", TargetID: batchID},
			{Key: "PL_ORDER_PARTIAL", Label: "🟨 Qisman", TargetType: "PARTNER_LEDGER_ORDER", TargetID: batchID},
			{Key: "PL_ORDER_REJECT", Label: "❌ Qabul qilmadim", TargetType: "PARTNER_LEDGER_ORDER", TargetID: batchID},
		},
	}
	dedupKey := fmt.Sprintf("%s:PARTNER_LEDGER:partner_ledger.sale_order.dispatched:chat:%s", companyID, batchID)
	if err := s.notify.EnqueueChatTelegram(ctx, companyID, *telegramChatID,
		"Buyurtma yo'lga chiqdi", chatMsg, "INFO", tgPayload, dedupKey, true); err != nil {
		return nil, err
	}

	_ = s.notify.NotifyCompanyRoles(ctx, companyID, []string{"OWNER", "MANAGER"},
		"Buyurtma hamkorga yuborildi",
		fmt.Sprintf("%s: %d qator · %s", contactName, linesCount, totalsText),
		"INFO", "PARTNER_LEDGER", "partner_ledger.sale_order.dispatched")

	if err := s.repo.AppendSaleOrderStatus(ctx, companyID, contactID, batchID, "SENT", "BOT", nil, &userID); err != nil {
		return nil, err
	}
	return map[string]any{"ok": true}, nil
}

func (s *Service) GetSaleOrderLines(ctx context.Context, companyID, contactID, batchID string) (map[string]any, error) {
	return s.getSaleOrderLines(ctx, companyID, contactID, batchID)
}

func (s *Service) getSaleOrderLines(ctx context.Context, companyID, contactID, batchID string) (map[string]any, error) {
	opID, err := s.repo.FindSaleOrderOperationID(ctx, companyID, contactID, batchID)
	if err != nil {
		return nil, err
	}
	detail, err := s.getOperationLines(ctx, companyID, opID)
	if err != nil {
		return nil, err
	}
	detail["batchId"] = batchID
	return detail, nil
}

func (s *Service) GetOperationLines(ctx context.Context, companyID, operationID string) (map[string]any, error) {
	return s.getOperationLines(ctx, companyID, operationID)
}

func (s *Service) getOperationLines(ctx context.Context, companyID, operationID string) (map[string]any, error) {
	op, err := s.repo.FindOperation(ctx, companyID, operationID)
	if err != nil {
		return nil, err
	}

	lines := []map[string]any{}
	priceField := "sale"
	if op.Type == "MATERIAL_IN" {
		priceField = "purchase"
	}

	if op.SourceType != nil && op.SourceID != nil {
		switch *op.SourceType {
		case "PARTNER_SALE_ORDER":
			movements, err := s.repo.LoadMovementsByBatch(ctx, companyID, *op.SourceID)
			if err != nil {
				return nil, err
			}
			lines = mapMovementLines(movements, priceField)
		case "STOCK_OUT_MANUAL":
			movements, err := s.repo.LoadMovementByID(ctx, companyID, *op.SourceID, "OUT")
			if err != nil {
				return nil, err
			}
			lines = mapMovementLines(movements, priceField)
		case "STOCK_IN_MANUAL":
			movements, err := s.repo.LoadMovementByID(ctx, companyID, *op.SourceID, "IN")
			if err != nil {
				return nil, err
			}
			lines = mapMovementLines(movements, priceField)
		}
	}

	if len(lines) == 0 && op.ProductSummary != nil && strings.TrimSpace(*op.ProductSummary) != "" {
		lines = parseProductSummaryLines(*op.ProductSummary, op.Amount, op.Currency)
	}

	totalsByCurrency := map[string]float64{}
	for _, line := range lines {
		cur := strings.ToUpper(fmt.Sprint(line["currency"]))
		totalsByCurrency[cur] += line["lineTotal"].(float64)
	}
	totals := []map[string]any{}
	for cur, amt := range totalsByCurrency {
		totals = append(totals, map[string]any{"currency": cur, "amount": amt})
	}

	summaryOnly := any(nil)
	if len(lines) == 0 && op.ProductSummary != nil {
		summaryOnly = *op.ProductSummary
	}

	return map[string]any{
		"operation": map[string]any{
			"id": op.ID, "contactId": op.ContactID, "type": op.Type,
			"sourceType": op.SourceType, "sourceId": op.SourceID,
			"amount": op.Amount, "currency": op.Currency,
			"operationDate": op.OperationDate, "notes": op.Notes,
			"productSummary": op.ProductSummary, "reversedById": op.ReversedByID,
		},
		"lines": lines, "summaryOnly": summaryOnly, "totals": totals,
	}, nil
}

func mapMovementLines(movements []movementLineRow, priceField string) []map[string]any {
	out := []map[string]any{}
	for _, m := range movements {
		unitPrice := m.SalePrice
		if priceField == "purchase" {
			unitPrice = m.PurchasePrice
		}
		qty := math.Abs(m.Quantity)
		out = append(out, map[string]any{
			"productName": m.ProductName, "variantName": m.VariantName,
			"sku": nilIfEmptyStr(m.SKU), "barcode": nilIfEmptyStr(m.Barcode),
			"quantity": qty, "unit": m.Unit,
			"salePrice": unitPrice, "currency": NormalizeCurrency(m.Currency),
			"lineTotal": qty * unitPrice, "warehouseName": m.WarehouseName,
		})
	}
	return out
}

func parseProductSummaryLines(summary string, amount float64, currency string) []map[string]any {
	cleaned := regexp.MustCompile(`\s+\+\d+\s+boshqa$`).ReplaceAllString(strings.TrimSpace(summary), "")
	if cleaned == "" {
		return nil
	}
	parsed := []struct{ productName string; quantity float64 }{}
	for _, part := range strings.Split(cleaned, ", ") {
		part = strings.TrimSpace(part)
		match := qtySummaryRe.FindStringSubmatch(part)
		if len(match) < 3 {
			continue
		}
		qty, err := strconv.ParseFloat(strings.ReplaceAll(match[2], ",", "."), 64)
		if err != nil || qty <= 0 {
			continue
		}
		parsed = append(parsed, struct{ productName string; quantity float64 }{match[1], qty})
	}
	if len(parsed) == 0 {
		return nil
	}
	cur := NormalizeCurrency(currency)
	totalAmount := math.Abs(amount)
	if len(parsed) == 1 {
		unitPrice := 0.0
		if totalAmount > 0 {
			unitPrice = totalAmount / parsed[0].quantity
		}
		return []map[string]any{{
			"productName": parsed[0].productName, "variantName": parsed[0].productName,
			"sku": nil, "barcode": nil, "quantity": parsed[0].quantity, "unit": "dona",
			"salePrice": unitPrice, "currency": cur, "lineTotal": totalAmount, "warehouseName": "—",
		}}
	}
	out := []map[string]any{}
	for _, p := range parsed {
		out = append(out, map[string]any{
			"productName": p.productName, "variantName": p.productName,
			"sku": nil, "barcode": nil, "quantity": p.quantity, "unit": "dona",
			"salePrice": 0.0, "currency": cur, "lineTotal": 0.0, "warehouseName": "—",
		})
	}
	return out
}

func (r *Repository) AppendSaleOrderStatusTx(ctx context.Context, tx pgx.Tx, companyID, contactID, batchID, status, source string, comment, updatedByID *string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO "PartnerLedgerSaleOrderStatus"
			("companyId", "contactId", "batchId", status, comment, source, "updatedById", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT ("companyId", "batchId") DO UPDATE SET
			"contactId" = EXCLUDED."contactId",
			status = EXCLUDED.status,
			comment = EXCLUDED.comment,
			source = EXCLUDED.source,
			"updatedById" = EXCLUDED."updatedById",
			"updatedAt" = NOW()
	`, companyID, contactID, batchID, status, comment, source, updatedByID)
	return err
}

func uniqueVariantIDs(lines []PartnerLedgerSaleLineInput) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, l := range lines {
		if !seen[l.ProductVariantID] {
			seen[l.ProductVariantID] = true
			out = append(out, l.ProductVariantID)
		}
	}
	return out
}

func amountsToMaps(lines []amountLine) []map[string]any {
	out := make([]map[string]any, len(lines))
	for i, l := range lines {
		out[i] = map[string]any{"amount": l.Amount, "currency": l.Currency}
	}
	return out
}

func formatTotalsText(lines []amountLine) string {
	if len(lines) == 0 {
		return "—"
	}
	parts := []string{}
	for _, l := range lines {
		parts = append(parts, fmt.Sprintf("%s %s", formatNumber(l.Amount), strings.ToUpper(l.Currency)))
	}
	return strings.Join(parts, " + ")
}

func formatTotalsFromMaps(totals []map[string]any) string {
	if len(totals) == 0 {
		return "—"
	}
	lines := []amountLine{}
	for _, t := range totals {
		amt, _ := t["amount"].(float64)
		cur, _ := t["currency"].(string)
		lines = append(lines, amountLine{Amount: amt, Currency: cur})
	}
	return formatTotalsText(lines)
}

func formatNumber(n float64) string {
	if math.Mod(n, 1) == 0 {
		return strconv.FormatInt(int64(n), 10)
	}
	return strconv.FormatFloat(n, 'f', -1, 64)
}

func derefStr(p *string, def string) string {
	if p == nil {
		return def
	}
	return *p
}

func nilIfEmptyStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
