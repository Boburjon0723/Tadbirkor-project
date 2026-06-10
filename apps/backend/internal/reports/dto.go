package reports

type ReportQueryInput struct {
	DateFrom         *string `json:"dateFrom"`
	DateTo           *string `json:"dateTo"`
	PartnerCompanyID *string `json:"partnerCompanyId"`
	WarehouseID      *string `json:"warehouseId"`
	ProductVariantID *string `json:"productVariantId"`
	Status           *string `json:"status"`
	Limit            int     `json:"limit"`
	Days             int     `json:"days"`
}

type MonthlyOverviewQueryInput struct {
	Year  int `json:"year"`
	Month int `json:"month"`
}

type ProductExportQueryInput struct {
	WarehouseID string `json:"warehouseId"`
	Mode        string `json:"mode"`
}
