package dispatches

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

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.Create(r.Context(), claims.CompanyID, claims.Sub, input)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) CreateAndSend(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.CreateAndSend(r.Context(), claims.CompanyID, claims.Sub, input)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := map[string]string{
		"page": httpx.Query(r, "page"), "limit": httpx.Query(r, "limit"),
		"status": httpx.Query(r, "status"), "search": httpx.Query(r, "search"),
	}
	res, err := h.svc.FindAll(r.Context(), claims.CompanyID, q)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	res, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), claims.CompanyID)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	res, err := h.svc.Send(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	res, err := h.svc.Cancel(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	h.write(w, err, res, http.StatusOK)
}

func (h *Handler) write(w http.ResponseWriter, err error, res map[string]any, okStatus int) {
	if err == nil {
		httpx.JSON(w, okStatus, res)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrOrderNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrWarehouseNF):
		httpx.Error(w, http.StatusNotFound, err.Error())
	default:
		var br badRequestError
		if errors.As(err, &br) {
			httpx.Error(w, http.StatusBadRequest, br.Error())
			return
		}
		msg := err.Error()
		if strings.Contains(msg, "topilmadi") || strings.Contains(msg, "bekor qilib bo'lmaydi") {
			httpx.Error(w, http.StatusNotFound, msg)
			return
		}
		httpx.Error(w, http.StatusBadRequest, msg)
	}
}
