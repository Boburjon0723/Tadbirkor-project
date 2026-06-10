package partnerledger

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

var safeFilenameRe = regexp.MustCompile(`[^\p{L}\p{N}_-]+`)

func styleExcelHeader(f *excelize.File, sheet string) {
	style, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#2563EB"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	_ = f.SetRowStyle(sheet, 1, 1, style)
}

func (s *Service) SaleOrderTemplate(ctx context.Context, companyID, warehouseID string, contactName *string) ([]byte, string, error) {
	whName, err := s.repo.WarehouseExists(ctx, warehouseID, companyID)
	if err != nil {
		return nil, "", err
	}
	variants, err := s.repo.ListCatalogVariantsForTemplate(ctx, companyID, warehouseID, 500)
	if err != nil {
		return nil, "", err
	}

	f := excelize.NewFile()
	defer f.Close()
	guide := "Yoriqnoma"
	f.SetSheetName("Sheet1", guide)
	f.SetCellValue(guide, "A1", "Qadam")
	f.SetCellValue(guide, "B1", "Ko'rsatma")
	contactSuffix := ""
	if contactName != nil && strings.TrimSpace(*contactName) != "" {
		contactSuffix = " · Hamkor: " + strings.TrimSpace(*contactName)
	}
	guideRows := [][]string{
		{"1", "«Buyurtma» varag'ida mahsulot kodi (SKU), variant va miqdorni kiriting."},
		{"2", "Variant majburiy emas — faqat SKU yoki shtrix-kod yetarli bo'lsa."},
		{"3", "Bir mahsulotning bir nechta rangi bo'lsa: SKU + Variant (masalan A-001 va Tilla)."},
		{"4", "«Katalog» varag'idan to'g'ri ma'lumotlarni ko'chirib oling."},
		{"5", "Tayyor faylni Hamkor daftari → Sotish → Excel dan yuklang."},
		{"—", fmt.Sprintf("Ombor: %s%s", whName, contactSuffix)},
	}
	for i, row := range guideRows {
		f.SetCellValue(guide, fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue(guide, fmt.Sprintf("B%d", i+2), row[1])
	}

	catalog := "Katalog"
	f.NewSheet(catalog)
	catalogHeaders := []string{"SKU", "Shtrix-kod", "Mahsulot", "Variant", "Sotuv narxi", "Valyuta", "Qoldiq", "Birlik"}
	for i, h := range catalogHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(catalog, cell, h)
	}
	styleExcelHeader(f, catalog)
	for i, v := range variants {
		row := i + 2
		sku, barcode := "", ""
		if v.SKU != nil {
			sku = *v.SKU
		}
		if v.Barcode != nil {
			barcode = *v.Barcode
		}
		vals := []any{sku, barcode, v.ProductName, v.Name, v.SalePrice, NormalizeCurrency(v.Currency), v.StockQty, v.Unit}
		for c, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(catalog, cell, val)
		}
	}

	order := "Buyurtma"
	f.NewSheet(order)
	orderHeaders := []string{"SKU", "Shtrix-kod", "Mahsulot (ixtiyoriy)", "Variant", "Miqdor"}
	for i, h := range orderHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(order, cell, h)
	}
	styleExcelHeader(f, order)
	examples := [][]any{
		{"A-001", "", "A-001", "Tilla", 8},
		{"", "", "A-001", "shampan", 10},
	}
	for i, ex := range examples {
		row := i + 2
		for c, val := range ex {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(order, cell, val)
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	safeWh := safeFilenameRe.ReplaceAllString(whName, "_")
	if len(safeWh) > 24 {
		safeWh = safeWh[:24]
	}
	return buf.Bytes(), fmt.Sprintf("hamkor-buyurtma-shablon-%s.xlsx", safeWh), nil
}

func (s *Service) ExportSaleOrderExcel(ctx context.Context, companyID, contactID, batchID string) ([]byte, string, error) {
	contactName, err := s.repo.GetContactName(ctx, companyID, contactID)
	if err != nil {
		return nil, "", err
	}
	opID, err := s.repo.FindSaleOrderOperationID(ctx, companyID, contactID, batchID)
	if err != nil {
		return nil, "", err
	}
	op, err := s.repo.FindOperation(ctx, companyID, opID)
	if err != nil {
		return nil, "", err
	}
	movements, err := s.repo.LoadMovementsByBatch(ctx, companyID, batchID)
	if err != nil {
		return nil, "", err
	}
	return buildSaleOrderExcel(contactName, batchID, op, movements)
}

func (s *Service) ExportOperationExcel(ctx context.Context, companyID, operationID string) ([]byte, string, error) {
	op, err := s.repo.FindOperation(ctx, companyID, operationID)
	if err != nil {
		return nil, "", err
	}
	if op.SourceType != nil && *op.SourceType == "PARTNER_SALE_ORDER" && op.SourceID != nil {
		return s.ExportSaleOrderExcel(ctx, companyID, op.ContactID, *op.SourceID)
	}
	contactName, err := s.repo.GetContactName(ctx, companyID, op.ContactID)
	if err != nil {
		return nil, "", err
	}
	detail, err := s.getOperationLines(ctx, companyID, operationID)
	if err != nil {
		return nil, "", err
	}
	lines, _ := detail["lines"].([]map[string]any)
	return buildOperationExcel(contactName, op, lines)
}

func (s *Service) ExportOperationsExcel(ctx context.Context, companyID, contactID string) ([]byte, string, error) {
	contactName, err := s.repo.GetContactName(ctx, companyID, contactID)
	if err != nil {
		return nil, "", err
	}
	operations, err := s.repo.ListContactOperationsForExport(ctx, companyID, contactID)
	if err != nil {
		return nil, "", err
	}
	batchIDs := []string{}
	opDateByBatch := map[string]string{}
	for _, op := range operations {
		if op.SourceType != nil && *op.SourceType == "PARTNER_SALE_ORDER" && op.SourceID != nil {
			batchIDs = append(batchIDs, *op.SourceID)
			opDateByBatch[*op.SourceID] = op.OperationDate.Format("2006-01-02")
		}
	}
	movements, err := s.repo.LoadSaleMovementsForContact(ctx, companyID, batchIDs)
	if err != nil {
		return nil, "", err
	}

	f := excelize.NewFile()
	defer f.Close()
	opsSheet := "Operatsiyalar"
	f.SetSheetName("Sheet1", opsSheet)
	opHeaders := []string{"Sana", "Tur", "Summa", "Valyuta", "Mahsulotlar", "Eslatma", "Manba", "Kim"}
	for i, h := range opHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(opsSheet, cell, h)
	}
	for i, op := range operations {
		row := i + 2
		label := OperationTypeLabels[op.Type]
		if label == "" {
			label = op.Type
		}
		source := "Qo'lda"
		if op.SourceType != nil && *op.SourceType != "" {
			source = *op.SourceType
		}
		notes := ""
		if op.Notes != nil {
			notes = *op.Notes
		}
		products := ""
		if op.ProductSummary != nil {
			products = *op.ProductSummary
		}
		vals := []any{
			op.OperationDate.Format("2006-01-02"), label, op.Amount, op.Currency,
			products, notes, source, op.CreatedByName,
		}
		for c, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(opsSheet, cell, val)
		}
	}

	linesSheet := "Sotuv qatorlari"
	f.NewSheet(linesSheet)
	lineHeaders := []string{"Buyurtma ID", "Sana", "Ombor", "Mahsulot", "Variant", "SKU", "Miqdor", "Birlik", "Sotuv narxi", "Valyuta", "Qator jami"}
	for i, h := range lineHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(linesSheet, cell, h)
	}
	for i, m := range movements {
		row := i + 2
		lineTotal := m.Quantity * m.SalePrice
		vals := []any{
			m.BatchID, opDateByBatch[m.BatchID], m.WarehouseName, m.ProductName, m.VariantName,
			m.SKU, m.Quantity, m.Unit, m.SalePrice, NormalizeCurrency(m.Currency), lineTotal,
		}
		for c, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(linesSheet, cell, val)
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	safeName := safeFilenameRe.ReplaceAllString(contactName, "_")
	if len(safeName) > 40 {
		safeName = safeName[:40]
	}
	date := time.Now().Format("2006-01-02")
	return buf.Bytes(), fmt.Sprintf("hamkor-daftari-%s-%s.xlsx", safeName, date), nil
}

