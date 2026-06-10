package products

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	companyID := httpx.Query(r, "companyId")
	if companyID == "" {
		companyID = claims.CompanyID
	}
	q := map[string]string{
		"warehouseId": httpx.Query(r, "warehouseId"),
		"search":      httpx.Query(r, "search"),
		"status":      httpx.Query(r, "status"),
		"categoryId":  httpx.Query(r, "categoryId"),
		"page":        httpx.Query(r, "page"),
		"limit":       httpx.Query(r, "limit"),
	}
	data, err := h.svc.FindAll(r.Context(), companyID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	companyID := httpx.Query(r, "companyId")
	if companyID == "" {
		companyID = claims.CompanyID
	}
	q := map[string]string{
		"search": httpx.Query(r, "search"), "status": httpx.Query(r, "status"),
		"categoryId": httpx.Query(r, "categoryId"),
	}
	data, err := h.svc.CatalogSummary(r.Context(), companyID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, httpx.Query(r, "warehouseId"))
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

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in CreateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Create(r.Context(), claims.CompanyID, claims.Sub, in)
	h.writeProduct(w, err, data, http.StatusCreated)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Update(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.writeProduct(w, err, data, http.StatusOK)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.Remove(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	if err == nil {
		httpx.JSON(w, http.StatusOK, data)
		return
	}
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
}

func (h *Handler) writeProduct(w http.ResponseWriter, err error, data map[string]any, ok int) {
	if err == nil {
		httpx.JSON(w, ok, data)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrCategoryNF):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrBadInput), errors.Is(err, ErrDuplicateSKU), errors.Is(err, ErrDuplicateBarcode),
		errors.Is(err, ErrNoWarehouse):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	case strings.Contains(err.Error(), "ombor"):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
	}
}

