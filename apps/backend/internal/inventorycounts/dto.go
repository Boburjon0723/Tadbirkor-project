package inventorycounts

type StartInput struct {
	WarehouseID        string   `json:"warehouseId"`
	ProductVariantIDs  []string `json:"productVariantIds"`
}

type ScanInput struct {
	Barcode          string  `json:"barcode"`
	CountedQuantity  float64 `json:"countedQuantity"`
}

type RecordCountInput struct {
	CountedQuantity float64 `json:"countedQuantity"`
}
