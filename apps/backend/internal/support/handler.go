package support

import (
	"encoding/json"
	"net/http"

	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetContext(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}

	ctxRes, err := h.svc.GetContext(r.Context(), claims.CompanyID, claims.Sub)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}

	httpx.JSON(w, http.StatusOK, ctxRes)
}

func (h *Handler) SubmitMessage(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}

	var input SubmitSupportMessageInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}

	res, err := h.svc.SubmitMessage(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Xabarni yuborishda xatolik")
		return
	}

	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) SubmitPublicMessage(w http.ResponseWriter, r *http.Request) {
	var input SubmitPublicSupportMessageInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}

	res, err := h.svc.SubmitPublicMessage(r.Context(), input)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Xabarni yuborishda xatolik")
		return
	}

	httpx.JSON(w, http.StatusCreated, res)
}
