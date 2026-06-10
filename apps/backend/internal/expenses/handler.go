package expenses

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) canManage(role string) bool {
	perms := permissions.Effective(role, nil, nil)
	for _, p := range perms {
		if p == "expenses.manage" {
			return true
		}
	}
	return false
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	cats, err := h.svc.ListCategories(r.Context(), claims.CompanyID, false)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, cats)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreateCategoryInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	cat, err := h.svc.CreateCategory(r.Context(), claims.CompanyID, input)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, cat)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var input UpdateCategoryInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	cat, err := h.svc.UpdateCategory(r.Context(), claims.CompanyID, id, input)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, cat)
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	filter := ExpenseFilter{}
	if from := r.URL.Query().Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = &t
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = &t
		}
	}
	if cur := r.URL.Query().Get("currency"); cur != "" {
		filter.Currency = &cur
	}

	summary, err := h.svc.GetSummary(r.Context(), claims.CompanyID, filter)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, summary)
}

func (h *Handler) FindAll(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	filter := ExpenseFilter{}
	if st := r.URL.Query().Get("status"); st != "" {
		filter.Status = &st
	}
	if cid := r.URL.Query().Get("categoryId"); cid != "" {
		filter.CategoryID = &cid
	}
	if from := r.URL.Query().Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = &t
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = &t
		}
	}
	if q := r.URL.Query().Get("search"); q != "" {
		filter.Search = &q
	}
	page := 1
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil {
		page = p
	}
	limit := 50
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		limit = l
	}

	res, err := h.svc.FindAll(r.Context(), claims.CompanyID, filter, page, limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	res, err := h.svc.FindOne(r.Context(), claims.CompanyID, id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreateExpenseInput
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

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var input UpdateExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	canManage := h.canManage(claims.Role)
	res, err := h.svc.Update(r.Context(), claims.CompanyID, claims.Sub, id, input, canManage)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	res, err := h.svc.Approve(r.Context(), claims.CompanyID, claims.Sub, id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var input RejectExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	res, err := h.svc.Reject(r.Context(), claims.CompanyID, claims.Sub, id, input)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	canManage := h.canManage(claims.Role)
	err := h.svc.Remove(r.Context(), claims.CompanyID, claims.Sub, id, canManage)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true})
}
