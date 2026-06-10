package variants

type CreateInput struct {
	Name          string         `json:"name"`
	SKU           *string        `json:"sku"`
	Barcode       *string        `json:"barcode"`
	SalePrice     float64        `json:"salePrice"`
	PurchasePrice *float64       `json:"purchasePrice"`
	Currency      *string        `json:"currency"`
	Attributes    map[string]any `json:"attributes"`
	Status        *string        `json:"status"`
	InitialStock  *float64       `json:"initialStock"`
	WarehouseID   *string        `json:"warehouseId"`
}

type UpdateInput struct {
	Name          *string        `json:"name"`
	SKU           *string        `json:"sku"`
	Barcode       *string        `json:"barcode"`
	SalePrice     *float64       `json:"salePrice"`
	PurchasePrice *float64       `json:"purchasePrice"`
	Currency      *string        `json:"currency"`
	Attributes    map[string]any `json:"attributes"`
	Status        *string        `json:"status"`
}

type UpdatePriceInput struct {
	SalePrice     float64  `json:"salePrice"`
	PurchasePrice *float64 `json:"purchasePrice"`
}

type PublishInput struct {
	IsPublishedToWebsite bool `json:"isPublishedToWebsite"`
}
