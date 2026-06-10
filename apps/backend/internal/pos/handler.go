package pos

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Catalog(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := map[string]string{
		"warehouseId": httpx.Query(r, "warehouseId"),
		"search":      httpx.Query(r, "search"),
		"limit":       httpx.Query(r, "limit"),
		"page":        httpx.Query(r, "page"),
	}
	data, err := h.svc.GetCatalog(r.Context(), claims.CompanyID, claims.Sub, q)
	if errors.Is(err, ErrBadWarehouse) || errors.Is(err, ErrForbiddenWH) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) QuickSearch(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.QuickSearch(r.Context(), claims.CompanyID, claims.Sub, httpx.Query(r, "query"), httpx.Query(r, "warehouseId"))
	if errors.Is(err, ErrForbiddenWH) {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) SummaryToday(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.SummaryToday(r.Context(), claims.CompanyID, httpx.Query(r, "cashierId"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ListSales(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := map[string]string{
		"status": httpx.Query(r, "status"), "warehouseId": httpx.Query(r, "warehouseId"),
		"cashierId": httpx.Query(r, "cashierId"), "date": httpx.Query(r, "date"),
		"from": httpx.Query(r, "from"), "to": httpx.Query(r, "to"),
	}
	data, err := h.svc.FindAll(r.Context(), claims.CompanyID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) GetSale(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
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

func (h *Handler) CreateSale(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in CreateSaleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Create(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeSaleResult(w, err, data, http.StatusCreated)
}

func (h *Handler) QuickCheckout(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in QuickCheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.QuickCheckout(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeSaleResult(w, err, data, http.StatusCreated)
}

func (h *Handler) UpdateSale(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpdateSaleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Update(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.writeSaleResult(w, err, data, http.StatusOK)
}

func (h *Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in CheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Checkout(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.writeSaleResult(w, err, data, http.StatusOK)
}

func (h *Handler) VoidSale(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in VoidInput
	_ = json.NewDecoder(r.Body).Decode(&in)
	data, err := h.svc.Void(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.writeSaleResult(w, err, data, http.StatusOK)
}

func (h *Handler) DeleteSale(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.Remove(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, ErrDraftDelete) {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) writeSaleResult(w http.ResponseWriter, err error, data map[string]any, okStatus int) {
	if err == nil {
		httpx.JSON(w, okStatus, data)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrCustomerNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrForbiddenWH):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrWarehouseNF):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrDraftOnly), errors.Is(err, ErrAlreadyClosed), errors.Is(err, ErrEmptyCart),
		errors.Is(err, ErrEmptyCheckout), errors.Is(err, ErrAlreadyVoided), errors.Is(err, ErrVariantInactive),
		errors.Is(err, ErrVariantNotFound), errors.Is(err, ErrMixedCurrency), errors.Is(err, stock.ErrInsufficientStock):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	case strings.Contains(err.Error(), "Nasiya"), strings.Contains(err.Error(), "naqd yetarli"),
		strings.Contains(err.Error(), "narxni"), strings.Contains(err.Error(), "chegirma"),
		strings.Contains(err.Error(), "Miqdor"), strings.Contains(err.Error(), "ruxsat"):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}
