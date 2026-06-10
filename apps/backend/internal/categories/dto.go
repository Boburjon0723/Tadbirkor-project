package categories

type CreateInput struct {
	Name        string  `json:"name"`
	ParentID    *string `json:"parentId"`
	WarehouseID *string `json:"warehouseId"`
	Status      *string `json:"status"`
}

type UpdateInput struct {
	Name        *string `json:"name"`
	ParentID    *string `json:"parentId"`
	WarehouseID *string `json:"warehouseId"`
	Status      *string `json:"status"`
}
