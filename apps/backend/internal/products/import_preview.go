package products

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/xuri/excelize/v2"
)

type excelParseResult struct {
	SheetName      string
	HasStockColumn bool
	ExcelFormat    productImportExcelFormat
	ColumnGuide    map[string]any
	Rows           []parsedImportRow
}

type parsedImportRow struct {
	Name, VariantName, Color, Category, Unit, UnitRaw, SKU, Barcode, Currency, WarehouseName, VariantID string
	PurchasePrice, SalePrice                                                                               float64
	InitialStockRaw                                                                                        *float64
	UnitInvalid                                                                                            bool
}

type catalogVariant struct {
	ID, ProductID, Name, ProductName, SKU, Barcode, Status, Currency, Unit, Color, VariantLabel string
	SalePrice, PurchasePrice, PreviousStock                                                      float64
}

func (s *Service) buildImportPreview(ctx context.Context, companyID, warehouseID, importMode string, parsed excelParseResult) (map[string]any, error) {
	if importMode != "add" && importMode != "subtract" && importMode != "set" {
		importMode = "set"
	}
	warehouses, _ := s.listActiveWarehouses(ctx, companyID)
	forcedWH := strings.TrimSpace(warehouseID)

	propagateSKUs(parsed.Rows)

	fileStockMode := detectFileStockMode(parsed.Rows, parsed.HasStockColumn)
	defaultImportMode := "set"
	if fileStockMode == "with_stock" {
		defaultImportMode = "add"
	}

	catalog, err := s.loadImportCatalog(ctx, companyID, forcedWH, parsed.Rows)
	if err != nil {
		return nil, err
	}

	barcodeCounts := map[string]int{}
	variantKeyCounts := map[string]int{}
	for _, row := range parsed.Rows {
		if b := strings.TrimSpace(row.Barcode); b != "" {
			barcodeCounts[strings.ToLower(b)]++
		}
		if strings.TrimSpace(row.Name) != "" {
			variantKeyCounts[importVariantIdentityKey(row.Name, row.VariantName, row.Color)]++
		}
	}

	previewRows := make([]map[string]any, 0, len(parsed.Rows))
	for i, row := range parsed.Rows {
		item := previewRowFromParsed(row, i+2, fileStockMode)
		errs := validatePreviewRow(row, parsed.ExcelFormat)

		whID := forcedWH
		if whID == "" {
			whID = matchWarehouse(warehouses, row.WarehouseName)
		}
		item["warehouseId"] = whID
		if whID == "" {
			errs = append(errs, "Ombor topilmadi")
		}

		if b := strings.TrimSpace(row.Barcode); b != "" && barcodeCounts[strings.ToLower(b)] > 1 {
			errs = append(errs, fmt.Sprintf("Fayl ichida barkod takrorlangan: %s", b))
		}
		fileVariantKey := importVariantIdentityKey(row.Name, row.VariantName, row.Color)
		if strings.TrimSpace(row.Name) != "" && variantKeyCounts[fileVariantKey] > 1 {
			label := row.Color
			if label == "" {
				label = row.VariantName
			}
			if label == "" {
				label = "variant"
			}
			errs = append(errs, fmt.Sprintf("Fayl ichida takrorlangan qator: %s — %s", row.Name, label))
		}

		existing := matchCatalogVariant(catalog, row)
		previousStock := 0.0
		previousUnit := "dona"
		if existing != nil {
			item["existingVariantId"] = existing.ID
			item["existingProductId"] = existing.ProductID
			item["catalogMatch"] = true
			item["previousStock"] = existing.PreviousStock
			item["previousSalePrice"] = existing.SalePrice
			item["previousPurchasePrice"] = existing.PurchasePrice
			item["previousUnit"] = existing.Unit
			previousStock = existing.PreviousStock
			previousUnit = existing.Unit
		} else {
			item["catalogMatch"] = false
			item["previousStock"] = 0
			item["previousUnit"] = "dona"
		}

		stockWillApply := shouldApplyStock(row.InitialStockRaw, previousStock, fileStockMode, "apply_all")
		priceChanged := existing != nil && (row.SalePrice != existing.SalePrice ||
			row.PurchasePrice != existing.PurchasePrice ||
			row.Currency != existing.Currency)
		unitChanged := existing != nil && strings.TrimSpace(row.Unit) != "" &&
			normalizeProductUnit(row.Unit) != normalizeProductUnit(existing.Unit)

		rowAction, stockAction := resolveRowActions(existing, fileStockMode, row.InitialStockRaw, stockWillApply, priceChanged, unitChanged)
		if existing != nil && stockWillApply && row.InitialStockRaw != nil {
			target := computeTargetStock(previousStock, *row.InitialStockRaw, importMode)
			delta := target - previousStock
			if delta < 0 && previousStock+delta < -0.0001 {
				errs = append(errs, fmt.Sprintf(
					"Omborda yetarli qoldiq yo'q. Mavjud: %g, chiqim: %g (Excel: %g, rejim: %s)",
					previousStock, math.Abs(delta), *row.InitialStockRaw, importMode,
				))
				rowAction = "skip"
			}
		}

		if len(errs) > 0 {
			item["errors"] = errs
			item["rowAction"] = "skip"
			item["stockAction"] = "skip"
		} else {
			item["errors"] = []string{}
			item["rowAction"] = rowAction
			item["stockAction"] = stockAction
		}
		_ = previousUnit
		previewRows = append(previewRows, item)
	}

	return summarizePreview(previewRows, fileStockMode, defaultImportMode, importMode, parsed.SheetName, parsed.ExcelFormat, parsed.ColumnGuide), nil
}

