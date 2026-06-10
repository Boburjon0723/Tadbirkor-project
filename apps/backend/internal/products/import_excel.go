package products

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

type productImportExcelFormat string

const (
	excelFormatSplit  productImportExcelFormat = "split"
	excelFormatLegacy productImportExcelFormat = "legacy"
)

type importTrailingCols struct {
	stockCol, unitCol, categoryCol, warehouseCol, variantIDCol int
}

type importColumnGuideItem struct {
	Letter   string `json:"letter"`
	Header   string `json:"header"`
	Required bool   `json:"required"`
	Hint     string `json:"hint"`
}

var uuidRE = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func isFiniteFloat(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func importHeaderText(f *excelize.File, sheet string, col int) string {
	cell, _ := excelize.CoordinatesToCellName(col, 1)
	v, _ := f.GetCellValue(sheet, cell)
	return strings.ToLower(strings.TrimSpace(v))
}

func findProductImportWorksheet(f *excelize.File) string {
	for _, name := range f.GetSheetList() {
		if strings.EqualFold(strings.TrimSpace(name), "import") {
			return name
		}
	}
	for _, name := range f.GetSheetList() {
		h1 := importHeaderText(f, name, 1)
		if strings.Contains(h1, "mahsulot") || strings.Contains(h1, "product") {
			return name
		}
	}
	list := f.GetSheetList()
	if len(list) > 0 {
		return list[0]
	}
	return ""
}

func detectProductImportExcelFormat(f *excelize.File, sheet string) productImportExcelFormat {
	h4 := importHeaderText(f, sheet, 4)
	h5 := importHeaderText(f, sheet, 5)
	h6 := importHeaderText(f, sheet, 6)
	h7 := importHeaderText(f, sheet, 7)
	h8 := importHeaderText(f, sheet, 8)

	if strings.Contains(h4, "rangi/varianti") {
		return excelFormatLegacy
	}
	splitPriceCol := strings.Contains(h7, "sotuv") || strings.Contains(h7, "sale") || strings.Contains(h7, "narxi")
	splitCurrencyCol := strings.Contains(h8, "valyuta") || strings.Contains(h8, "currency") || strings.Contains(h8, "uzs")
	if (h4 == "rang" || strings.HasPrefix(h4, "rang")) &&
		(strings.Contains(h5, "variant") || strings.HasPrefix(h5, "variant")) &&
		splitPriceCol && splitCurrencyCol {
		return excelFormatSplit
	}
	if h4 == "rang" || strings.HasPrefix(h4, "rang") {
		return excelFormatSplit
	}
	if strings.Contains(h5, "variant nomi") || strings.HasPrefix(h5, "variant") {
		return excelFormatSplit
	}
	legacyCurrencyCol := strings.Contains(h7, "valyuta") || strings.Contains(h7, "currency") || strings.Contains(h7, "uzs")
	legacySaleCol := strings.Contains(h6, "sotuv") || strings.Contains(h6, "sale") || strings.Contains(h6, "narxi")
	if legacyCurrencyCol && legacySaleCol && !strings.Contains(h5, "variant") {
		return excelFormatLegacy
	}
	if strings.Contains(h6, "kirim") && !strings.Contains(h5, "variant") {
		return excelFormatLegacy
	}
	return excelFormatSplit
}

func worksheetHasStockColumn(f *excelize.File, sheet string) bool {
	for col := 1; col <= 24; col++ {
		h := importHeaderText(f, sheet, col)
		if h == "" {
			continue
		}
		if strings.Contains(h, "qoldiq") || strings.Contains(h, "stock") || strings.Contains(h, "boshlang") ||
			strings.Contains(h, "kirim") || strings.Contains(h, "miqdor") || strings.Contains(h, "soni") ||
			strings.Contains(h, "quantity") || strings.Contains(h, "qty") || strings.Contains(h, "kol") {
			return true
		}
	}
	return false
}

func resolveImportTrailingColumnIndexes(f *excelize.File, sheet string) importTrailingCols {
	cols := importTrailingCols{stockCol: 9, categoryCol: 10, warehouseCol: 11, variantIDCol: 12}
	for col := 1; col <= 24; col++ {
		h := importHeaderText(f, sheet, col)
		if h == "" {
			continue
		}
		switch {
		case strings.Contains(h, "variant id") || strings.Contains(h, "variantid"):
			cols.variantIDCol = col
		case strings.Contains(h, "ombor") || strings.Contains(h, "warehouse"):
			cols.warehouseCol = col
		case strings.Contains(h, "kategor"):
			cols.categoryCol = col
		case strings.Contains(h, "birlik") || strings.Contains(h, "o'lchov") || strings.Contains(h, "olchov") || h == "unit" || strings.Contains(h, "birligi"):
			cols.unitCol = col
		case strings.Contains(h, "qoldiq") || strings.Contains(h, "stock") || strings.Contains(h, "boshlang") ||
			strings.Contains(h, "kirim") || strings.Contains(h, "miqdor") || strings.Contains(h, "soni") ||
			strings.Contains(h, "quantity") || strings.Contains(h, "qty") || strings.Contains(h, "kol"):
			cols.stockCol = col
		}
	}
	if cols.unitCol > 0 {
		if cols.categoryCol <= cols.unitCol {
			cols.categoryCol = cols.unitCol + 1
		}
		if cols.warehouseCol <= cols.unitCol {
			cols.warehouseCol = maxInt(cols.categoryCol+1, cols.unitCol+2)
		}
		if cols.variantIDCol <= cols.warehouseCol {
			cols.variantIDCol = cols.warehouseCol + 1
		}
	}
	return cols
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func getProductImportColumnGuide(format productImportExcelFormat) map[string]any {
	if format == excelFormatLegacy {
		return map[string]any{
			"format": "legacy",
			"columns": []importColumnGuideItem{
				{"A", "Mahsulot Nomi", true, "Majburiy"},
				{"B", "SKU", false, "Ixtiyoriy, variantlarni guruhlash uchun"},
				{"C", "Shtrix-kod", false, "Har variant uchun noyob"},
				{"D", "Rangi/Varianti", false, "Masalan: Qora / L"},
				{"E", "—", false, "Bo'sh qoldiring"},
				{"F", "Kirim Narxi", false, "Raqam"},
				{"G", "Sotuv Narxi", false, "Raqam (5.8 yoki 5,8)"},
				{"H", "Valyuta", false, "Faqat USD yoki UZS"},
				{"I", "Boshlang'ich Qoldiq", false, "Butun son"},
				{"J", "Birlik", false, "dona, kg, l, m"},
				{"K", "Kategoriya", false, "Ota > Bola"},
				{"L", "Ombor Nomi", false, "UI ombori ishlatiladi"},
			},
			"tips": []string{
				"Eski shablon (Rangi/Varianti bitta ustunda). Yangi shablonni yuklab oling.",
				`Varaq nomi "Import" bo'lishi kerak.`,
			},
		}
	}
	return map[string]any{
		"format": "split",
		"columns": []importColumnGuideItem{
			{"A", "Mahsulot Nomi", true, "Majburiy"},
			{"B", "SKU", false, "Bir xil SKU = bir mahsulot, turli variantlar"},
			{"C", "Shtrix-kod", false, "Har variant uchun noyob"},
			{"D", "Rang", false, "Masalan: Qora, Ko'k"},
			{"E", "Variant nomi", false, "Masalan: L, XL"},
			{"F", "Kirim Narxi", false, "Raqam"},
			{"G", "Sotuv Narxi", false, "Raqam (5.8 yoki 5,8)"},
			{"H", "Valyuta (UZS/USD)", false, "Faqat USD yoki UZS — raqam emas!"},
			{"I", "Boshlang'ich Qoldiq", false, "1,23 yoki 1.23; kg/l/m + J birlik"},
			{"J", "Birlik", false, "dona, kg, l (litr), m (metr)"},
			{"K", "Kategoriya", false, "Masalan: Kiyim > Erkaklar"},
			{"L", "Ombor Nomi", false, "Inventarda tanlangan ombor ishlatiladi"},
		},
		"tips": []string{
			"1-qator sarlavha — o'zgartirmang. Ma'lumot 2-qatordan.",
			`Faqat "Import" varag'idagi faylni yuklang (Yoriqnoma/Lookup emas).`,
			"Narx G ustunida, valyuta H ustunida alohida. H ga raqam (5, 5.8) yozmang.",
			"Birlik (J): dona, kg, l (litr), m (metr). Bo'sh qoldirilsa — dona.",
			"Excelda vergul (5,8) yoki nuqta (5.8) — ikkalasi ham qabul qilinadi.",
			"Bir mahsulot — bir nechta qator (har rang/variant uchun alohida qator).",
		},
	}
}

func cellString(f *excelize.File, sheet string, row, col int) string {
	if col <= 0 {
		return ""
	}
	cell, _ := excelize.CoordinatesToCellName(col, row)
	v, _ := f.GetCellValue(sheet, cell)
	return strings.TrimSpace(v)
}

func parseExcelDecimalCell(raw string) *float64 {
	text := strings.TrimSpace(raw)
	if text == "" || text == "-" || text == "—" {
		return nil
	}
	normalized := strings.ReplaceAll(text, " ", "")
	lastComma := strings.LastIndex(normalized, ",")
	lastDot := strings.LastIndex(normalized, ".")
	if lastComma > -1 && lastDot > -1 {
		if lastComma > lastDot {
			normalized = strings.ReplaceAll(normalized, ".", "")
			normalized = strings.ReplaceAll(normalized, ",", ".")
		} else {
			normalized = strings.ReplaceAll(normalized, ",", "")
		}
	} else if lastComma > -1 {
		normalized = strings.ReplaceAll(normalized, ",", ".")
	}
	v, err := strconv.ParseFloat(normalized, 64)
	if err != nil || !isFiniteFloat(v) {
		return nil
	}
	return &v
}

func parseMoneyCell(raw string) (amount float64, currency string) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return 0, ""
	}
	normalized := strings.Join(strings.Fields(text), " ")
	re1 := regexp.MustCompile(`(?i)^([\d][\d\s]*(?:[.,]\d+)?)\s*(uzs|usd)?$`)
	re2 := regexp.MustCompile(`(?i)^(uzs|usd)\s*([\d][\d\s]*(?:[.,]\d+)?)$`)
	if m := re1.FindStringSubmatch(normalized); len(m) > 0 {
		amountPart := strings.ReplaceAll(strings.ReplaceAll(m[1], " ", ""), ",", ".")
		amount, _ = strconv.ParseFloat(amountPart, 64)
		if len(m) > 2 {
			currency = strings.ToUpper(m[2])
		}
		return amount, currency
	}
	if m := re2.FindStringSubmatch(normalized); len(m) > 0 {
		amountPart := strings.ReplaceAll(strings.ReplaceAll(m[2], " ", ""), ",", ".")
		amount, _ = strconv.ParseFloat(amountPart, 64)
		currency = strings.ToUpper(m[1])
		return amount, currency
	}
	digits := regexp.MustCompile(`[^\d.,-]`).ReplaceAllString(normalized, "")
	digits = strings.ReplaceAll(digits, ",", ".")
	amount, _ = strconv.ParseFloat(digits, 64)
	return amount, ""
}

