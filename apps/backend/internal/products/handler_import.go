package products

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

func (h *Handler) ImportPreview(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Fayl yuklanmadi")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Fayl yuklanmadi")
		return
	}
	defer file.Close()
	buf, err := io.ReadAll(file)
	if err != nil || len(buf) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Fayl yuklanmadi")
		return
	}
	data, err := h.svc.ImportPreview(r.Context(), claims.CompanyID, buf, r.URL.Query().Get("warehouseId"), r.URL.Query().Get("importMode"))
	if err != nil {
		h.writeProduct(w, err, nil, 0)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ImportConfirm(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input ImportConfirmInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.ImportConfirm(r.Context(), claims.CompanyID, claims.Sub, input, r.URL.Query().Get("warehouseId"))
	if err != nil {
		h.writeProduct(w, err, nil, 0)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ImportJobStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetImportJobStatus(r.Context(), claims.CompanyID, chi.URLParam(r, "jobId"))
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, "Import job topilmadi")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ImportJobFailures(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	limit := 30
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	data, err := h.svc.GetImportJobFailures(r.Context(), claims.CompanyID, chi.URLParam(r, "jobId"), limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) CancelImportJob(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.CancelImportJob(r.Context(), claims.CompanyID, chi.URLParam(r, "jobId"))
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, "Import job topilmadi")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}
