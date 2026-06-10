package picktasks

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc       *Service
	companies *companies.Service
}

func NewHandler(svc *Service, companiesSvc *companies.Service) *Handler {
	return &Handler{svc: svc, companies: companiesSvc}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := h.companies.AssertFeatureEnabled(r.Context(), claims.CompanyID, "WAREHOUSE_PICKING"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := h.svc.List(r.Context(), claims.CompanyID, httpx.Query(r, "status"), httpx.Query(r, "warehouseId"))
	h.writeList(w, err, res)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := h.companies.AssertFeatureEnabled(r.Context(), claims.CompanyID, "WAREHOUSE_PICKING"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	h.writeOne(w, err, res)
}

func (h *Handler) Scan(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := h.companies.AssertFeatureEnabled(r.Context(), claims.CompanyID, "WAREHOUSE_PICKING"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	var input ScanInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.Scan(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, input)
	h.writePlain(w, err, res)
}

func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := h.companies.AssertFeatureEnabled(r.Context(), claims.CompanyID, "WAREHOUSE_PICKING"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := h.svc.Complete(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.writePlain(w, err, res)
}

func (h *Handler) ListForDispatch(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	res, err := h.svc.ListForDispatch(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	h.writeList(w, err, res)
}

func (h *Handler) writeList(w http.ResponseWriter, err error, res []PickTaskResponse) {
	if err != nil {
		h.writeErr(w, err)
		return
	}
	if res == nil {
		res = []PickTaskResponse{}
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) writeOne(w http.ResponseWriter, err error, res *PickTaskResponse) {
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) writePlain(w http.ResponseWriter, err error, res *PickTaskPlain) {
	if err != nil {
		h.writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrDispatchNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	default:
		var br badRequestError
		if errors.As(err, &br) {
			httpx.Error(w, http.StatusBadRequest, br.Error())
			return
		}
		msg := err.Error()
		if msg == "Foydalanuvchi kompaniyada topilmadi" ||
			msg == "Vazifa bekor qilingan" ||
			msg == "Vazifa allaqachon tugagan" ||
			msg == "Noto'g'ri mahsulot skanerlandi" ||
			msg == "To'liq saralanmagan vazifani tugatib bo'lmaydi" ||
			strings.HasPrefix(msg, "Miqdor oshib ketdi") {
			httpx.Error(w, http.StatusBadRequest, msg)
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}
