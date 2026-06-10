package dispatches

type DispatchLineQty struct {
	OrderItemID string   `json:"orderItemId"`
	Quantity    float64  `json:"quantity"`
}

type CreateInput struct {
	OrderID     string            `json:"orderId"`
	WarehouseID string            `json:"warehouseId"`
	Items       []DispatchLineQty `json:"items,omitempty"`
}

type dispatchLine struct {
	ProductVariantID    string
	ProductNameSnapshot string
	Quantity            float64
}