func resolveImportCurrency(currencyText, priceHint string) string {
	raw := strings.ToUpper(strings.TrimSpace(currencyText))
	if matched, _ := regexp.MatchString(`^\d+([.,]\d+)?$`, raw); matched {
		if priceHint == "USD" || priceHint == "UZS" {
			return priceHint
		}
		return "UZS"
	}
	if raw == "USD" || raw == "UZS" {
		return raw
	}
	if priceHint == "USD" || priceHint == "UZS" {
		return priceHint
	}
	if strings.Contains(raw, "USD") || strings.Contains(raw, "$") {
		return "USD"
	}
	if strings.Contains(raw, "UZS") {
		return "UZS"
	}
	if raw != "" {
		return raw
	}
	return "UZS"
}

func parseImportNameSkuFields(nameRaw, skuRaw string) (name, sku string) {
	name = strings.TrimSpace(nameRaw)
	sku = strings.TrimSpace(skuRaw)
	if sku != "" {
		return name, sku
	}
	if name == "" {
		return "", ""
	}
	if m := regexp.MustCompile(`^([A-Za-z0-9][A-Za-z0-9._-]*)\s*/\s*(.+)$`).FindStringSubmatch(name); len(m) == 3 {
		return strings.TrimSpace(name), strings.TrimSpace(m[1])
	}
	if matched, _ := regexp.MatchString(`(?i)^[A-Za-z]{1,6}[-_]?\d{2,}[A-Za-z0-9/-]*$`, name); matched {
		return name, name
	}
	return name, ""
}

