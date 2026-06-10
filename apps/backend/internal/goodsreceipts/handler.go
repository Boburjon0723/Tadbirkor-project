package goodsreceipts

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

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := map[string]string{
		"page":   httpx.Query(r, "page"),
		"limit":  httpx.Query(r, "limit"),
		"status": httpx.Query(r, "status"),
		"search": httpx.Query(r, "search"),
	}
	data, err := h.svc.FindAll(r.Context(), claims.CompanyID, q)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportAllExcel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportAllToExcel(r.Context(), claims.CompanyID)
	if err != nil {
		h.write(w, err, nil, http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(
		r.Context(),
		chi.URLParam(r, "id"),
		claims.CompanyID,
		httpx.Query(r, "mode"),
		httpx.Query(r, "page"),
		httpx.Query(r, "limit"),
	)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Accept(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in AcceptReceiptInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Accept(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) PartialAccept(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in PartialAcceptReceiptInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.PartialAccept(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub, in)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.Reject(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportReceiptToExcel(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	if err != nil {
		h.write(w, err, nil, http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) DownloadPDF(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportReceiptToPDF(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	if err != nil {
		h.write(w, err, nil, http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) write(w http.ResponseWriter, err error, data any, okStatus int) {
	if err == nil {
		httpx.JSON(w, okStatus, data)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
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
		httpx.Error(w, http.StatusBadRequest, err.Error())
	}
}
