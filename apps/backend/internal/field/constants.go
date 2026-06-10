package field

const (
	StatusAssigned   = "ASSIGNED"
	StatusInProgress = "IN_PROGRESS"
	StatusReported   = "REPORTED"
	StatusApproved   = "APPROVED"
	StatusRejected   = "REJECTED"
	StatusNeedsFix   = "NEEDS_FIX"
	StatusCanceled   = "CANCELED"
)

const (
	StockSourceAssign         = "FIELD_ASSIGN"
	StockSourceWorkerCustomer = "WORKER_TO_CUSTOMER"
	StockSourceWorkerReturn   = "WORKER_RETURN"
	StockSourceWorkerLoss     = "WORKER_LOSS"
)

type PlannedItem struct {
	VariantID string  `json:"variantId"`
	Qty       float64 `json:"qty"`
	Label     string  `json:"label,omitempty"`
}

type ReportItem struct {
	VariantID   string  `json:"variantId"`
	UsedQty     float64 `json:"usedQty"`
	ReturnedQty float64 `json:"returnedQty"`
	LostQty     float64 `json:"lostQty"`
}