func buildSaleOrderExcel(contactName, batchID string, op *operationRow, movements []movementLineRow) ([]byte, string, error) {
	f := excelize.NewFile()
	defer f.Close()
	info := "Buyurtma"
	f.SetSheetName("Sheet1", info)
	infoRows := [][]string{
		{"Hamkor", contactName},
		{"Sana", op.OperationDate.Format("2006-01-02")},
		{"Summa", fmt.Sprintf("%v", op.Amount)},
		{"Valyuta", op.Currency},
		{"To'lov / eslatma", derefString(op.Notes)},
		{"Buyurtma ID", batchID},
	}
	f.SetCellValue(info, "A1", "Maydon")
	f.SetCellValue(info, "B1", "Qiymat")
	for i, row := range infoRows {
		f.SetCellValue(info, fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue(info, fmt.Sprintf("B%d", i+2), row[1])
	}

	sheet := "Mahsulotlar"
	f.NewSheet(sheet)
	headers := []string{"#", "SKU", "Shtrix-kod", "Mahsulot", "Variant", "Miqdor", "Birlik", "Sotuv narxi", "Valyuta", "Qator jami", "Ombor"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}
	styleExcelHeader(f, sheet)
	grand := 0.0
	for i, m := range movements {
		row := i + 2
		qty := m.Quantity
		lineTotal := qty * m.SalePrice
		grand += lineTotal
		vals := []any{i + 1, m.SKU, m.Barcode, m.ProductName, m.VariantName, qty, m.Unit, m.SalePrice, NormalizeCurrency(m.Currency), lineTotal, m.WarehouseName}
		for c, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(sheet, cell, val)
		}
	}
	totalRow := len(movements) + 3
	f.SetCellValue(sheet, fmt.Sprintf("D%d", totalRow), "JAMI")
	f.SetCellValue(sheet, fmt.Sprintf("J%d", totalRow), grand)

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	safeName := safeFilenameRe.ReplaceAllString(contactName, "_")
	if len(safeName) > 32 {
		safeName = safeName[:32]
	}
	date := op.OperationDate.Format("2006-01-02")
	return buf.Bytes(), fmt.Sprintf("sotuv-%s-%s.xlsx", safeName, date), nil
}

