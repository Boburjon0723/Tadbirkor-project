package stock

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

type Handler struct {
	svc       *Service
	companies *companies.Service
}

func NewHandler(svc *Service, companiesSvc *companies.Service) *Handler {
	return &Handler{svc: svc, companies: companiesSvc}
}

func (h *Handler) Balances(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetBalances(r.Context(), claims.CompanyID, claims.Sub, httpx.Query(r, "warehouseId"))
	h.writeScope(w, err, data)
}

func (h *Handler) Movements(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetMovements(r.Context(), claims.CompanyID, claims.Sub, httpx.Query(r, "warehouseId"))
	h.writeScope(w, err, data)
}

func (h *Handler) RecordIn(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in MovementInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RecordIn(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeStock(w, err, data)
}

func (h *Handler) RecordOut(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in MovementInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RecordOut(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeStock(w, err, data)
}

func (h *Handler) Adjust(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in AdjustmentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Adjust(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeStock(w, err, data)
}

func (h *Handler) Transfer(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in TransferInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Transfer(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeStock(w, err, data)
}

func (h *Handler) BatchAvailability(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := h.companies.AssertFeatureEnabled(r.Context(), claims.CompanyID, "WAREHOUSE_ATP"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	var in BatchAvailabilityInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.GetBatchAvailability(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeScope(w, err, data)
}

func (h *Handler) Availability(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetAvailability(r.Context(), claims.CompanyID, chi.URLParam(r, "variantId"), httpx.Query(r, "warehouseId"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) writeScope(w http.ResponseWriter, err error, data any) {
	if errors.Is(err, scope.ErrNoWarehouseAssigned) || errors.Is(err, scope.ErrWarehouseForbidden) {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) writeStock(w http.ResponseWriter, err error, data map[string]any) {
	if err == nil {
		httpx.JSON(w, http.StatusOK, data)
		return
	}
	switch {
	case errors.Is(err, ErrWarehouseNF), errors.Is(err, ErrVariantNF):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrInsufficientStock), errors.Is(err, ErrBadAdjust), errors.Is(err, ErrSameWH):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}