func parseLegacyCombinedVariant(value string) (color, variant string) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return "", ""
	}
	if m := regexp.MustCompile(`^(.+?)\s*/\s*(.+)$`).FindStringSubmatch(raw); len(m) == 3 {
		return strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
	}
	return parseImportColorVariantFields(raw, "")
}

func parseImportColorVariantFields(colorRaw, variantRaw string) (color, variant string) {
	color = strings.TrimSpace(colorRaw)
	variant = strings.TrimSpace(variantRaw)
	if color == "" && variant != "" {
		return parseImportColorVariantFields(variant, "")
	}
	if color != "" && variant == "" {
		if m := regexp.MustCompile(`^(.+?)\s*/\s*(.+)$`).FindStringSubmatch(color); len(m) == 3 {
			return strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
		}
		if m := regexp.MustCompile(`^(.+?)\s*\(\s*([^)]+)\s*\)\s*$`).FindStringSubmatch(color); len(m) == 3 {
			label := strings.TrimSpace(m[1])
			inside := strings.TrimSpace(m[2])
			if matched, _ := regexp.MatchString(`^\d+$`, inside); matched {
				return label, ""
			}
			if matched, _ := regexp.MatchString(`(?i)^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|\d+)$`, inside); matched {
				return label, inside
			}
			return label, inside
		}
	}
	if color != "" && variant != "" && strings.EqualFold(color, variant) {
		variant = ""
	}
	return color, variant
}

