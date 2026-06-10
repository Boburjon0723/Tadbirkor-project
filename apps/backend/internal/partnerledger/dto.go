package partnerledger

type CreatePartnerLedgerContactInput struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone,omitempty"`
	Tag   *string `json:"tag,omitempty"`
	Notes *string `json:"notes,omitempty"`
}

type UpdatePartnerLedgerContactInput struct {
	Name     *string `json:"name,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Tag      *string `json:"tag,omitempty"`
	Notes    *string `json:"notes,omitempty"`
	IsActive *bool   `json:"isActive,omitempty"`
}

type CreatePartnerLedgerOperationInput struct {
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	Currency      *string `json:"currency,omitempty"`
	OperationDate string  `json:"operationDate"`
	Notes         *string `json:"notes,omitempty"`
}

type UpdatePartnerLedgerOperationInput struct {
	Type          *string  `json:"type,omitempty"`
	Amount        *float64 `json:"amount,omitempty"`
	Currency      *string  `json:"currency,omitempty"`
	OperationDate *string  `json:"operationDate,omitempty"`
	Notes         *string  `json:"notes,omitempty"`
}

type PartnerLedgerSaleLineInput struct {
	ProductVariantID string  `json:"productVariantId"`
	Quantity         float64 `json:"quantity"`
}

type CreatePartnerLedgerSaleOrderInput struct {
	WarehouseID    string                       `json:"warehouseId"`
	Lines          []PartnerLedgerSaleLineInput `json:"lines"`
	OperationDate  *string                      `json:"operationDate,omitempty"`
	Notes          *string                      `json:"notes,omitempty"`
	SettlementType *string                      `json:"settlementType,omitempty"`
	SettlementNote *string                      `json:"settlementNote,omitempty"`
}
