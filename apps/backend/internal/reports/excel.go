package reports

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
)

func (s *Service) ExportSummaryToExcel(
	ctx context.Context,
	companyID string,
	query ReportQueryInput,
) ([]byte, string, error) {
	summary, err := s.GetCostSummary(ctx, companyID, query)
	if err != nil {
		return nil, "", err
	}
	daily, err := s.GetDailyBreakdown(ctx, companyID, query)
	if err != nil {
		return nil, "", err
	}
	top, err := s.GetTopProducts(ctx, companyID, ReportQueryInput{
		DateFrom:    query.DateFrom,
		DateTo:      query.DateTo,
		WarehouseID: query.WarehouseID,
		Limit:       50,
	})
	if err != nil {
		return nil, "", err
	}

	f := excelize.NewFile()
	f.SetSheetName("Sheet1", "Yigma")
	dailySheet := "Kunlik"
	topSheet := "Top mahsulotlar"
	_, _ = f.NewSheet(dailySheet)
	_, _ = f.NewSheet(topSheet)

	_ = f.SetCellValue("Yigma", "A1", "Korsatkich")
	_ = f.SetCellValue("Yigma", "B1", "UZS")
	_ = f.SetCellValue("Yigma", "C1", "USD")

	purchase := bucketFromAny(summary["purchase"])
	sales := bucketFromAny(summary["sales"])
	cogs := bucketFromAny(summary["cogs"])
	profit := bucketFromAny(summary["profit"])
	margin := bucketFromAny(summary["margin"])
	inventory := bucketFromAny(summary["inventoryValue"])

	rows := [][]any{
		{"Kirim summasi", purchase.UZS, purchase.USD},
		{"Sotuv summasi", sales.UZS, sales.USD},
		{"Tannarx (COGS)", cogs.UZS, cogs.USD},
		{"Yalpi foyda (sotuv - tannarx)", profit.UZS, profit.USD},
		{"Marja %", margin.UZS, margin.USD},
		{"Ombor qiymati (hozir)", inventory.UZS, inventory.USD},
	}
	for i, row := range rows {
		r := i + 2
		cell := fmt.Sprintf("A%d", r)
		_ = f.SetSheetRow("Yigma", cell, &row)
	}

	if period, ok := summary["period"].(map[string]any); ok {
		_ = f.SetCellValue("Yigma", "A8", "Davr")
		_ = f.SetCellValue("Yigma", "B8", fmt.Sprintf("%v - %v", period["from"], period["to"]))
	}
	_ = f.SetCellValue("Yigma", "A9", "Ombor filtri")
	if query.WarehouseID != nil && strings.TrimSpace(*query.WarehouseID) != "" {
		_ = f.SetCellValue("Yigma", "B9", *query.WarehouseID)
	} else {
		_ = f.SetCellValue("Yigma", "B9", "Hammasi")
	}

	_ = f.SetCellValue(dailySheet, "A1", "Sana")
	_ = f.SetCellValue(dailySheet, "B1", "Kirim UZS")
	_ = f.SetCellValue(dailySheet, "C1", "Kirim USD")
	_ = f.SetCellValue(dailySheet, "D1", "Sotuv UZS")
	_ = f.SetCellValue(dailySheet, "E1", "Sotuv USD")
	_ = f.SetCellValue(dailySheet, "F1", "Foyda UZS")
	_ = f.SetCellValue(dailySheet, "G1", "Foyda USD")
	for i, item := range daily {
		row := i + 2
		p := bucketFromAny(item["purchase"])
		sa := bucketFromAny(item["sales"])
		pr := bucketFromAny(item["profit"])
		_ = f.SetSheetRow(dailySheet, fmt.Sprintf("A%d", row), &[]any{
			item["date"], p.UZS, p.USD, sa.UZS, sa.USD, pr.UZS, pr.USD,
		})
	}

	_ = f.SetCellValue(topSheet, "A1", "#")
	_ = f.SetCellValue(topSheet, "B1", "Mahsulot")
	_ = f.SetCellValue(topSheet, "C1", "Variant")
	_ = f.SetCellValue(topSheet, "D1", "SKU")
	_ = f.SetCellValue(topSheet, "E1", "Miqdor")
	_ = f.SetCellValue(topSheet, "F1", "Tushum")
	_ = f.SetCellValue(topSheet, "G1", "Valyuta")
	for i, item := range top {
		row := i + 2
		_ = f.SetSheetRow(topSheet, fmt.Sprintf("A%d", row), &[]any{
			i + 1,
			item["productName"],
			item["variantName"],
			item["sku"],
			item["quantity"],
			item["revenue"],
			item["currency"],
		})
	}

	buf := &bytes.Buffer{}
	if err := f.Write(buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("hisobot-%s.xlsx", time.Now().UTC().Format("2006-01-02"))
	return buf.Bytes(), filename, nil
}

func (s *Service) ExportStockToExcel(
	ctx context.Context,
	companyID string,
	query ReportQueryInput,
) ([]byte, string, error) {
	report, err := s.GetStockReport(ctx, companyID, query)
	if err != nil {
		return nil, "", err
	}
	rows, _ := report["data"].([]map[string]any)

	f := excelize.NewFile()
	sheet := "Stock"
	f.SetSheetName("Sheet1", sheet)

	headers := []any{"Ombor", "Mahsulot", "Variant", "SKU", "Miqdor", "Kirim narxi", "Sotuv narxi", "Umumiy qiymat"}
	_ = f.SetSheetRow(sheet, "A1", &headers)
	for i, row := range rows {
		n := i + 2
		_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", n), &[]any{
			row["warehouse"],
			row["product"],
			row["variant"],
			row["sku"],
			row["quantity"],
			row["purchasePrice"],
			row["salePrice"],
			row["inventoryValue"],
		})
	}

	buf := &bytes.Buffer{}
	if err := f.Write(buf); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), "stock_report.xlsx", nil
}