func previewRowFromParsed(row parsedImportRow, rowNumber int, fileStockMode string) map[string]any {
	item := map[string]any{
		"rowNumber":     rowNumber,
		"name":          row.Name,
		"color":         row.Color,
		"variant":       row.VariantName,
		"variantName":   row.VariantName,
		"sku":           row.SKU,
		"barcode":       row.Barcode,
		"purchasePrice": row.PurchasePrice,
		"salePrice":     row.SalePrice,
		"currency":      row.Currency,
		"unit":          row.Unit,
		"categoryName":  row.Category,
		"warehouseName": row.WarehouseName,
		"fileStockMode": fileStockMode,
	}
	if row.VariantID != "" {
		item["variantId"] = row.VariantID
	}
	if row.InitialStockRaw != nil {
		item["initialStockRaw"] = *row.InitialStockRaw
		item["initialStock"] = *row.InitialStockRaw
	}
	return item
}

func validatePreviewRow(row parsedImportRow, format productImportExcelFormat) []string {
	errs := []string{}
	if strings.TrimSpace(row.Name) == "" {
		errs = append(errs, "Mahsulot nomi bo'sh bo'lishi mumkin emas")
	}
	if !isFiniteFloat(row.PurchasePrice) || row.PurchasePrice < 0 {
		errs = append(errs, formatImportPriceError("purchase", format))
	}
	if !isFiniteFloat(row.SalePrice) || row.SalePrice < 0 {
		errs = append(errs, formatImportPriceError("sale", format))
	}
	if row.InitialStockRaw != nil {
		unit := row.Unit
		if unit == "" {
			unit = "dona"
		}
		if stockErr := stockQuantityImportError(*row.InitialStockRaw, unit); stockErr != "" {
			errs = append(errs, stockErr)
		}
	}
	if row.Currency != "UZS" && row.Currency != "USD" {
		errs = append(errs, formatImportCurrencyError(format, row.Currency))
	}
	if row.UnitRaw != "" && row.UnitInvalid {
		errs = append(errs, formatProductUnitImportError(row.UnitRaw))
	}
	return errs
}

