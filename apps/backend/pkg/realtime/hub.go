package realtime

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

// NotifyInventory — ombor o‘zgarganda frontend keshini yangilash uchun.
func NotifyInventory(h Hub, companyID string, payload map[string]any) {
	if h == nil {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	h.EmitInventoryChanged(companyID, payload)
	h.EmitDashboardRefresh(companyID)
}
