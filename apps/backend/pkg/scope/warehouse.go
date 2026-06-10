package scope

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
)

var (
	ErrNoWarehouseAssigned = errors.New("Ombor biriktirilmagan. Jamoa bo'limida omborni belgilang")
	ErrWarehouseForbidden  = errors.New("Ushbu ombor ma'lumotlariga ruxsat yo'q")
)

type Warehouse struct {
	All                bool
	WarehouseIDs       []string
	DefaultWarehouseID *string
	Role               string
}

func ForUser(ctx context.Context, pool *pgxpool.Pool, companyID, userID string) (Warehouse, error) {
	var role string
	var whID *string
	err := pool.QueryRow(ctx, `
		SELECT role, "warehouseId" FROM "CompanyUser"
		WHERE "companyId" = $1 AND "userId" = $2 LIMIT 1
	`, companyID, userID).Scan(&role, &whID)
	if err != nil {
		return Warehouse{All: true, Role: "OWNER"}, nil
	}
	if permissions.RoleAllowsAllWarehouses(role) {
		return Warehouse{All: true, DefaultWarehouseID: whID, Role: role}, nil
	}
	ids := []string{}
	if whID != nil && *whID != "" {
		ids = []string{*whID}
	}
	return Warehouse{
		All: false, WarehouseIDs: ids, DefaultWarehouseID: whID, Role: role,
	}, nil
}

func (w Warehouse) Allowed(warehouseID string) bool {
	if w.All {
		return true
	}
	for _, id := range w.WarehouseIDs {
		if id == warehouseID {
			return true
		}
	}
	return false
}

func (w Warehouse) Resolve(requested string) (string, error) {
	req := strings.TrimSpace(requested)
	if !w.All {
		if len(w.WarehouseIDs) == 0 {
			return "", ErrNoWarehouseAssigned
		}
		if req != "" && !w.Allowed(req) {
			return "", ErrWarehouseForbidden
		}
		if req != "" {
			return req, nil
		}
		if w.DefaultWarehouseID != nil && *w.DefaultWarehouseID != "" {
			return *w.DefaultWarehouseID, nil
		}
		return w.WarehouseIDs[0], nil
	}
	return req, nil
}