func buildOperationExcel(contactName string, op *operationRow, lines []map[string]any) ([]byte, string, error) {
	f := excelize.NewFile()
	defer f.Close()
	info := "Operatsiya"
	f.SetSheetName("Sheet1", info)
	typeLabel := OperationTypeLabels[op.Type]
	if typeLabel == "" {
		typeLabel = op.Type
	}
	note := derefString(op.Notes)
	if note == "" {
		note = derefString(op.ProductSummary)
	}
	if note == "" {
		note = "—"
	}
	infoRows := [][]string{
		{"Hamkor", contactName},
		{"Tur", typeLabel},
		{"Sana", op.OperationDate.Format("2006-01-02")},
		{"Summa", fmt.Sprintf("%v", op.Amount)},
		{"Valyuta", op.Currency},
		{"Eslatma", note},
	}
	f.SetCellValue(info, "A1", "Maydon")
	f.SetCellValue(info, "B1", "Qiymat")
	for i, row := range infoRows {
		f.SetCellValue(info, fmt.Sprintf("A%d", i+2), row[0])
		f.SetCellValue(info, fmt.Sprintf("B%d", i+2), row[1])
	}

	sheet := "Mahsulotlar"
	f.NewSheet(sheet)
	headers := []string{"#", "SKU", "Mahsulot", "Variant", "Miqdor", "Narx", "Valyuta", "Jami", "Ombor"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}
	styleExcelHeader(f, sheet)
	for i, line := range lines {
		row := i + 2
		vals := []any{
			i + 1, line["sku"], line["productName"], line["variantName"], line["quantity"],
			line["salePrice"], line["currency"], line["lineTotal"], line["warehouseName"],
		}
		for c, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(c+1, row)
			f.SetCellValue(sheet, cell, val)
		}
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, "", err
	}
	safeName := safeFilenameRe.ReplaceAllString(contactName, "_")
	if len(safeName) > 32 {
		safeName = safeName[:32]
	}
	date := op.OperationDate.Format("2006-01-02")
	return buf.Bytes(), fmt.Sprintf("operatsiya-%s-%s.xlsx", safeName, date), nil
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
