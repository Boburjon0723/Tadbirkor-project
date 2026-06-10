package field

type PlannedItemInput struct {
	VariantID string  `json:"variantId"`
	Qty       float64 `json:"qty"`
	Label     *string `json:"label,omitempty"`
}

type CreateFieldTaskInput struct {
	AssigneeID        string             `json:"assigneeId"`
	SourceWarehouseID string             `json:"sourceWarehouseId"`
	Title             string             `json:"title"`
	Description       *string            `json:"description,omitempty"`
	CustomerName      *string            `json:"customerName,omitempty"`
	CustomerPhone     *string            `json:"customerPhone,omitempty"`
	Address           *string            `json:"address,omitempty"`
	Lat               *float64           `json:"lat,omitempty"`
	Lng               *float64           `json:"lng,omitempty"`
	ScheduledAt       *string            `json:"scheduledAt,omitempty"`
	PlannedItems      []PlannedItemInput `json:"plannedItems"`
}

type RejectFieldTaskInput struct {
	Reason string `json:"reason"`
}

type ReportItemInput struct {
	VariantID   string  `json:"variantId"`
	UsedQty     float64 `json:"usedQty"`
	ReturnedQty float64 `json:"returnedQty"`
	LostQty     float64 `json:"lostQty"`
}

type SubmitFieldReportInput struct {
	Items    []ReportItemInput `json:"items"`
	Photos   []string          `json:"photos,omitempty"`
	GpsLat   *float64          `json:"gpsLat,omitempty"`
	GpsLng   *float64          `json:"gpsLng,omitempty"`
	Comment  *string           `json:"comment,omitempty"`
}
