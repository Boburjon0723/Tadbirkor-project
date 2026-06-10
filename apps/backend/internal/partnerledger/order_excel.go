package partnerledger

import (
	"bytes"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

type parsedOrderRow struct {
	RowNumber   int
	SKU         string
	Barcode     string
	ProductHint string
	VariantHint string
	Quantity    float64
}

type orderVariantCandidate struct {
	ID, Name string
	SKU, Barcode *string
	ProductName string
}

var headerAliases = map[string][]string{
	"sku":      {"sku", "kod", "code", "artikul", "артикул"},
	"barcode":  {"shtrix", "barcode", "bar kod", "штrix", "shtrix-kod"},
	"product":  {"mahsulot", "nomi", "product", "tovar"},
	"variant":  {"variant", "rang", "color", "ölcham", "olcham", "size"},
	"quantity": {"miqdor", "qty", "quantity", "soni"},
}

func loadPartnerOrderRowsFromBuffer(data []byte) ([]parsedOrderRow, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, errBadRequest("Excel faylni o'qib bo'lmadi")
	}
	defer f.Close()
	sheet := findOrderSheet(f)
	if sheet == "" {
		return nil, errBadRequest("Buyurtma varag'i topilmadi")
	}
	return parsePartnerOrderExcelRows(f, sheet)
}

func findOrderSheet(f *excelize.File) string {
	for _, name := range []string{"Buyurtma", "buyurtma", "Order"} {
		if idx, _ := f.GetSheetIndex(name); idx > 0 {
			return name
		}
	}
	return f.GetSheetName(0)
}

func parsePartnerOrderExcelRows(f *excelize.File, sheet string) ([]parsedOrderRow, error) {
	rows, err := f.GetRows(sheet)
	if err != nil || len(rows) < 2 {
		return nil, nil
	}
	cols := detectOrderColumns(rows[0])
	dataStart := 1
	if cols.quantity == 0 {
		cols = orderCols{sku: 1, barcode: 2, product: 3, variant: 4, quantity: 5}
		first := normHeader(rows[0][0])
		if !strings.Contains(first, "sku") && !strings.Contains(first, "miqdor") && !strings.Contains(first, "mahsulot") {
			dataStart = 0
		}
	}
	qtyCol := cols.quantity
	if qtyCol == 0 {
		if cols.variant > 0 {
			qtyCol = cols.variant + 1
		} else {
			qtyCol = 4
		}
	}

	out := []parsedOrderRow{}
	for i := dataStart; i < len(rows); i++ {
		row := rows[i]
		sku := cellAt(row, cols.sku, 1)
		barcode := cellAt(row, cols.barcode, 2)
		productHint := cellAt(row, cols.product, 3)
		variantHint := cellAt(row, cols.variant, 0)
		qty := parseQty(cellAt(row, qtyCol, 0))

		if sku == "" && barcode == "" && productHint == "" && variantHint == "" {
			continue
		}
		if qty <= 0 {
			if sku != "" || barcode != "" || productHint != "" || variantHint != "" {
				out = append(out, parsedOrderRow{
					RowNumber: i + 1, SKU: sku, Barcode: barcode,
					ProductHint: productHint, VariantHint: variantHint, Quantity: 0,
				})
			}
			continue
		}
		out = append(out, parsedOrderRow{
			RowNumber: i + 1, SKU: sku, Barcode: barcode,
			ProductHint: productHint, VariantHint: variantHint, Quantity: qty,
		})
	}
	return applySkuFillDown(out), nil
}

type orderCols struct {
	sku, barcode, product, variant, quantity int
}

func detectOrderColumns(header []string) orderCols {
	cols := orderCols{}
	for i, h := range header {
		nh := normHeader(h)
		for key, aliases := range headerAliases {
			for _, a := range aliases {
				if strings.Contains(nh, a) {
					switch key {
					case "sku":
						if cols.sku == 0 {
							cols.sku = i + 1
						}
					case "barcode":
						if cols.barcode == 0 {
							cols.barcode = i + 1
						}
					case "product":
						if cols.product == 0 {
							cols.product = i + 1
						}
					case "variant":
						if cols.variant == 0 {
							cols.variant = i + 1
						}
					case "quantity":
						if cols.quantity == 0 {
							cols.quantity = i + 1
						}
					}
				}
			}
		}
	}
	return cols
}

