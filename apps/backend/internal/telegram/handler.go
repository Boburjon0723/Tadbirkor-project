package telegram

import (
	"errors"
	"net/http"

	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	secret := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
	err := h.svc.HandleWebhookUpdate(r.Context(), secret, r)
	if err != nil {
		if errors.Is(err, ErrInvalidWebhookSecret) {
			httpx.Error(w, http.StatusUnauthorized, "Invalid Telegram webhook secret")
			return
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