func isGenericImportVariantName(name string) bool {
	raw := strings.ToLower(strings.TrimSpace(name))
	if raw == "" || raw == "standart" || raw == "standard" || raw == "default" {
		return true
	}
	return strings.HasPrefix(raw, "default /")
}

func importVariantIdentityKey(productName, variant, color string) string {
	product := strings.ToLower(strings.TrimSpace(productName))
	variantTrim := strings.TrimSpace(variant)
	colorTrim := strings.ToLower(strings.TrimSpace(color))
	if colorTrim != "" {
		return product + "|color:" + colorTrim
	}
	if variantTrim != "" && !isGenericImportVariantName(variantTrim) {
		return product + "|variant:" + strings.ToLower(variantTrim)
	}
	return product + "|default"
}

func resolveImportVariantDisplayName(productName, variant, color string) string {
	variantTrim := strings.TrimSpace(variant)
	colorTrim := strings.TrimSpace(color)
	if variantTrim != "" && !isGenericImportVariantName(variantTrim) && !regexp.MustCompile(`^\d+$`).MatchString(variantTrim) {
		return variantTrim
	}
	if colorTrim != "" {
		return colorTrim
	}
	pn := strings.TrimSpace(productName)
	if pn == "" {
		pn = "Mahsulot"
	}
	return "Default / " + pn
}

func isImportVariantIDValue(v string) bool {
	return uuidRE.MatchString(strings.TrimSpace(v))
}