func summarizePreview(rows []map[string]any, fileStockMode, defaultImportMode, importMode, sheetName string, excelFormat productImportExcelFormat, columnGuide map[string]any) map[string]any {
	importable := 0
	confirmable := 0
	stockApply := 0
	invalid := 0
	skipped := 0
	create := 0
	update := 0

	for _, r := range rows {
		errs, _ := r["errors"].([]string)
		if len(errs) > 0 {
			invalid++
			continue
		}
		if isConfirmableRow(r) {
			confirmable++
		}
		rowAction, _ := r["rowAction"].(string)
		if rowAction != "skip" {
			importable++
		}
		if rowAction == "skip" {
			skipped++
		}
		if rowAction == "create" {
			create++
		}
		if rowAction == "update" {
			update++
		}
		if stockAction, _ := r["stockAction"].(string); stockAction == "apply" && fileStockMode == "with_stock" {
			if _, ok := r["initialStockRaw"]; ok {
				stockApply++
			}
		}
	}

	return map[string]any{
		"total":             len(rows),
		"valid":             importable,
		"confirmable":       confirmable,
		"stockApplyCount":   stockApply,
		"invalid":           invalid,
		"skipped":           skipped,
		"create":            create,
		"update":            update,
		"fileStockMode":     fileStockMode,
		"defaultImportMode": defaultImportMode,
		"importMode":        importMode,
		"excelFormat":       string(excelFormat),
		"worksheetName":     sheetName,
		"columnGuide":       columnGuide,
		"rows":              rows,
		"totalRows":         len(rows),
		"errorRows":         invalid,
	}
}

func isConfirmableRow(row map[string]any) bool {
	if errs, ok := row["errors"].([]string); ok && len(errs) > 0 {
		return false
	}
	rowAction, _ := row["rowAction"].(string)
	if rowAction != "skip" {
		return true
	}
	fileStockMode, _ := row["fileStockMode"].(string)
	if fileStockMode == "without_stock" {
		return false
	}
	qty, ok := excelQtyFromMap(row)
	return ok && qty > 0
}

func excelQtyFromMap(row map[string]any) (float64, bool) {
	if v, ok := row["initialStockRaw"].(float64); ok {
		return v, true
	}
	if v, ok := row["initialStock"].(float64); ok {
		return v, true
	}
	return 0, false
}

func detectFileStockMode(rows []parsedImportRow, hasStockColumn bool) string {
	for _, r := range rows {
		if r.InitialStockRaw != nil {
			return "with_stock"
		}
	}
	if hasStockColumn {
		return "with_stock"
	}
	return "without_stock"
}

func shouldApplyStock(initial *float64, previous float64, fileStockMode, policy string) bool {
	if fileStockMode == "without_stock" {
		return false
	}
	if policy == "apply_all" {
		return initial != nil
	}
	if initial == nil || *initial == 0 {
		return false
	}
	if *initial == previous {
		return false
	}
	return true
}

func computeTargetStock(current, excel float64, mode string) float64 {
	switch mode {
	case "add":
		return current + excel
	case "subtract":
		return math.Max(0, current-excel)
	default:
		return excel
	}
}

func resolveRowActions(existing *catalogVariant, fileStockMode string, initial *float64, stockWillApply, priceChanged, unitChanged bool) (rowAction, stockAction string) {
	if existing != nil {
		rowAction = "update"
		if isArchivedVariant(existing) {
			if stockWillApply {
				stockAction = "apply"
			} else {
				stockAction = "skip"
			}
			return rowAction, stockAction
		}
		if !stockWillApply && !priceChanged && !unitChanged {
			rowAction = "skip"
		}
		if stockWillApply {
			stockAction = "apply"
		} else {
			stockAction = "skip"
		}
		return rowAction, stockAction
	}
	rowAction = "create"
	if fileStockMode == "with_stock" && (initial == nil || *initial == 0) {
		stockAction = "skip"
	} else if fileStockMode == "without_stock" {
		stockAction = "skip"
	} else {
		stockAction = "apply"
	}
	return rowAction, stockAction
}

func isArchivedVariant(v *catalogVariant) bool {
	return v != nil && strings.ToUpper(v.Status) == "ARCHIVED"
}