func (s *Service) ExportPartnerBalanceExcel(
	ctx context.Context,
	companyID, partnerCompanyID string,
	query ReportQueryInput,
) ([]byte, string, error) {
	data, err := s.GetPartnerDetailedBalance(ctx, companyID, partnerCompanyID, query)
	if err != nil {
		return nil, "", err
	}

	transactions, _ := data["transactions"].([]map[string]any)
	partner, _ := data["partner"].(map[string]any)

	f := excelize.NewFile()
	sheet := "Akt Sverka"
	f.SetSheetName("Sheet1", sheet)

	_ = f.SetCellValue(sheet, "A1", "Ozaro hisob-kitoblar dalolatnomasi")
	_ = f.SetCellValue(sheet, "A2", "Hamkor")
	_ = f.SetCellValue(sheet, "B2", fmt.Sprintf("%v", partner["name"]))
	_ = f.SetCellValue(sheet, "C2", "STIR")
	_ = f.SetCellValue(sheet, "D2", fmt.Sprintf("%v", partner["tin"]))

	headers := []any{"Sana", "Operatsiya", "Valyuta", "Debet", "Kredit", "Qoldiq"}
	_ = f.SetSheetRow(sheet, "A4", &headers)

	balances := map[string]float64{"UZS": 0, "USD": 0}
	for i, item := range transactions {
		row := i + 5
		dateText := ""
		if t, ok := item["date"].(time.Time); ok {
			dateText = t.Format("2006-01-02")
		} else {
			dateText = fmt.Sprintf("%v", item["date"])
		}
		currency := normCurrency(fmt.Sprintf("%v", item["currency"]))
		debit := anyToFloat(item["debit"])
		credit := anyToFloat(item["credit"])
		balances[currency] += debit - credit

		_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", row), &[]any{
			dateText,
			item["description"],
			currency,
			debit,
			credit,
			balances[currency],
		})
	}

	summaryRow := len(transactions) + 7
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", summaryRow), "Jami UZS qoldiq")
	_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", summaryRow), round2(balances["UZS"]))
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", summaryRow+1), "Jami USD qoldiq")
	_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", summaryRow+1), round2(balances["USD"]))

	buf := &bytes.Buffer{}
	if err := f.Write(buf); err != nil {
		return nil, "", err
	}

	partnerName := "hamkor"
	if partner != nil {
		partnerName = fmt.Sprintf("%v", partner["name"])
	}
	filename := fmt.Sprintf("akt-sverka-%s-%s.xlsx", safeFileName(strings.ToLower(partnerName)), time.Now().UTC().Format("2006-01"))
	return buf.Bytes(), filename, nil
}

