package warehouseintake

type CreateWarehouseIntakeInput struct {
	WarehouseID            string  `json:"warehouseId"`
	Note                   *string `json:"note,omitempty"`
	PartnerLedgerContactID *string `json:"partnerLedgerContactId,omitempty"`
}

type AddIntakeLineInput struct {
	ProductVariantID string  `json:"productVariantId"`
	Quantity         float64 `json:"quantity"`
}

type ScanIntakeLineInput struct {
	Barcode  string   `json:"barcode"`
	Quantity *float64 `json:"quantity,omitempty"`
}

type UpdateIntakeLineInput struct {
	Quantity float64 `json:"quantity"`
}

type QuickIntakeProductInput struct {
	Barcode       string   `json:"barcode"`
	Name          string   `json:"name"`
	CategoryID    *string  `json:"categoryId,omitempty"`
	Unit          *string  `json:"unit,omitempty"`
	SalePrice     *float64 `json:"salePrice,omitempty"`
	PurchasePrice *float64 `json:"purchasePrice,omitempty"`
	Quantity      *float64 `json:"quantity,omitempty"`
}
