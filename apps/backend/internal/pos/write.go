package pos

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/retailcredit"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
)

var (
	ErrBadRequest    = errors.New("bad request")
	ErrDraftOnly     = errors.New("Faqat DRAFT holatidagi chekni o'zgartirish mumkin")
	ErrAlreadyClosed = errors.New("Chek allaqachon yopilgan")
	ErrEmptyCart     = errors.New("Savat bo'sh")
	ErrEmptyCheckout = errors.New("Bo'sh chekni yopib bo'lmaydi")
	ErrAlreadyVoided = errors.New("Chek allaqachon bekor qilingan")
	ErrDraftDelete   = errors.New("Faqat DRAFT chekni o'chirib bo'ladi. COMPLETED chek faqat VOID qilinadi")
	ErrWarehouseNF   = errors.New("Ombor topilmadi yoki aktiv emas")
	ErrInsufficient  = errors.New("insufficient cash")
)

func paymentReference(method string) *string {
	if method == "CREDIT" {
		s := "NASIYA"
		return &s
	}
	return nil
}

func cashAmount(method string, v float64) *float64 {
	if method != "CASH" {
		return nil
	}
	return &v
}

func derefFloat(f *float64, def float64) float64 {
	if f == nil {
		return def
	}
	return *f
}

func (s *Service) assertActiveWarehouse(ctx context.Context, companyID, warehouseID string) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, warehouseID, companyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrWarehouseNF
	}
	return err
}

