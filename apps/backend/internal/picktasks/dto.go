package picktasks

import "time"

type ScanInput struct {
	Barcode  string   `json:"barcode"`
	Quantity *float64 `json:"quantity,omitempty"`
}

type DispatchBrief struct {
	ID             string `json:"id"`
	DispatchNumber string `json:"dispatchNumber"`
	OrderID        string `json:"orderId"`
	Status         string `json:"status"`
}

type ProductVariantBrief struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	SKU     *string `json:"sku"`
	Barcode *string `json:"barcode"`
}

type WarehouseBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type AssigneeBrief struct {
	ID   string `json:"id"`
	User struct {
		FullName string `json:"fullName"`
	} `json:"user"`
}

type PickTaskResponse struct {
	ID                  string               `json:"id"`
	DispatchID          string               `json:"dispatchId"`
	CompanyID           string               `json:"companyId"`
	WarehouseID         string               `json:"warehouseId"`
	ProductVariantID    string               `json:"productVariantId"`
	ProductNameSnapshot string               `json:"productNameSnapshot"`
	BinLocation         *string              `json:"binLocation"`
	QuantityRequired    float64              `json:"quantityRequired"`
	QuantityPicked      float64              `json:"quantityPicked"`
	ScannedBarcodes     []string             `json:"scannedBarcodes"`
	AssignedTo          *string              `json:"assignedTo"`
	Status              string               `json:"status"`
	StartedAt           *time.Time           `json:"startedAt"`
	CompletedAt         *time.Time           `json:"completedAt"`
	CreatedAt           time.Time            `json:"createdAt"`
	UpdatedAt           time.Time            `json:"updatedAt"`
	Dispatch            *DispatchBrief       `json:"dispatch,omitempty"`
	ProductVariant      *ProductVariantBrief `json:"productVariant,omitempty"`
	Warehouse           *WarehouseBrief      `json:"warehouse,omitempty"`
	Assignee            *AssigneeBrief       `json:"assignee,omitempty"`
}

type PickTaskPlain struct {
	ID                  string     `json:"id"`
	DispatchID          string     `json:"dispatchId"`
	CompanyID           string     `json:"companyId"`
	WarehouseID         string     `json:"warehouseId"`
	ProductVariantID    string     `json:"productVariantId"`
	ProductNameSnapshot string     `json:"productNameSnapshot"`
	BinLocation         *string    `json:"binLocation"`
	QuantityRequired    float64    `json:"quantityRequired"`
	QuantityPicked      float64    `json:"quantityPicked"`
	ScannedBarcodes     []string   `json:"scannedBarcodes"`
	AssignedTo          *string    `json:"assignedTo"`
	Status              string     `json:"status"`
	StartedAt           *time.Time `json:"startedAt"`
	CompletedAt         *time.Time `json:"completedAt"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`
}
