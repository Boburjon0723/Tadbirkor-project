package field

import (
	"encoding/json"
	"errors"
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

func claims(r *http.Request) (*middleware.JWTClaims, bool) {
	return middleware.ClaimsFromContext(r.Context())
}

func ptrQ(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (h *Handler) write(w http.ResponseWriter, err error, data any) {
	if err == nil {
		httpx.JSON(w, http.StatusOK, data)
		return
	}
	switch {
	case errors.Is(err, ErrTaskNotFound), errors.Is(err, ErrWarehouseNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrForbidden):
		httpx.Error(w, http.StatusForbidden, err.Error())
	default:
		var br badRequestError
		if errors.As(err, &br) {
			httpx.Error(w, http.StatusBadRequest, br.Error())
			return
		}
		httpx.Error(w, http.StatusBadRequest, err.Error())
	}
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindAll(r.Context(), c.CompanyID,
		ptrQ(httpx.Query(r, "status")), ptrQ(httpx.Query(r, "assigneeId")), ptrQ(httpx.Query(r, "warehouseId")))
	h.write(w, err, data)
}

func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), c.CompanyID, chi.URLParam(r, "id"))
	h.write(w, err, data)
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreateFieldTaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.CreateAndAssign(r.Context(), c.CompanyID, c.Sub, input)
	h.write(w, err, data)
}

func (h *Handler) ApproveTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.ApproveTask(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "id"))
	h.write(w, err, data)
}

func (h *Handler) RejectTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input RejectFieldTaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RejectTask(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "id"), input.Reason)
	h.write(w, err, data)
}

func (h *Handler) WorkerStock(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.ListWorkerBalances(r.Context(), c.CompanyID)
	h.write(w, err, data)
}

func (h *Handler) Kpi(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetKpi(r.Context(), c.CompanyID, ptrQ(httpx.Query(r, "from")), ptrQ(httpx.Query(r, "to")))
	h.write(w, err, data)
}

func (h *Handler) MyTasks(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetMyTasks(r.Context(), c.Sub, c.CompanyID, ptrQ(httpx.Query(r, "status")))
	h.write(w, err, data)
}

func (h *Handler) MyTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), c.CompanyID, chi.URLParam(r, "id"))
	h.write(w, err, data)
}

func (h *Handler) MyStock(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetMyStock(r.Context(), c.Sub, c.CompanyID)
	h.write(w, err, data)
}

func (h *Handler) MyHistory(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	status := StatusApproved
	data, err := h.svc.GetMyTasks(r.Context(), c.Sub, c.CompanyID, &status)
	h.write(w, err, data)
}

func (h *Handler) AcceptTask(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.AcceptTask(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "id"))
	h.write(w, err, data)
}

func (h *Handler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input SubmitFieldReportInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	if len(input.Items) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Hisobot qatorlari kerak")
		return
	}
	data, err := h.svc.SubmitReport(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "id"), input)
	h.write(w, err, data)
}
