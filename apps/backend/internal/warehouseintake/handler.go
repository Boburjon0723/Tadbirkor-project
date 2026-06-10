package warehouseintake

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) LookupBarcode(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	barcode := strings.TrimSpace(httpx.Query(r, "barcode"))
	if barcode == "" {
		httpx.Error(w, http.StatusBadRequest, "Barcode kiriting")
		return
	}
	var warehouseID *string
	if wid := strings.TrimSpace(httpx.Query(r, "warehouseId")); wid != "" {
		warehouseID = &wid
	}
	data, err := h.svc.LookupBarcode(r.Context(), claims.CompanyID, claims.Sub, barcode, warehouseID)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in CreateWarehouseIntakeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Create(r.Context(), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusCreated)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var status *string
	if v := strings.TrimSpace(httpx.Query(r, "status")); v != "" {
		status = &v
	}
	var warehouseID *string
	if v := strings.TrimSpace(httpx.Query(r, "warehouseId")); v != "" {
		warehouseID = &v
	}
	data, err := h.svc.List(r.Context(), claims.CompanyID, claims.Sub, status, warehouseID)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) AddLine(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in AddIntakeLineInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.AddLine(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ScanLine(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in ScanIntakeLineInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.ScanLine(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) QuickProduct(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in QuickIntakeProductInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.QuickProduct(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) UpdateLine(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpdateIntakeLineInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateLine(
		r.Context(),
		chi.URLParam(r, "id"),
		chi.URLParam(r, "lineId"),
		claims.CompanyID,
		claims.Sub,
		in,
	)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) RemoveLine(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.RemoveLine(
		r.Context(),
		chi.URLParam(r, "id"),
		chi.URLParam(r, "lineId"),
		claims.CompanyID,
		claims.Sub,
	)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.Complete(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.Cancel(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) DownloadNakladnoy(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.GetNakladnoyPDF(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	if err != nil {
		h.write(w, err, nil, http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) write(w http.ResponseWriter, err error, data any, okStatus int) {
	if err == nil {
		httpx.JSON(w, okStatus, data)
		return
	}
	switch {
	case errors.Is(err, scope.ErrNoWarehouseAssigned), errors.Is(err, scope.ErrWarehouseForbidden):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrLineNotFound), errors.Is(err, ErrWarehouseNotFound), errors.Is(err, ErrVariantNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrDraftOnly):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		var br badRequestError
		if errors.As(err, &br) {
			httpx.Error(w, http.StatusBadRequest, br.Error())
			return
		}
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "topilmadi") {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		if strings.Contains(msg, "majburiy") || strings.Contains(msg, "noto'g'ri") || strings.Contains(msg, "topildi - qo'lda") {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}
