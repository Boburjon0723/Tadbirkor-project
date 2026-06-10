package goodsreceipts

type ReceiptQtyLineInput struct {
	ItemID           string  `json:"itemId"`
	ReceivedQuantity float64 `json:"receivedQuantity"`
}

type AcceptReceiptInput struct {
	WarehouseID string                `json:"warehouseId"`
	Note        *string               `json:"note"`
	Items       []ReceiptQtyLineInput `json:"items,omitempty"`
}

type PartialAcceptReceiptInput struct {
	WarehouseID string                `json:"warehouseId"`
	Items       []ReceiptQtyLineInput `json:"items"`
	Note        *string               `json:"note"`
}
