package b2borders

type OrderItemInput struct {
	ProductVariantID *string `json:"productVariantId"`
	ProductName      string  `json:"productName"`
	Quantity         float64 `json:"quantity"`
	ExpectedPrice    float64 `json:"expectedPrice"`
	ExpectedCurrency string  `json:"expectedCurrency"`
}

type CreateOrderInput struct {
	SellerCompanyID      string           `json:"sellerCompanyId"`
	ExpectedDeliveryDate *string          `json:"expectedDeliveryDate"`
	Note                 *string          `json:"note"`
	Items                []OrderItemInput `json:"items"`
}

type UpdateDraftOrderInput struct {
	ExpectedDeliveryDate *string          `json:"expectedDeliveryDate"`
	Note                 *string          `json:"note"`
	Items                []OrderItemInput `json:"items"`
}

type AcceptOrderInput struct {
	AllowPartial bool `json:"allowPartial"`
}

type MapIncomingOrderItemInput struct {
	OwnProductVariantID string   `json:"ownProductVariantId"`
	SellerPrice         *float64 `json:"sellerPrice"`
	SellerCurrency      *string  `json:"sellerCurrency"`
}