func (s *Service) ExportProductsForImportToExcel(
	ctx context.Context,
	companyID string,
	warehouseID string,
	mode string,
) ([]byte, string, error) {
	warehouseID = strings.TrimSpace(warehouseID)
	if warehouseID == "" {
		return nil, "", fmt.Errorf("Excel eksport uchun ombor tanlash majburiy")
	}
	withStock := strings.TrimSpace(mode) != "without_stock"

	var warehouseName string
	if err := s.pool.QueryRow(ctx, `
		SELECT name
		FROM "Warehouse"
		WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, warehouseID, companyID).Scan(&warehouseName); err != nil {
		if err == pgx.ErrNoRows {
			return nil, "", fmt.Errorf("Ombor topilmadi")
		}
		return nil, "", err
	}

	f := excelize.NewFile()
	sheet := "Import"
	f.SetSheetName("Sheet1", sheet)
	headers := []any{
		"Mahsulot nomi",
		"SKU",
		"Barkod",
		"Rang",
		"Variant",
		"Kirim narxi",
		"Sotuv narxi",
		"Valyuta",
		"Boshlangich qoldiq",
		"Birlik",
		"Kategoriya",
		"Ombor nomi",
		"Variant ID (import)",
	}
	_ = f.SetSheetRow(sheet, "A1", &headers)

	rows, err := s.pool.Query(ctx, `
		SELECT p.name,
		       COALESCE(pv.sku, ''),
		       COALESCE(pv.barcode, ''),
		       '',
		       COALESCE(pv.name, ''),
		       COALESCE(pv."purchasePrice", 0)::float8,
		       COALESCE(pv."salePrice", 0)::float8,
		       COALESCE(pv.currency, 'UZS'),
		       COALESCE(sb.quantity, 0)::float8,
		       COALESCE(p.unit, 'dona'),
		       COALESCE(pc.name, ''),
		       pv.id
		FROM "StockBalance" sb
		JOIN "ProductVariant" pv ON pv.id = sb."productVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
		WHERE sb."companyId" = $1
		  AND sb."warehouseId" = $2
		  AND pv.status = 'ACTIVE'
		  AND p.status = 'ACTIVE'
		ORDER BY p.name ASC, pv.name ASC
	`, companyID, warehouseID)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	index := 2
	for rows.Next() {
		var name, sku, barcode, color, variant, currency, unit, category, variantID string
		var purchasePrice, salePrice, qty float64
		if err := rows.Scan(
			&name,
			&sku,
			&barcode,
			&color,
			&variant,
			&purchasePrice,
			&salePrice,
			&currency,
			&qty,
			&unit,
			&category,
			&variantID,
		); err != nil {
			return nil, "", err
		}
		stockVal := any("")
		if withStock {
			stockVal = qty
		}
		_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", index), &[]any{
			name, sku, barcode, color, variant, purchasePrice, salePrice, currency, stockVal, unit, category, warehouseName, variantID,
		})
		index++
	}

	buf := &bytes.Buffer{}
	if err := f.Write(buf); err != nil {
		return nil, "", err
	}

	modeSuffix := "qoldiq"
	if !withStock {
		modeSuffix = "katalog"
	}
	filename := fmt.Sprintf("ombor-%s-%s-%s.xlsx", modeSuffix, safeFileName(warehouseName), time.Now().UTC().Format("2006-01-02"))
	return buf.Bytes(), filename, nil
}

func (s *Service) GenerateProductImportTemplate(ctx context.Context, companyID string) ([]byte, string, error) {
	f := excelize.NewFile()
	importSheet := "Import"
	guideSheet := "Yoriqnoma"
	lookupSheet := "Lookup"

	f.SetSheetName("Sheet1", importSheet)
	_, _ = f.NewSheet(guideSheet)
	_, _ = f.NewSheet(lookupSheet)

	headers := []any{
		"Mahsulot nomi",
		"SKU",
		"Barkod",
		"Rang",
		"Variant",
		"Kirim narxi",
		"Sotuv narxi",
		"Valyuta",
		"Boshlangich qoldiq",
		"Birlik",
		"Kategoriya",
		"Ombor nomi",
	}
	_ = f.SetSheetRow(importSheet, "A1", &headers)
	_ = f.SetSheetRow(importSheet, "A2", &[]any{"Shim Jinsi", "MISOL-SH-001", "123456789", "Kok", "L", 100000, 150000, "UZS", 50, "dona", "Kiyim", "Asosiy Ombor"})
	_ = f.SetSheetRow(importSheet, "A3", &[]any{"Sut 3.2%", "MISOL-SUT-1L", "8600123456789", "", "", 12000, 15000, "UZS", 120, "l", "Oziq-ovqat", "Asosiy Ombor"})

	_ = f.SetSheetRow(guideSheet, "A1", &[]any{"Bolim", "Tavsif"})
	_ = f.SetSheetRow(guideSheet, "A2", &[]any{"Qadam 1", "Import varagidagi faqat 2-qatordan boshlab malumot kiriting."})
	_ = f.SetSheetRow(guideSheet, "A3", &[]any{"Valyuta", "Valyuta ustuniga UZS yoki USD yozing. Bosh qoldirilsa UZS deb olinadi."})
	_ = f.SetSheetRow(guideSheet, "A4", &[]any{"Birlik", "Birlik ustuniga dona, kg, l yoki m yozing."})
	_ = f.SetSheetRow(guideSheet, "A5", &[]any{"Ombor", "Ombor nomini royxatdan tanlang."})

	warehouseRows, _ := s.pool.Query(ctx, `
		SELECT name
		FROM "Warehouse"
		WHERE "companyId" = $1 AND status = 'ACTIVE'
		ORDER BY name ASC
	`, companyID)
	if warehouseRows != nil {
		row := 2
		for warehouseRows.Next() {
			var name string
			if err := warehouseRows.Scan(&name); err == nil {
				_ = f.SetCellValue(lookupSheet, fmt.Sprintf("B%d", row), name)
				row++
			}
		}
		warehouseRows.Close()
	}

	categoryRows, _ := s.pool.Query(ctx, `
		SELECT name
		FROM "ProductCategory"
		WHERE "companyId" = $1 AND status <> 'ARCHIVED'
		ORDER BY name ASC
	`, companyID)
	if categoryRows != nil {
		row := 2
		for categoryRows.Next() {
			var name string
			if err := categoryRows.Scan(&name); err == nil {
				_ = f.SetCellValue(lookupSheet, fmt.Sprintf("A%d", row), name)
				row++
			}
		}
		categoryRows.Close()
	}

	_ = f.SetCellValue(lookupSheet, "C2", "UZS")
	_ = f.SetCellValue(lookupSheet, "C3", "USD")
	_ = f.SetCellValue(lookupSheet, "D2", "dona")
	_ = f.SetCellValue(lookupSheet, "D3", "kg")
	_ = f.SetCellValue(lookupSheet, "D4", "l")
	_ = f.SetCellValue(lookupSheet, "D5", "m")

	buf := &bytes.Buffer{}
	if err := f.Write(buf); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), "product_import_template.xlsx", nil
}

func bucketFromAny(v any) currencyBucket {
	switch t := v.(type) {
	case currencyBucket:
		return t
	case map[string]any:
		return currencyBucket{
			UZS: anyToFloat(t["UZS"]),
			USD: anyToFloat(t["USD"]),
		}
	default:
		return currencyBucket{}
	}
}

func safeFileName(name string) string {
	s := strings.TrimSpace(name)
	if s == "" {
		return "ombor"
	}
	replacer := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
		" ", "-",
	)
	return strings.ToLower(replacer.Replace(s))
}
