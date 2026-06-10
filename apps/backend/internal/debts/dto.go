package debts

type CreatePaymentRecordInput struct {
	Amount        float64 `json:"amount"`
	Notes         *string `json:"notes,omitempty"`
	PaymentMethod *string `json:"paymentMethod,omitempty"`
}

type ApplyPartnerBulkPaymentInput struct {
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Notes         *string `json:"notes,omitempty"`
	PaymentMethod *string `json:"paymentMethod,omitempty"`
}

type ConfirmPartnerBulkPaymentInput struct {
	Currency *string `json:"currency,omitempty"`
}
