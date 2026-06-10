package companies

import (
	"encoding/json"
	"math"
	"strings"
)

type posReceiptSettings struct {
	AutoPrint      bool   `json:"autoPrint"`
	ReceiptFormat  string `json:"receiptFormat"`
}

type intakeSettings struct {
	ScanMode         string `json:"scanMode"`
	AllowBulkQty     bool   `json:"allowBulkQty"`
	AllowQuickProduct bool  `json:"allowQuickProduct"`
	MaxQtyPerScan    *int   `json:"maxQtyPerScan"`
}

func normalizePosReceiptSettings(raw map[string]any) posReceiptSettings {
	def := posReceiptSettings{AutoPrint: true, ReceiptFormat: "thermal"}
	if raw == nil {
		return def
	}
	fmt := strings.ToLower(stringVal(raw["receiptFormat"]))
	switch fmt {
	case "a4":
		def.ReceiptFormat = "a4"
	case "none":
		def.ReceiptFormat = "none"
	default:
		def.ReceiptFormat = "thermal"
	}
	if v, ok := raw["autoPrint"]; ok {
		def.AutoPrint = boolVal(v)
	}
	return def
}

func mergePosReceiptPatch(current posReceiptSettings, patch map[string]any) posReceiptSettings {
	cur := map[string]any{"autoPrint": current.AutoPrint, "receiptFormat": current.ReceiptFormat}
	for k, v := range patch {
		cur[k] = v
	}
	return normalizePosReceiptSettings(cur)
}

func normalizeIntakeSettings(raw map[string]any) intakeSettings {
	def := intakeSettings{
		ScanMode: "SINGLE_SCAN_QTY", AllowBulkQty: true,
		AllowQuickProduct: false, MaxQtyPerScan: nil,
	}
	if raw == nil {
		return def
	}
	mode := strings.ToUpper(strings.TrimSpace(stringVal(raw["scanMode"])))
	if mode == "EACH_SCAN_ONE" {
		def.ScanMode = "EACH_SCAN_ONE"
	}
	if v, ok := raw["allowBulkQty"]; ok {
		def.AllowBulkQty = boolVal(v)
	}
	if v, ok := raw["allowQuickProduct"]; ok {
		def.AllowQuickProduct = boolVal(v)
	}
	if v, ok := raw["maxQtyPerScan"]; ok {
		def.MaxQtyPerScan = parseMaxQty(v)
	}
	return def
}

func resolveWarehouseIntakeSettings(companyRaw, warehouseFieldConfig []byte) intakeSettings {
	var companyMap map[string]any
	_ = json.Unmarshal(companyRaw, &companyMap)
	base := normalizeIntakeSettings(companyMap)
	if len(warehouseFieldConfig) == 0 {
		return base
	}
	var fc map[string]any
	if json.Unmarshal(warehouseFieldConfig, &fc) != nil || fc == nil {
		return base
	}
	override, _ := fc["intakeSettings"].(map[string]any)
	if override == nil {
		override, _ = fc["intake"].(map[string]any)
	}
	if override == nil {
		return base
	}
	merged := map[string]any{
		"scanMode": base.ScanMode, "allowBulkQty": base.AllowBulkQty,
		"allowQuickProduct": base.AllowQuickProduct, "maxQtyPerScan": base.MaxQtyPerScan,
	}
	for k, v := range override {
		merged[k] = v
	}
	return normalizeIntakeSettings(merged)
}

func mergeIntakePatch(current intakeSettings, patch map[string]any) intakeSettings {
	cur := map[string]any{
		"scanMode": current.ScanMode, "allowBulkQty": current.AllowBulkQty,
		"allowQuickProduct": current.AllowQuickProduct, "maxQtyPerScan": current.MaxQtyPerScan,
	}
	for k, v := range patch {
		cur[k] = v
	}
	return normalizeIntakeSettings(cur)
}

func intakeToMap(s intakeSettings) map[string]any {
	return map[string]any{
		"scanMode": s.ScanMode, "allowBulkQty": s.AllowBulkQty,
		"allowQuickProduct": s.AllowQuickProduct, "maxQtyPerScan": s.MaxQtyPerScan,
	}
}

func posReceiptToMap(s posReceiptSettings) map[string]any {
	return map[string]any{"autoPrint": s.AutoPrint, "receiptFormat": s.ReceiptFormat}
}

func stringVal(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func boolVal(v any) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}

func parseMaxQty(v any) *int {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok && strings.TrimSpace(s) == "" {
		return nil
	}
	n := 0.0
	switch t := v.(type) {
	case float64:
		n = t
	case int:
		n = float64(t)
	case json.Number:
		f, _ := t.Float64()
		n = f
	default:
		return nil
	}
	if math.IsNaN(n) || math.IsInf(n, 0) || n < 1 {
		return nil
	}
	i := int(math.Floor(n))
	return &i
}
