package realtime

import (
	"time"

	socketio "github.com/zishang520/socket.io/servers/socket/v3"
)

type socketHub struct {
	server *socketio.Server
}

func (h *socketHub) companyRoom(companyID string) socketio.Room {
	return socketio.Room("company:" + companyID)
}

func (h *socketHub) userRoom(userID string) socketio.Room {
	return socketio.Room("user:" + userID)
}

func (h *socketHub) inventoryNS() socketio.Namespace {
	if h == nil || h.server == nil {
		return nil
	}
	return h.server.Of("/inventory", nil)
}

func (h *socketHub) notificationsNS() socketio.Namespace {
	if h == nil || h.server == nil {
		return nil
	}
	return h.server.Of("/notifications", nil)
}

func (h *socketHub) EmitInventoryChanged(companyID string, payload map[string]any) {
	nsp := h.inventoryNS()
	if nsp == nil || companyID == "" {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	nsp.To(h.companyRoom(companyID)).Emit("inventory:changed", payload)
}

func (h *socketHub) EmitDashboardRefresh(companyID string) {
	nsp := h.inventoryNS()
	if nsp == nil || companyID == "" {
		return
	}
	nsp.To(h.companyRoom(companyID)).Emit("dashboard:refresh", map[string]any{"at": time.Now().UnixMilli()})
}

func (h *socketHub) EmitOrdersChanged(companyID string, payload map[string]any) {
	nsp := h.inventoryNS()
	if nsp == nil || companyID == "" {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	nsp.To(h.companyRoom(companyID)).Emit("orders:changed", payload)
}

func (h *socketHub) EmitDebtsChanged(companyID string, payload map[string]any) {
	nsp := h.inventoryNS()
	if nsp == nil || companyID == "" {
		return
	}
	if payload == nil {
		payload = map[string]any{"at": time.Now().UnixMilli()}
	} else {
		payload["at"] = time.Now().UnixMilli()
	}
	nsp.To(h.companyRoom(companyID)).Emit("debts:changed", payload)
}

func (h *socketHub) EmitImportProgress(companyID string, payload map[string]any) {
	nsp := h.inventoryNS()
	if nsp == nil || companyID == "" || payload == nil {
		return
	}
	nsp.To(h.companyRoom(companyID)).Emit("import:progress", payload)
}

func (h *socketHub) EmitToUser(userID, event string, payload map[string]any) {
	nsp := h.notificationsNS()
	if nsp == nil || userID == "" || event == "" {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	nsp.To(h.userRoom(userID)).Emit(event, payload)
}