func propagateSKUs(rows []parsedImportRow) {
	lastSKU, lastName := "", ""
	for i := range rows {
		name := strings.TrimSpace(rows[i].Name)
		sku := strings.TrimSpace(rows[i].SKU)
		if sku != "" {
			lastSKU = sku
			lastName = name
			continue
		}
		if name == lastName && lastSKU != "" {
			rows[i].SKU = lastSKU
		} else if name != lastName {
			lastSKU = ""
			lastName = name
		}
	}
}

func matchCatalogVariant(catalog *importCatalogIndex, row parsedImportRow) *catalogVariant {
	if catalog == nil {
		return nil
	}
	if id := strings.TrimSpace(row.VariantID); id != "" {
		if v := catalog.byID[id]; v != nil {
			return v
		}
	}
	if b := strings.TrimSpace(row.Barcode); b != "" {
		if v := catalog.byBarcode[strings.ToLower(b)]; v != nil {
			return v
		}
	}
	nvKey := importVariantIdentityKey(row.Name, row.VariantName, row.Color)
	if v := catalog.byNameVariant[nvKey]; v != nil {
		return v
	}
	if sku := strings.TrimSpace(row.SKU); sku != "" {
		if v := catalog.bySKU[strings.ToLower(sku)]; v != nil {
			skuNv := importVariantIdentityKey(v.ProductName, v.VariantLabel, v.Color)
			if skuNv == nvKey {
				return v
			}
		}
	}
	return nil
}

type importCatalogIndex struct {
	byID, bySKU, byBarcode, byNameVariant map[string]*catalogVariant
}

func (s *Service) loadImportCatalog(ctx context.Context, companyID, warehouseID string, rows []parsedImportRow) (*importCatalogIndex, error) {
	skus := []string{}
	barcodes := []string{}
	names := []string{}
	for _, r := range rows {
		if v := strings.TrimSpace(r.SKU); v != "" {
			skus = append(skus, strings.ToLower(v))
		}
		if v := strings.TrimSpace(r.Barcode); v != "" {
			barcodes = append(barcodes, strings.ToLower(v))
		}
		if v := strings.TrimSpace(r.Name); v != "" {
			names = append(names, strings.ToLower(v))
		}
	}
	if len(skus) == 0 && len(barcodes) == 0 && len(names) == 0 {
		return &importCatalogIndex{
			byID:          map[string]*catalogVariant{},
			bySKU:         map[string]*catalogVariant{},
			byBarcode:     map[string]*catalogVariant{},
			byNameVariant: map[string]*catalogVariant{},
		}, nil
	}

	q := `
		SELECT pv.id, pv."productId", pv.name, p.name, COALESCE(pv.sku,''), COALESCE(pv.barcode,''),
		       pv.status, COALESCE(pv.currency,'UZS'), COALESCE(p.unit,'dona'),
		       COALESCE(pv."salePrice",0)::float8, COALESCE(pv."purchasePrice",0)::float8,
		       COALESCE(sb.quantity,0)::float8, COALESCE(pv."attributesJson",'{}'::jsonb)
		FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		LEFT JOIN "StockBalance" sb ON sb."productVariantId" = pv.id AND sb."warehouseId" = $2
		WHERE pv."companyId" = $1 AND (
			(cardinality($3::text[]) > 0 AND lower(pv.sku) = ANY($3)) OR
			(cardinality($4::text[]) > 0 AND lower(pv.barcode) = ANY($4)) OR
			(cardinality($5::text[]) > 0 AND lower(p.name) = ANY($5))
		)
	`
	dbRows, err := s.pool.Query(ctx, q, companyID, warehouseID, skus, barcodes, names)
	if err != nil {
		return nil, err
	}
	defer dbRows.Close()

	idx := &importCatalogIndex{
		byID:          map[string]*catalogVariant{},
		bySKU:         map[string]*catalogVariant{},
		byBarcode:     map[string]*catalogVariant{},
		byNameVariant: map[string]*catalogVariant{},
	}
	for dbRows.Next() {
		var v catalogVariant
		var attrs []byte
		if err := dbRows.Scan(&v.ID, &v.ProductID, &v.Name, &v.ProductName, &v.SKU, &v.Barcode,
			&v.Status, &v.Currency, &v.Unit, &v.SalePrice, &v.PurchasePrice, &v.PreviousStock, &attrs); err != nil {
			return nil, err
		}
		v.Color, v.VariantLabel = exportVariantExcelFields(v.Name, attrs)
		mergeCatalog(idx, &v)
	}
	return idx, dbRows.Err()
}

