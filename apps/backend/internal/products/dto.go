package products

type VariantInput struct {
	ID             *string        `json:"id"`
	Name           string         `json:"name"`
	SKU            *string        `json:"sku"`
	Barcode        *string        `json:"barcode"`
	SalePrice      float64        `json:"salePrice"`
	PurchasePrice  *float64       `json:"purchasePrice"`
	Currency       *string        `json:"currency"`
	Attributes     map[string]any `json:"attributes"`
	Status         *string        `json:"status"`
	InitialStock   *float64       `json:"initialStock"`
	WarehouseID    *string        `json:"warehouseId"`
}

type CreateInput struct {
	Name        string         `json:"name"`
	CategoryID  string         `json:"categoryId"`
	Description *string        `json:"description"`
	ImageURL    *string        `json:"imageUrl"`
	Unit        string         `json:"unit"`
	Type        string         `json:"type"`
	Variants    []VariantInput `json:"variants"`
}

type StockAdjustmentInput struct {
	WarehouseID            string   `json:"warehouseId"`
	ProductVariantID       string   `json:"productVariantId"`
	Quantity               float64  `json:"quantity"`
	Note                   *string  `json:"note"`
	PartnerLedgerContactID *string  `json:"partnerLedgerContactId"`
}

type UpdateInput struct {
	Name               *string                `json:"name"`
	CategoryID         *string                `json:"categoryId"`
	Description        *string                `json:"description"`
	ImageURL           *string                `json:"imageUrl"`
	Unit               *string                `json:"unit"`
	Type               *string                `json:"type"`
	Status             *string                `json:"status"`
	Variants           []VariantInput         `json:"variants"`
	RemovedVariantIDs  []string               `json:"removedVariantIds"`
	StockAdjustments   []StockAdjustmentInput `json:"stockAdjustments"`
}

type ImportRow struct {
	Name              string   `json:"name"`
	Color             string   `json:"color,omitempty"`
	VariantName       string   `json:"variantName,omitempty"`
	Variant           string   `json:"variant,omitempty"`
	VariantID         string   `json:"variantId,omitempty"`
	FileStockMode     string   `json:"fileStockMode,omitempty"`
	Category          string   `json:"category,omitempty"`
	Unit              string   `json:"unit,omitempty"`
	SKU               string   `json:"sku,omitempty"`
	Barcode           string   `json:"barcode,omitempty"`
	PurchasePrice     float64  `json:"purchasePrice,omitempty"`
	SalePrice         float64  `json:"salePrice,omitempty"`
	Currency          string   `json:"currency,omitempty"`
	Quantity          float64  `json:"quantity,omitempty"`
	WarehouseID       string   `json:"warehouseId,omitempty"`
	RowAction         string   `json:"rowAction,omitempty"`
	StockAction       string   `json:"stockAction,omitempty"`
	InitialStockRaw   *float64 `json:"initialStockRaw,omitempty"`
	InitialStock      *float64 `json:"initialStock,omitempty"`
	ExistingVariantID *string  `json:"existingVariantId,omitempty"`
}

type ImportConfirmInput struct {
	ImportMode             *string     `json:"importMode,omitempty"`
	StockPolicy            *string     `json:"stockPolicy,omitempty"`
	PartnerLedgerContactID *string     `json:"partnerLedgerContactId,omitempty"`
	Rows                   []ImportRow `json:"rows"`
}
