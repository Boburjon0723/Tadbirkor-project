package inventorycounts

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

func (h *Handler) assertFeature(w http.ResponseWriter, r *http.Request, companyID string) bool {
	if err := h.companies.AssertFeatureEnabled(r.Context(), companyID, "WAREHOUSE_INVENTORY_COUNT"); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	data, err := h.svc.List(r.Context(), claims.CompanyID, httpx.Query(r, "status"), httpx.Query(r, "warehouseId"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	data, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) Start(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	var in StartInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Start(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeErr(w, err, data, http.StatusCreated)
}

func (h *Handler) Scan(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	var in ScanInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RecordByBarcode(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in.Barcode, in.CountedQuantity)
	h.writeErr(w, err, data, http.StatusOK)
}

func (h *Handler) RecordCount(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	var in RecordCountInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RecordCount(r.Context(), chi.URLParam(r, "itemId"), claims.CompanyID, claims.Sub, in.CountedQuantity)
	h.writeErr(w, err, data, http.StatusOK)
}

func (h *Handler) ApproveItem(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	data, err := h.svc.ApproveItem(r.Context(), chi.URLParam(r, "itemId"), claims.CompanyID)
	h.writeErr(w, err, data, http.StatusOK)
}

func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	data, err := h.svc.Complete(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.writeErr(w, err, data, http.StatusOK)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if !h.assertFeature(w, r, claims.CompanyID) {
		return
	}
	data, err := h.svc.Cancel(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	h.writeErr(w, err, data, http.StatusOK)
}

func (h *Handler) writeErr(w http.ResponseWriter, err error, data any, okCode int) {
	if err == nil {
		httpx.JSON(w, okCode, data)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrItemNotFound), errors.Is(err, ErrWarehouseNF), errors.Is(err, ErrBarcodeNF):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrNoBalances), strings.Contains(err.Error(), ErrActiveCount.Error()):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		msg := err.Error()
		if msg == "Sanalgan miqdor noto'g'ri" || msg == "Barcode yoki SKU kiriting" ||
			msg == "Inventarizatsiya aktiv emas" || strings.HasPrefix(msg, "Faqat") ||
			strings.HasPrefix(msg, "Hali") || strings.HasPrefix(msg, "Manager") ||
			strings.HasPrefix(msg, "Inventarizatsiyani") {
			httpx.Error(w, http.StatusBadRequest, msg)
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}
