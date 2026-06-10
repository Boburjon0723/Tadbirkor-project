package pos

type SaleItemInput struct {
	ProductVariantID string   `json:"productVariantId"`
	Quantity         float64  `json:"quantity"`
	UnitPrice        *float64 `json:"unitPrice"`
}

type CreateSaleInput struct {
	WarehouseID      string          `json:"warehouseId"`
	Items            []SaleItemInput `json:"items"`
	DiscountAmount   *float64        `json:"discountAmount"`
	Note             *string         `json:"note"`
	RetailCustomerID *string         `json:"retailCustomerId"`
	CustomerName     *string         `json:"customerName"`
	CustomerPhone    *string         `json:"customerPhone"`
}

type UpdateSaleInput struct {
	Items            []SaleItemInput `json:"items"`
	DiscountAmount   *float64        `json:"discountAmount"`
	Note             *string         `json:"note"`
	RetailCustomerID *string         `json:"retailCustomerId"`
	CustomerName     *string         `json:"customerName"`
	CustomerPhone    *string         `json:"customerPhone"`
}

type CheckoutInput struct {
	Method           string   `json:"method"`
	CashReceived     *float64 `json:"cashReceived"`
	RetailCustomerID *string  `json:"retailCustomerId"`
	CustomerName     *string  `json:"customerName"`
	CustomerPhone    *string  `json:"customerPhone"`
}

type QuickCheckoutInput struct {
	CreateSaleInput
	Method       string   `json:"method"`
	CashReceived *float64 `json:"cashReceived"`
}

type VoidInput struct {
	Reason *string `json:"reason"`
}
