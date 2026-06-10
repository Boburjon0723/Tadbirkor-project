package tasks

import (
	"encoding/json"
	"net/http"

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
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.svc.FindAll(r.Context(), claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if res == nil {
		res = []TaskResponse{}
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) FindMy(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.svc.FindMy(r.Context(), claims.CompanyID, claims.Sub)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if res == nil {
		res = []TaskResponse{}
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreateTaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.Create(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var input UpdateTaskStatusInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.UpdateStatus(r.Context(), claims.CompanyID, claims.Sub, id, input)
	if err != nil {
		if err.Error() == "Task topilmadi" {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		if err.Error() == "Faqat task egasi yoki yaratuvchisi holatni o‘zgartira oladi" {
			httpx.Error(w, http.StatusForbidden, err.Error())
			return
		}
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) Assign(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var input AssignTaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.Assign(r.Context(), claims.CompanyID, id, input)
	if err != nil {
		if err.Error() == "Task topilmadi" {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