func (s *Service) insertSaleItems(ctx context.Context, tx pgx.Tx, saleID string, resolved []resolvedItem) error {
	for _, it := range resolved {
		_, err := tx.Exec(ctx, `
			INSERT INTO "PosSaleItem"
			(id, "saleId", "productVariantId", "productNameSnapshot", "skuSnapshot", "barcodeSnapshot",
			 quantity, "listPrice", "unitPrice", "lineTotal", "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		`, saleID, it.ProductVariantID, it.ProductNameSnapshot, it.SkuSnapshot, it.BarcodeSnapshot,
			it.Quantity, it.ListPrice, it.UnitPrice, it.LineTotal)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) logPriceOverrides(ctx context.Context, tx pgx.Tx, companyID, userID, saleID, saleNumber string, resolved []resolvedItem) error {
	for _, it := range resolved {
		if it.UnitPrice >= it.ListPrice-0.001 {
			continue
		}
		discountPct := 0.0
		if it.ListPrice > 0 {
			discountPct = round2(((it.ListPrice - it.UnitPrice) / it.ListPrice) * 100)
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES (gen_random_uuid()::text, $1, $2, 'pos.price_override', 'POS_SALE', $3,
			        jsonb_build_object('saleNumber', $4::text, 'productName', $5::text, 'listPrice', $6::numeric, 'unitPrice', $7::numeric, 'discountPercent', $8::numeric), NOW())
		`, companyID, userID, saleID, saleNumber, it.ProductNameSnapshot, it.ListPrice, it.UnitPrice, discountPct)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) invalidateCatalog(ctx context.Context, companyID, warehouseID string) {
	s.cache.DelByPrefix(ctx, fmt.Sprintf("pos:catalog:%s:%s:", companyID, warehouseID))
}

func (s *Service) Create(ctx context.Context, companyID, userID string, in CreateSaleInput) (map[string]any, error) {
	if strings.TrimSpace(in.WarehouseID) == "" {
		return nil, ErrBadWarehouse
	}
	if err := s.assertActiveWarehouse(ctx, companyID, in.WarehouseID); err != nil {
		return nil, err
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, in.WarehouseID); err != nil {
		return nil, err
	}
	customer, err := s.resolveForSale(ctx, companyID, in.RetailCustomerID, in.CustomerName, in.CustomerPhone)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	pctx, err := s.loadPriceContext(ctx, companyID, userID, tx)
	if err != nil {
		return nil, err
	}
	resolved, err := s.resolveItems(ctx, tx, companyID, userID, in.Items, &pctx)
	if err != nil {
		return nil, err
	}
	subtotal, total, discount, err := calcTotals(resolved, derefFloat(in.DiscountAmount, 0))
	if err != nil {
		return nil, err
	}
	currency, err := resolveCurrency(resolved)
	if err != nil {
		return nil, err
	}
	saleNumber, err := s.generateSaleNumber(ctx, tx, companyID)
	if err != nil {
		return nil, err
	}

	var saleID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "PosSale"
		(id, "companyId", "warehouseId", "saleNumber", subtotal, "discountAmount", "totalAmount", currency,
		 status, "cashierId", note, "retailCustomerId", "customerNameSnapshot", "customerPhoneSnapshot", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8, $9, $10, $11, $12, NOW(), NOW())
		RETURNING id
	`, companyID, in.WarehouseID, saleNumber, subtotal, discount, total, currency, userID, in.Note,
		customer.RetailCustomerID, customer.CustomerNameSnapshot, customer.CustomerPhoneSnapshot).Scan(&saleID)
	if err != nil {
		return nil, err
	}
	if err := s.insertSaleItems(ctx, tx, saleID, resolved); err != nil {
		return nil, err
	}
	if err := s.logPriceOverrides(ctx, tx, companyID, userID, saleID, saleNumber, resolved); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.fetchSaleDetail(ctx, saleID, companyID)
}

func (s *Service) Update(ctx context.Context, id, companyID, userID string, in UpdateSaleInput) (map[string]any, error) {
	var status string
	var existingDiscount float64
	var existingCurrency string
	err := s.pool.QueryRow(ctx, `
		SELECT status, "discountAmount", currency FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&status, &existingDiscount, &existingCurrency)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "DRAFT" {
		return nil, ErrDraftOnly
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	pctx, err := s.loadPriceContext(ctx, companyID, userID, tx)
	if err != nil {
		return nil, err
	}

	var resolved []resolvedItem
	if in.Items != nil {
		resolved, err = s.resolveItems(ctx, tx, companyID, userID, in.Items, &pctx)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx, `DELETE FROM "PosSaleItem" WHERE "saleId" = $1`, id)
		if err != nil {
			return nil, err
		}
		if err := s.insertSaleItems(ctx, tx, id, resolved); err != nil {
			return nil, err
		}
	} else {
		rows, err := tx.Query(ctx, `SELECT "lineTotal" FROM "PosSaleItem" WHERE "saleId" = $1`, id)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var lt float64
			if err := rows.Scan(&lt); err != nil {
				rows.Close()
				return nil, err
			}
			resolved = append(resolved, resolvedItem{LineTotal: lt, Currency: existingCurrency})
		}
		rows.Close()
	}

	newDiscount := existingDiscount
	if in.DiscountAmount != nil {
		newDiscount = *in.DiscountAmount
	}
	subtotal, total, discount, err := calcTotals(resolved, newDiscount)
	if err != nil {
		return nil, err
	}
	currency := existingCurrency
	if in.Items != nil {
		currency, err = resolveCurrency(resolved)
		if err != nil {
			return nil, err
		}
	}

	var customerPatch *saleCustomer
	if in.RetailCustomerID != nil || in.CustomerName != nil || in.CustomerPhone != nil {
		c, err := s.resolveForSale(ctx, companyID, in.RetailCustomerID, in.CustomerName, in.CustomerPhone)
		if err != nil {
			return nil, err
		}
		customerPatch = &c
	}

	sql := `UPDATE "PosSale" SET subtotal = $1, "discountAmount" = $2, "totalAmount" = $3, currency = $4, "updatedAt" = NOW()`
	args := []any{subtotal, discount, total, currency}
	n := 5
	if in.Note != nil {
		sql += fmt.Sprintf(`, note = $%d`, n)
		args = append(args, *in.Note)
		n++
	}
	if customerPatch != nil {
		sql += fmt.Sprintf(`, "retailCustomerId" = $%d, "customerNameSnapshot" = $%d, "customerPhoneSnapshot" = $%d`, n, n+1, n+2)
		args = append(args, customerPatch.RetailCustomerID, customerPatch.CustomerNameSnapshot, customerPatch.CustomerPhoneSnapshot)
		n += 3
	}
	sql += fmt.Sprintf(` WHERE id = $%d AND "companyId" = $%d`, n, n+1)
	args = append(args, id, companyID)
	_, err = tx.Exec(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.fetchSaleDetail(ctx, id, companyID)
}

func (s *Service) QuickCheckout(ctx context.Context, companyID, userID string, in QuickCheckoutInput) (map[string]any, error) {
	if len(in.Items) == 0 {
		return nil, ErrEmptyCart
	}
	method := strings.TrimSpace(in.Method)
	if method == "" {
		method = "CASH"
	}
	if err := s.assertActiveWarehouse(ctx, companyID, in.WarehouseID); err != nil {
		return nil, err
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, in.WarehouseID); err != nil {
		return nil, err
	}
	if method == "CREDIT" {
		if err := s.assertCreditAllowed(ctx, companyID, userID); err != nil {
			return nil, err
		}
	}
	customer, err := s.resolveForSale(ctx, companyID, in.RetailCustomerID, in.CustomerName, in.CustomerPhone)
	if err != nil {
		return nil, err
	}
	if method == "CREDIT" && customer.RetailCustomerID == nil {
		return nil, errors.New("Nasiya (qarz) uchun mijoz tanlang yoki yangi mijoz qo'shing")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	pctx, err := s.loadPriceContext(ctx, companyID, userID, tx)
	if err != nil {
		return nil, err
	}
	resolved, err := s.resolveItems(ctx, tx, companyID, userID, in.Items, &pctx)
	if err != nil {
		return nil, err
	}
	subtotal, total, discount, err := calcTotals(resolved, derefFloat(in.DiscountAmount, 0))
	if err != nil {
		return nil, err
	}
	currency, err := resolveCurrency(resolved)
	if err != nil {
		return nil, err
	}

	cashReceived := derefFloat(in.CashReceived, 0)
	change := 0.0
	if method == "CASH" {
		if cashReceived < total {
			return nil, fmt.Errorf("Berilgan naqd yetarli emas. Talab: %v, berilgan: %v", total, cashReceived)
		}
		change = round2(cashReceived - total)
	} else {
		cashReceived = 0
	}

	saleNumber, err := s.generateSaleNumber(ctx, tx, companyID)
	if err != nil {
		return nil, err
	}
	var saleID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "PosSale"
		(id, "companyId", "warehouseId", "saleNumber", subtotal, "discountAmount", "totalAmount", currency,
		 status, "completedAt", "cashierId", note, "retailCustomerId", "customerNameSnapshot", "customerPhoneSnapshot",
		 "cashReceived", "cashChange", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'COMPLETED', NOW(), $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
		RETURNING id
	`, companyID, in.WarehouseID, saleNumber, subtotal, discount, total, currency, userID, in.Note,
		customer.RetailCustomerID, customer.CustomerNameSnapshot, customer.CustomerPhoneSnapshot,
		cashAmount(method, cashReceived), cashAmount(method, change)).Scan(&saleID)
	if err != nil {
		return nil, err
	}
	if err := s.insertSaleItems(ctx, tx, saleID, resolved); err != nil {
		return nil, fmt.Errorf("pos sale items: %w", err)
	}
	lines := stockLines(in.WarehouseID, saleID, saleNumber, resolved)
	if err := stock.RecordMovements(ctx, tx, companyID, userID, "OUT", "POS_SALE", lines); err != nil {
		return nil, fmt.Errorf("pos stock: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "PosPayment" (id, "saleId", method, amount, reference, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
	`, saleID, method, total, paymentReference(method))
	if err != nil {
		return nil, err
	}
	if method == "CREDIT" && customer.RetailCustomerID != nil {
		if err := retailcredit.ProcessCreditSale(ctx, tx, retailcredit.SaleParams{
			CompanyID: companyID, RetailCustomerID: *customer.RetailCustomerID,
			PosSaleID: saleID, Total: total, Currency: currency, UserID: userID, SaleNumber: saleNumber,
		}); err != nil {
			return nil, err
		}
	}
	if err := s.logPriceOverrides(ctx, tx, companyID, userID, saleID, saleNumber, resolved); err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'pos.sale_completed', 'POS_SALE', $3,
		        jsonb_build_object('saleNumber', $4::text, 'total', $5::numeric, 'cashReceived', $6::numeric, 'cashChange', $7::numeric, 'itemsCount', $8::int, 'quickCheckout', true), NOW())
	`, companyID, userID, saleID, saleNumber, total, cashReceived, change, len(resolved))
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.invalidateCatalog(ctx, companyID, in.WarehouseID)
	return quickCheckoutResponse(
		saleID, saleNumber, in.WarehouseID, currency, method,
		subtotal, discount, total, cashReceived, change,
		customer.RetailCustomerID, customer.CustomerNameSnapshot, customer.CustomerPhoneSnapshot,
	), nil
}

func quickCheckoutResponse(
	saleID, saleNumber, warehouseID, currency, method string,
	subtotal, discount, total, cashReceived, change float64,
	retailID *string, custName, custPhone *string,
) map[string]any {
	now := time.Now()
	out := map[string]any{
		"id":                      saleID,
		"saleNumber":              saleNumber,
		"receiptNumber":           saleNumber,
		"status":                  "COMPLETED",
		"subtotal":                subtotal,
		"discountAmount":          discount,
		"totalAmount":             total,
		"currency":                currency,
		"warehouseId":             warehouseID,
		"completedAt":             now,
		"createdAt":               now,
		"retailCustomerId":          retailID,
		"customerNameSnapshot":    custName,
		"customerPhoneSnapshot":   custPhone,
		"payments":                []map[string]any{{"method": method, "amount": total}},
	}
	if method == "CASH" {
		out["cashReceived"] = cashReceived
		out["cashChange"] = change
	}
	return out
}

func stockLines(warehouseID, saleID, saleNumber string, resolved []resolvedItem) []stock.Line {
	out := make([]stock.Line, len(resolved))
	for i, it := range resolved {
		out[i] = stock.Line{
			WarehouseID: warehouseID, ProductVariantID: it.ProductVariantID,
			Quantity: it.Quantity, SourceID: saleID, Note: fmt.Sprintf("POS sotuv %s", saleNumber),
		}
	}
	return out
}

func (s *Service) Checkout(ctx context.Context, id, companyID, userID string, in CheckoutInput) (map[string]any, error) {
	var status, saleNumber, warehouseID string
	var total float64
	var retailID, custName, custPhone *string
	err := s.pool.QueryRow(ctx, `
		SELECT status, "saleNumber", "warehouseId", "totalAmount", "retailCustomerId",
		       "customerNameSnapshot", "customerPhoneSnapshot"
		FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&status, &saleNumber, &warehouseID, &total, &retailID, &custName, &custPhone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == "COMPLETED" {
		return nil, ErrAlreadyClosed
	}
	if status != "DRAFT" {
		return nil, errors.New("Faqat DRAFT chekni yopish mumkin")
	}
	var itemCount int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "PosSaleItem" WHERE "saleId" = $1`, id).Scan(&itemCount)
	if itemCount == 0 {
		return nil, ErrEmptyCheckout
	}

	method := strings.TrimSpace(in.Method)
	if method == "" {
		method = "CASH"
	}
	if method == "CREDIT" {
		if err := s.assertCreditAllowed(ctx, companyID, userID); err != nil {
			return nil, err
		}
	}
	rcID := retailID
	if in.RetailCustomerID != nil {
		rcID = in.RetailCustomerID
	}
	cName := custName
	if in.CustomerName != nil {
		cName = in.CustomerName
	}
	cPhone := custPhone
	if in.CustomerPhone != nil {
		cPhone = in.CustomerPhone
	}
	customer, err := s.resolveForSale(ctx, companyID, rcID, cName, cPhone)
	if err != nil {
		return nil, err
	}
	if method == "CREDIT" && customer.RetailCustomerID == nil {
		return nil, errors.New("Nasiya (qarz) uchun mijoz tanlang yoki yangi mijoz qo'shing")
	}

	cashReceived := derefFloat(in.CashReceived, 0)
	change := 0.0
	if method == "CASH" {
		if cashReceived < total {
			return nil, fmt.Errorf("Berilgan naqd yetarli emas. Talab: %v, berilgan: %v", total, cashReceived)
		}
		change = round2(cashReceived - total)
	} else {
		cashReceived = 0
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE "PosSale" SET "retailCustomerId" = $1, "customerNameSnapshot" = $2, "customerPhoneSnapshot" = $3, "updatedAt" = NOW()
		WHERE id = $4
	`, customer.RetailCustomerID, customer.CustomerNameSnapshot, customer.CustomerPhoneSnapshot, id)
	if err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		SELECT "productVariantId", quantity FROM "PosSaleItem" WHERE "saleId" = $1
	`, id)
	if err != nil {
		return nil, err
	}
	var lines []stock.Line
	for rows.Next() {
		var vid string
		var qty float64
		if err := rows.Scan(&vid, &qty); err != nil {
			rows.Close()
			return nil, err
		}
		lines = append(lines, stock.Line{
			WarehouseID: warehouseID, ProductVariantID: vid, Quantity: qty,
			SourceID: id, Note: fmt.Sprintf("POS sotuv %s", saleNumber),
		})
	}
	rows.Close()
	if err := stock.RecordMovements(ctx, tx, companyID, userID, "OUT", "POS_SALE", lines); err != nil {
		return nil, err
	}

	var currency string
	_ = tx.QueryRow(ctx, `SELECT currency FROM "PosSale" WHERE id = $1`, id).Scan(&currency)

	_, err = tx.Exec(ctx, `
		INSERT INTO "PosPayment" (id, "saleId", method, amount, reference, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
	`, id, method, total, paymentReference(method))
	if err != nil {
		return nil, err
	}

	if method == "CREDIT" && customer.RetailCustomerID != nil {
		if err := retailcredit.ProcessCreditSale(ctx, tx, retailcredit.SaleParams{
			CompanyID: companyID, RetailCustomerID: *customer.RetailCustomerID,
			PosSaleID: id, Total: total, Currency: currency, UserID: userID, SaleNumber: saleNumber,
		}); err != nil {
			return nil, err
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE "PosSale" SET status = 'COMPLETED', "completedAt" = NOW(),
		       "cashReceived" = $1, "cashChange" = $2, "updatedAt" = NOW()
		WHERE id = $3
	`, cashAmount(method, cashReceived), cashAmount(method, change), id)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'pos.sale_completed', 'POS_SALE', $3,
		        jsonb_build_object('saleNumber', $4::text, 'total', $5::numeric, 'method', $6::text), NOW())
	`, companyID, userID, id, saleNumber, total, method)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.invalidateCatalog(ctx, companyID, warehouseID)
	return s.fetchSaleDetail(ctx, id, companyID)
}

func (s *Service) Void(ctx context.Context, id, companyID, userID string, in VoidInput) (map[string]any, error) {
	var status, saleNumber, warehouseID string
	var total float64
	var retailID *string
	err := s.pool.QueryRow(ctx, `
		SELECT status, "saleNumber", "warehouseId", "totalAmount", "retailCustomerId"
		FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&status, &saleNumber, &warehouseID, &total, &retailID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == "VOIDED" {
		return nil, ErrAlreadyVoided
	}
	prevStatus := status

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if status == "COMPLETED" {
		rows, err := tx.Query(ctx, `SELECT "productVariantId", quantity FROM "PosSaleItem" WHERE "saleId" = $1`, id)
		if err != nil {
			return nil, err
		}
		var lines []stock.Line
		for rows.Next() {
			var vid string
			var qty float64
			if err := rows.Scan(&vid, &qty); err != nil {
				rows.Close()
				return nil, err
			}
			lines = append(lines, stock.Line{
				WarehouseID: warehouseID, ProductVariantID: vid, Quantity: qty,
				SourceID: id, Note: fmt.Sprintf("POS bekor qilish %s", saleNumber),
			})
		}
		rows.Close()
		if err := stock.RecordMovements(ctx, tx, companyID, userID, "IN", "POS_VOID", lines); err != nil {
			return nil, err
		}
		if retailID != nil {
			if err := retailcredit.ReverseCreditSale(ctx, tx, companyID, *retailID, id, saleNumber, userID); err != nil {
				return nil, err
			}
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE "PosSale" SET status = 'VOIDED', "voidedAt" = NOW(), "voidedById" = $1, "voidReason" = $2, "updatedAt" = NOW()
		WHERE id = $3
	`, userID, in.Reason, id)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "oldData", "newData", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'pos.sale_voided', 'POS_SALE', $3,
		        jsonb_build_object('status', $4::text, 'total', $5::numeric),
		        jsonb_build_object('reason', $6::text, 'stockReverted', $7::boolean), NOW())
	`, companyID, userID, id, prevStatus, total, in.Reason, prevStatus == "COMPLETED")
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if prevStatus == "COMPLETED" {
		s.invalidateCatalog(ctx, companyID, warehouseID)
	}
	return s.fetchSaleDetail(ctx, id, companyID)
}

func (s *Service) Remove(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	var status, saleNumber string
	err := s.pool.QueryRow(ctx, `
		SELECT status, "saleNumber" FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&status, &saleNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "DRAFT" {
		return nil, ErrDraftDelete
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM "PosSaleItem" WHERE "saleId" = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `DELETE FROM "PosPayment" WHERE "saleId" = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `DELETE FROM "PosSale" WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "oldData", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'pos.sale_deleted_draft', 'POS_SALE', $3,
		        jsonb_build_object('saleNumber', $4::text), NOW())
	`, companyID, userID, id, saleNumber)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) fetchSaleDetail(ctx context.Context, id, companyID string) (map[string]any, error) {
	var saleID, saleNumber, status, currency string
	var subtotal, discount, total float64
	var warehouseID, cashierID string
	var note *string
	var retailID, custName, custPhone *string
	var completedAt, voidedAt *time.Time
	var cashReceived, cashChange *float64
	var createdAt time.Time

	err := s.pool.QueryRow(ctx, `
		SELECT id, "saleNumber", status, subtotal, "discountAmount", "totalAmount", currency,
		       "warehouseId", "cashierId", note, "retailCustomerId", "customerNameSnapshot", "customerPhoneSnapshot",
		       "completedAt", "voidedAt", "cashReceived", "cashChange", "createdAt"
		FROM "PosSale" WHERE id = $1 AND "companyId" = $2
	`, id, companyID).Scan(&saleID, &saleNumber, &status, &subtotal, &discount, &total, &currency,
		&warehouseID, &cashierID, &note, &retailID, &custName, &custPhone,
		&completedAt, &voidedAt, &cashReceived, &cashChange, &createdAt)
	if err != nil {
		return nil, err
	}

	var wName string
	_ = s.pool.QueryRow(ctx, `SELECT name FROM "Warehouse" WHERE id = $1`, warehouseID).Scan(&wName)
	var uName string
	_ = s.pool.QueryRow(ctx, `SELECT "fullName" FROM "User" WHERE id = $1`, cashierID).Scan(&uName)

	itemRows, err := s.pool.Query(ctx, `
		SELECT id, "productVariantId", "productNameSnapshot", quantity, "listPrice", "unitPrice", "lineTotal"
		FROM "PosSaleItem" WHERE "saleId" = $1 ORDER BY id
	`, id)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	items := []map[string]any{}
	for itemRows.Next() {
		var itemID, variantID, name string
		var qty, list, unit, line float64
		if err := itemRows.Scan(&itemID, &variantID, &name, &qty, &list, &unit, &line); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": itemID, "productVariantId": variantID, "productNameSnapshot": name,
			"quantity": qty, "listPrice": list, "unitPrice": unit, "lineTotal": line,
		})
	}

	payRows, err := s.pool.Query(ctx, `SELECT id, method, amount, reference FROM "PosPayment" WHERE "saleId" = $1`, id)
	if err != nil {
		return nil, err
	}
	defer payRows.Close()
	payments := []map[string]any{}
	for payRows.Next() {
		var pid, method string
		var amount float64
		var ref *string
		if err := payRows.Scan(&pid, &method, &amount, &ref); err != nil {
			return nil, err
		}
		payments = append(payments, map[string]any{"id": pid, "method": method, "amount": amount, "reference": ref})
	}

	return map[string]any{
		"id": saleID, "saleNumber": saleNumber, "status": status,
		"subtotal": subtotal, "discountAmount": discount, "totalAmount": total, "currency": currency,
		"warehouseId": warehouseID, "cashierId": cashierID, "note": note,
		"retailCustomerId": retailID, "customerNameSnapshot": custName, "customerPhoneSnapshot": custPhone,
		"completedAt": completedAt, "voidedAt": voidedAt, "cashReceived": cashReceived, "cashChange": cashChange,
		"createdAt": createdAt,
		"warehouse": map[string]any{"id": warehouseID, "name": wName},
		"cashier":   map[string]any{"id": cashierID, "fullName": uName},
		"items":     items, "payments": payments,
	}, nil
}
