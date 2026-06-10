package retailcustomers

type CreateInput struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Notes *string `json:"notes"`
}

type UpdateInput struct {
	Name  *string `json:"name"`
	Phone *string `json:"phone"`
	Notes *string `json:"notes"`
}

type PrepaidInput struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
	Notes    *string `json:"notes"`
}