func readImportVariantIDCell(f *excelize.File, sheet string, row int, cols ...int) string {
	for _, col := range cols {
		raw := cellString(f, sheet, row, col)
		if isImportVariantIDValue(raw) {
			return raw
		}
	}
	return ""
}

func parseProductImportExcelRow(f *excelize.File, sheet string, row int, format productImportExcelFormat, trailing importTrailingCols) parsedImportRow {
	out := parsedImportRow{}
	if format == excelFormatLegacy {
		combined := cellString(f, sheet, row, 4)
		legacyColor, legacyVariant := parseLegacyCombinedVariant(combined)
		color, variant := parseImportColorVariantFields(legacyColor, legacyVariant)
		if color == "" {
			color, variant = parseImportColorVariantFields(combined, "")
		}
		name, sku := parseImportNameSkuFields(cellString(f, sheet, row, 1), cellString(f, sheet, row, 2))
		stock := parseExcelDecimalCell(cellString(f, sheet, row, trailing.stockCol))
		purchase, pCur := parseMoneyCell(cellString(f, sheet, row, 5))
		sale, sCur := parseMoneyCell(cellString(f, sheet, row, 6))
		currency := resolveImportCurrency(cellString(f, sheet, row, 7), firstNonEmpty(sCur, pCur))
		unitRaw := cellString(f, sheet, row, trailing.unitCol)
		unit, unitInvalid := parseProductUnitInput(unitRaw)
		out = parsedImportRow{
			Name: name, SKU: sku, Barcode: cellString(f, sheet, row, 3),
			Color: color, VariantName: variant, VariantID: readImportVariantIDCell(f, sheet, row, trailing.variantIDCol),
			PurchasePrice: purchase, SalePrice: sale, Currency: currency,
			InitialStockRaw: stock, UnitRaw: unitRaw, Unit: unit, UnitInvalid: unitInvalid,
			Category: cellString(f, sheet, row, trailing.categoryCol),
			WarehouseName: cellString(f, sheet, row, trailing.warehouseCol),
		}
		return out
	}
	color, variant := parseImportColorVariantFields(cellString(f, sheet, row, 4), cellString(f, sheet, row, 5))
	name, sku := parseImportNameSkuFields(cellString(f, sheet, row, 1), cellString(f, sheet, row, 2))
	stock := parseExcelDecimalCell(cellString(f, sheet, row, trailing.stockCol))
	purchase, pCur := parseMoneyCell(cellString(f, sheet, row, 6))
	sale, sCur := parseMoneyCell(cellString(f, sheet, row, 7))
	currency := resolveImportCurrency(cellString(f, sheet, row, 8), firstNonEmpty(sCur, pCur))
	unitRaw := cellString(f, sheet, row, trailing.unitCol)
	unit, unitInvalid := parseProductUnitInput(unitRaw)
	return parsedImportRow{
		Name: name, SKU: sku, Barcode: cellString(f, sheet, row, 3),
		Color: color, VariantName: variant,
		VariantID: readImportVariantIDCell(f, sheet, row, trailing.variantIDCol, trailing.variantIDCol-1),
		PurchasePrice: purchase, SalePrice: sale, Currency: currency,
		InitialStockRaw: stock, UnitRaw: unitRaw, Unit: unit, UnitInvalid: unitInvalid,
		Category: cellString(f, sheet, row, trailing.categoryCol),
		WarehouseName: cellString(f, sheet, row, trailing.warehouseCol),
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.ToUpper(strings.TrimSpace(v))
		}
	}
	return ""
}