func exportVariantExcelFields(variantName string, attrsJSON []byte) (color, variant string) {
	attrs := map[string]any{}
	_ = json.Unmarshal(attrsJSON, &attrs)
	colorRaw := attrs["color"]
	if colorRaw == nil {
		colorRaw = attrs["rang"]
	}
	if colorRaw != nil {
		color = strings.TrimSpace(fmt.Sprint(colorRaw))
	}
	variantName = strings.TrimSpace(variantName)
	if variantName != "" && !strings.EqualFold(variantName, color) && !isGenericImportVariantName(variantName) {
		variant = variantName
	}
	return color, variant
}

func mergeCatalog(idx *importCatalogIndex, v *catalogVariant) {
	idx.byID[v.ID] = preferVariant(idx.byID[v.ID], v)
	if v.SKU != "" {
		k := strings.ToLower(v.SKU)
		idx.bySKU[k] = preferVariant(idx.bySKU[k], v)
	}
	if v.Barcode != "" {
		k := strings.ToLower(v.Barcode)
		idx.byBarcode[k] = preferVariant(idx.byBarcode[k], v)
	}
	k := importVariantIdentityKey(v.ProductName, v.VariantLabel, v.Color)
	if k != "|default" {
		idx.byNameVariant[k] = preferVariant(idx.byNameVariant[k], v)
	}
}

func preferVariant(current, next *catalogVariant) *catalogVariant {
	if current == nil {
		return next
	}
	if strings.ToUpper(current.Status) == "ACTIVE" {
		return current
	}
	if strings.ToUpper(next.Status) == "ACTIVE" {
		return next
	}
	return current
}

func parseImportExcelFile(data []byte) (excelParseResult, error) {
	f, err := excelize.OpenReader(&byteReader{b: data})
	if err != nil {
		return excelParseResult{}, fmt.Errorf("Excel o'qib bo'lmadi: %w", err)
	}
	defer f.Close()
	sheet := findProductImportWorksheet(f)
	if sheet == "" {
		return excelParseResult{}, ErrBadInput
	}
	format := detectProductImportExcelFormat(f, sheet)
	columnGuide := getProductImportColumnGuide(format)
	trailing := resolveImportTrailingColumnIndexes(f, sheet)
	hasStockColumn := worksheetHasStockColumn(f, sheet)

	out := []parsedImportRow{}
	rows, _ := f.GetRows(sheet)
	maxRow := len(rows)
	if maxRow < 2 {
		return excelParseResult{}, ErrBadInput
	}
	for rowNum := 2; rowNum <= maxRow; rowNum++ {
		parsed := parseProductImportExcelRow(f, sheet, rowNum, format, trailing)
		if isProductImportRowEmpty(parsed, format, f, sheet, rowNum) {
			continue
		}
		if parsed.InitialStockRaw != nil {
			unit := parsed.Unit
			if unit == "" {
				unit = "dona"
			}
			normalized := normalizeStockQuantity(*parsed.InitialStockRaw, unit)
			parsed.InitialStockRaw = &normalized
		}
		if parsed.Currency == "" {
			parsed.Currency = "UZS"
		}
		out = append(out, parsed)
	}
	return excelParseResult{
		SheetName: sheet, HasStockColumn: hasStockColumn,
		ExcelFormat: format, ColumnGuide: columnGuide, Rows: out,
	}, nil
}

// parseImportExcel — eski chaqiruvlar uchun.
func parseImportExcel(data []byte) ([]parsedImportRow, error) {
	res, err := parseImportExcelFile(data)
	return res.Rows, err
}