func normHeader(v string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(v)), " "))
}

func cellAt(row []string, col, fallback int) string {
	idx := col - 1
	if col <= 0 {
		idx = fallback - 1
	}
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func parseQty(s string) float64 {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", ".")
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return n
}

func applySkuFillDown(rows []parsedOrderRow) []parsedOrderRow {
	lastSKU, lastProduct := "", ""
	out := make([]parsedOrderRow, len(rows))
	for i, row := range rows {
		sku := strings.TrimSpace(row.SKU)
		productHint := strings.TrimSpace(row.ProductHint)
		if sku != "" && productHint == "" {
			productHint = sku
		}
		if productHint == "" && lastProduct != "" {
			productHint = lastProduct
		}
		if sku == "" && lastSKU != "" && normPartnerText(productHint) == lastProduct {
			sku = lastSKU
		}
		if sku != "" {
			lastSKU = sku
		}
		if productHint != "" {
			lastProduct = normPartnerText(productHint)
		}
		out[i] = parsedOrderRow{
			RowNumber: row.RowNumber, SKU: sku, Barcode: row.Barcode,
			ProductHint: productHint, VariantHint: row.VariantHint, Quantity: row.Quantity,
		}
	}
	return out
}

func normPartnerText(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func matchPartnerOrderVariant(row parsedOrderRow, variants []orderVariantCandidate) *orderVariantCandidate {
	skuKey := normPartnerText(row.SKU)
	barcode := strings.TrimSpace(row.Barcode)
	productKey := normPartnerText(row.ProductHint)
	variantKey := normPartnerText(row.VariantHint)

	if barcode != "" {
		matches := filterVariants(variants, func(v orderVariantCandidate) bool {
			return v.Barcode != nil && strings.TrimSpace(*v.Barcode) == barcode
		})
		if len(matches) == 1 {
			return &matches[0]
		}
		if len(matches) > 1 && variantKey != "" {
			narrowed := filterVariants(matches, func(v orderVariantCandidate) bool {
				return normPartnerText(v.Name) == variantKey
			})
			if len(narrowed) == 1 {
				return &narrowed[0]
			}
		}
	}

	if skuKey != "" && variantKey != "" {
		exact := filterVariants(variants, func(v orderVariantCandidate) bool {
			return normPartnerText(v.Name) == variantKey &&
				((v.SKU != nil && normPartnerText(*v.SKU) == skuKey) || normPartnerText(v.ProductName) == skuKey)
		})
		if len(exact) == 1 {
			return &exact[0]
		}
		if len(exact) > 1 {
			return nil
		}
	}

	if skuKey != "" && variantKey == "" {
		bySku := filterVariants(variants, func(v orderVariantCandidate) bool {
			return v.SKU != nil && normPartnerText(*v.SKU) == skuKey
		})
		if len(bySku) == 1 {
			return &bySku[0]
		}
	}

	if productKey != "" && variantKey != "" {
		byName := filterVariants(variants, func(v orderVariantCandidate) bool {
			return normPartnerText(v.ProductName) == productKey && normPartnerText(v.Name) == variantKey
		})
		if len(byName) == 1 {
			return &byName[0]
		}
	}

	if skuKey != "" && variantKey == "" {
		byProduct := filterVariants(variants, func(v orderVariantCandidate) bool {
			return normPartnerText(v.ProductName) == skuKey
		})
		if len(byProduct) == 1 {
			return &byProduct[0]
		}
	}
	return nil
}

func filterVariants(vs []orderVariantCandidate, pred func(orderVariantCandidate) bool) []orderVariantCandidate {
	out := []orderVariantCandidate{}
	for _, v := range vs {
		if pred(v) {
			out = append(out, v)
		}
	}
	return out
}
