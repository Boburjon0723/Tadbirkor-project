package payroll

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	leaveSvc *LeaveService
	dataSvc  *DataService
}

func NewHandler(leaveSvc *LeaveService, dataSvc *DataService) *Handler {
	return &Handler{leaveSvc: leaveSvc, dataSvc: dataSvc}
}

func writePayrollErr(w http.ResponseWriter, err error) {
	var br badRequestError
	var fr forbiddenError
	switch {
	case errors.As(err, &br):
		httpx.Error(w, http.StatusBadRequest, br.Error())
	case errors.As(err, &fr):
		httpx.Error(w, http.StatusForbidden, fr.Error())
	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "Topilmadi")
	default:
		httpx.Error(w, http.StatusInternalServerError, err.Error())
	}
}

func queryYearMonth(r *http.Request) (int, int) {
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	return defaultYearMonth(year, month)
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.leaveSvc.GetSettings(r.Context(), claims.CompanyID)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input UpdatePayrollSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	if err := h.leaveSvc.UpdateSettings(r.Context(), claims.CompanyID, input.WorkedDaysMode); err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) ListLeaveRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	mine := r.URL.Query().Get("mine") == "1" || r.URL.Query().Get("mine") == "true"
	res, err := h.leaveSvc.ListLeaveRequests(r.Context(), claims.CompanyID, claims.Sub, r.URL.Query().Get("status"), mine)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) PendingLeaveCount(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.leaveSvc.CountPendingLeave(r.Context(), claims.CompanyID, claims.Sub)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) CreateLeaveRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreateLeaveRequestInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.leaveSvc.CreateLeaveRequest(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) ApproveLeaveRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input ReviewLeaveRequestInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	res, err := h.leaveSvc.ApproveLeaveRequest(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "id"), strPtr(input.ReviewNote))
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) RejectLeaveRequest(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input ReviewLeaveRequestInput
	_ = json.NewDecoder(r.Body).Decode(&input)
	res, err := h.leaveSvc.RejectLeaveRequest(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "id"), strPtr(input.ReviewNote))
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func strPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := strings.TrimSpace(s)
	return &v
}

func (h *Handler) GetWorkMonth(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	res, err := h.leaveSvc.GetWorkMonth(r.Context(), claims.CompanyID, chi.URLParam(r, "companyUserId"), year, month)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpdateWorkMonth(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	var input UpdateWorkMonthInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.leaveSvc.UpdateWorkMonthManual(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), year, month, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.leaveSvc.ListCompanyMembers(r.Context(), claims.CompanyID)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListMemberLeaveRequests(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var year, month *int
	if y := r.URL.Query().Get("year"); y != "" {
		v, _ := strconv.Atoi(y)
		year = &v
	}
	if m := r.URL.Query().Get("month"); m != "" {
		v, _ := strconv.Atoi(m)
		month = &v
	}
	res, err := h.leaveSvc.ListMemberLeaveRequests(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), year, month)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetMemberProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.leaveSvc.GetPayrollProfile(r.Context(), claims.CompanyID, chi.URLParam(r, "companyUserId"))
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpsertPayrollProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input UpsertPayrollProfileInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.leaveSvc.UpsertPayrollProfile(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), input.MonthlyPaidLeaveQuota)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) RecordMemberLeave(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreateMemberLeaveInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.leaveSvc.RecordLeaveForMember(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) ApprovedLeaves(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	res, err := h.leaveSvc.ListApprovedLeaveDays(r.Context(), claims.CompanyID, chi.URLParam(r, "companyUserId"), year, month)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListCompensations(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.dataSvc.ListCompensations(r.Context(), claims.CompanyID)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpsertCompensation(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input UpsertCompensationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.UpsertCompensation(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) ListEmployeeExtras(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.dataSvc.ListEmployeeExtras(r.Context(), claims.CompanyID)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetEmployeeExtra(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.dataSvc.GetEmployeeExtra(r.Context(), claims.CompanyID, chi.URLParam(r, "companyUserId"))
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpsertEmployeeExtra(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input UpsertPayrollEmployeeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.UpsertEmployeeExtra(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListRosterCandidates(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.dataSvc.ListRosterCandidates(r.Context(), claims.CompanyID)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) AddMemberToRoster(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	res, err := h.dataSvc.AddMemberToPayrollRoster(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"))
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) CreatePayrollOnlyMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input CreatePayrollOnlyMemberInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.CreatePayrollOnlyMember(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) MarkEmployeeLeft(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input MarkEmployeeLeftInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.MarkEmployeeLeft(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListAdvances(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	res, err := h.dataSvc.ListAdvances(r.Context(), claims.CompanyID, r.URL.Query().Get("companyUserId"), year, month)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) AddAdvance(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input AddPayrollAdvanceInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.AddAdvance(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) AddBonus(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var input AddPayrollBonusInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.AddBonus(r.Context(), claims.CompanyID, claims.Sub, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) GetMonthStats(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	ids := []string{}
	if raw := r.URL.Query().Get("companyUserIds"); raw != "" {
		for _, p := range strings.Split(raw, ",") {
			if v := strings.TrimSpace(p); v != "" {
				ids = append(ids, v)
			}
		}
	}
	res, err := h.dataSvc.GetMonthStats(r.Context(), claims.CompanyID, year, month, ids)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetSettlement(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	defaultBase, _ := strconv.ParseFloat(r.URL.Query().Get("defaultBaseSalary"), 64)
	res, err := h.dataSvc.GetSettlement(r.Context(), claims.CompanyID, chi.URLParam(r, "companyUserId"), year, month, defaultBase)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpsertSettlement(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	year, month := queryYearMonth(r)
	var input UpsertPayrollSettlementInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid input")
		return
	}
	res, err := h.dataSvc.UpsertSettlement(r.Context(), claims.CompanyID, claims.Sub, chi.URLParam(r, "companyUserId"), year, month, input)
	if err != nil {
		writePayrollErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