func isProductImportRowEmpty(row parsedImportRow, format productImportExcelFormat, f *excelize.File, sheet string, excelRow int) bool {
	priceEmpty := false
	if format == excelFormatLegacy {
		priceEmpty = cellString(f, sheet, excelRow, 5) == "" && cellString(f, sheet, excelRow, 6) == "" && cellString(f, sheet, excelRow, 7) == ""
	} else {
		priceEmpty = cellString(f, sheet, excelRow, 6) == "" && cellString(f, sheet, excelRow, 7) == "" && cellString(f, sheet, excelRow, 8) == ""
	}
	return strings.TrimSpace(row.Name) == "" && strings.TrimSpace(row.SKU) == "" && strings.TrimSpace(row.Barcode) == "" &&
		strings.TrimSpace(row.Color) == "" && strings.TrimSpace(row.VariantName) == "" && priceEmpty &&
		row.InitialStockRaw == nil && strings.TrimSpace(row.UnitRaw) == "" &&
		strings.TrimSpace(row.Category) == "" && strings.TrimSpace(row.WarehouseName) == ""
}

func formatImportPriceError(field string, format productImportExcelFormat) string {
	col := "G"
	if field == "purchase" {
		col = "F"
	}
	label := "Sotuv"
	if field == "purchase" {
		label = "Kirim"
	}
	return fmt.Sprintf("%s narxi noto'g'ri (%s ustuni). Raqam kiriting: 150000 yoki 5.8", label, col)
}

func formatImportCurrencyError(format productImportExcelFormat, bad string) string {
	return fmt.Sprintf(`Valyuta noto'g'ri: "%s". H ustuniga faqat USD yoki UZS yozing (sotuv narxi G ustunida, masalan 5.8).`, bad)
}

func formatProductUnitImportError(bad string) string {
	return fmt.Sprintf(`Birlik noto'g'ri: "%s". J ustuniga dona, kg, l (litr) yoki m (metr) yozing.`, bad)
}

func allowsDecimalStock(unit string) bool {
	u := normalizeProductUnit(unit)
	return u == "kg" || u == "l" || u == "m"
}

func isIntegerStockQuantity(qty float64) bool {
	return math.Abs(qty-math.Round(qty)) < 1e-9
}

func normalizeStockQuantity(qty float64, unit string) float64 {
	if !isFiniteFloat(qty) || qty < 0 {
		return 0
	}
	if allowsDecimalStock(unit) {
		return math.Round(qty*10000) / 10000
	}
	return math.Round(qty)
}

func stockQuantityImportError(qty float64, unit string) string {
	if !isFiniteFloat(qty) || qty < 0 {
		return "Qoldiq manfiy bo'lishi mumkin emas"
	}
	if !allowsDecimalStock(unit) && qty > 0 && !isIntegerStockQuantity(qty) {
		label := productUnitLabel(normalizeProductUnit(unit))
		return fmt.Sprintf("Qoldiq butun son bo'lishi kerak (%s birligi). Masalan: 5, 10 — %g emas.", label, qty)
	}
	return ""
}

func productUnitLabel(unit string) string {
	switch unit {
	case "kg":
		return "kg"
	case "l":
		return "litr"
	case "m":
		return "metr"
	default:
		return "dona"
	}
}

var productUnitAliases = map[string]string{
	"dona": "dona", "don": "dona", "ta": "dona", "pcs": "dona", "pc": "dona", "sht": "dona",
	"kg": "kg", "kilogramm": "kg", "kilogram": "kg", "kilo": "kg",
	"l": "l", "litr": "l", "liter": "l", "litre": "l", "ltr": "l",
	"m": "m", "metr": "m", "meter": "m", "metre": "m", "mt": "m",
}

func normalizeProductUnit(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, " ", "")
	if s == "" {
		return "dona"
	}
	if v, ok := productUnitAliases[s]; ok {
		return v
	}
	for _, code := range []string{"dona", "kg", "l", "m"} {
		if s == code {
			return code
		}
	}
	return "dona"
}

func parseProductUnitInput(raw string) (unit string, invalid bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}
	key := strings.ToLower(trimmed)
	key = strings.ReplaceAll(key, ".", "")
	key = strings.ReplaceAll(key, " ", "")
	if v, ok := productUnitAliases[key]; ok {
		return v, false
	}
	for _, code := range []string{"dona", "kg", "l", "m"} {
		if key == code {
			return code, false
		}
	}
	return "", true
}
