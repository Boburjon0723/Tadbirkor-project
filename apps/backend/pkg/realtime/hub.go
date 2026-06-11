package realtime

import (
	"context"
	"strings"

	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

// Hub — real-time Socket.IO emit interfeysi (NestJS gateway bilan 1:1).
type Hub interface {
	EmitInventoryChanged(companyID string, payload map[string]any)
	EmitDashboardRefresh(companyID string)
	EmitOrdersChanged(companyID string, payload map[string]any)
	EmitDebtsChanged(companyID string, payload map[string]any)
	EmitImportProgress(companyID string, payload map[string]any)
	EmitToUser(userID, event string, payload map[string]any)
}

type noopHub struct{}

func (noopHub) EmitInventoryChanged(string, map[string]any) {}
func (noopHub) EmitDashboardRefresh(string)                  {}
func (noopHub) EmitOrdersChanged(string, map[string]any)     {}
func (noopHub) EmitDebtsChanged(string, map[string]any)      {}
func (noopHub) EmitImportProgress(string, map[string]any)    {}
func (noopHub) EmitToUser(string, string, map[string]any)    {}

// Noop — websocket o‘chirilgan yoki test uchun.
var Noop Hub = noopHub{}

// NotifyInventory — ombor o‘zgarganda Redis kesh + websocket yangilash.
func NotifyInventory(ctx context.Context, h Hub, c *cache.Cache, companyID string, payload map[string]any) {
	warehouseID := ""
	if payload != nil {
		if v, ok := payload["warehouseId"].(string); ok {
			warehouseID = strings.TrimSpace(v)
		}
	}
	if c != nil {
		c.InvalidateStockCaches(ctx, companyID, warehouseID)
	}
	if h == nil {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	h.EmitInventoryChanged(companyID, payload)
	h.EmitDashboardRefresh(companyID)
}

// NotifyDashboardChange — dashboard stats keshi + websocket.
func NotifyDashboardChange(ctx context.Context, h Hub, c *cache.Cache, companyID string) {
	if c != nil {
		c.InvalidateDashboardStats(ctx, companyID)
	}
	if h != nil {
		h.EmitDashboardRefresh(companyID)
	}
}
