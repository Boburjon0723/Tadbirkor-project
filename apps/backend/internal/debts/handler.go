package debts

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/reports"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc     *Service
	reports *reports.Service
}

func NewHandler(svc *Service, reportsSvc *reports.Service) *Handler {
	return &Handler{svc: svc, reports: reportsSvc}
}

func (h *Handler) EntriesSummary(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.GetEntriesSummary(r.Context(), claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PartnerGroups(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	q := map[string]string{"tab": httpx.Query(r, "tab"), "search": httpx.Query(r, "search"), "page": httpx.Query(r, "page"), "limit": httpx.Query(r, "limit")}
	data, err := h.svc.FindPartnerGroups(r.Context(), claims.CompanyID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PartnerGroupOne(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.FindPartnerGroupOne(r.Context(), claims.CompanyID, chi.URLParam(r, "partnerCompanyId"), httpx.Query(r, "tab"))
	if errors.Is(err, ErrPartnerNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ListEntries(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	q := map[string]string{"status": httpx.Query(r, "status"), "page": httpx.Query(r, "page"), "limit": httpx.Query(r, "limit")}
	data, err := h.svc.FindAllEntries(r.Context(), claims.CompanyID, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PendingPayments(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.FindPendingPayments(r.Context(), claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) GetEntry(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.FindEntry(r.Context(), claims.CompanyID, chi.URLParam(r, "id"))
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PartnerLedger(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.FindPartnerLedger(r.Context(), claims.CompanyID, chi.URLParam(r, "partnerCompanyId"))
	if errors.Is(err, ErrPartnerNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PartnerBalance(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.FindPartnerBalance(r.Context(), claims.CompanyID, chi.URLParam(r, "partnerCompanyId"))
	if errors.Is(err, ErrPartnerNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PartnerReportArchive(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	q := map[string]string{
		"tab":         httpx.Query(r, "tab"),
		"search":      httpx.Query(r, "search"),
		"page":        httpx.Query(r, "page"),
		"limit":       httpx.Query(r, "limit"),
		"settledOnly": httpx.Query(r, "settledOnly"),
	}
	data, err := h.svc.FindPartnerReportArchive(r.Context(), claims.CompanyID, q)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) AktSverkaPdf(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	partnerCompanyID := chi.URLParam(r, "partnerCompanyId")
	q := reports.ReportQueryInput{
		DateFrom: ptrQuery(httpx.Query(r, "dateFrom")),
		DateTo:   ptrQuery(httpx.Query(r, "dateTo")),
	}
	data, filename, err := h.reports.GeneratePartnerBalancePDF(r.Context(), claims.CompanyID, partnerCompanyID, q)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) AktSverkaExcel(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	partnerCompanyID := chi.URLParam(r, "partnerCompanyId")
	q := reports.ReportQueryInput{
		DateFrom: ptrQuery(httpx.Query(r, "dateFrom")),
		DateTo:   ptrQuery(httpx.Query(r, "dateTo")),
	}
	data, filename, err := h.reports.ExportPartnerBalanceExcel(r.Context(), claims.CompanyID, partnerCompanyID, q)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) RecordBulkPayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var in ApplyPartnerBulkPaymentInput
	if err := decodeDebtBody(r, &in, false); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	data, err := h.svc.RecordPartnerBulkPaymentByDebtor(
		r.Context(),
		claims.CompanyID,
		chi.URLParam(r, "partnerCompanyId"),
		claims.Sub,
		in,
	)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, data)
}

func (h *Handler) ConfirmBulkPayments(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var in ConfirmPartnerBulkPaymentInput
	if err := decodeDebtBody(r, &in, true); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	data, err := h.svc.ConfirmPartnerBulkPaymentsByCreditor(
		r.Context(),
		claims.CompanyID,
		chi.URLParam(r, "partnerCompanyId"),
		claims.Sub,
		in,
	)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) ApplyPayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var in CreatePaymentRecordInput
	if err := decodeDebtBody(r, &in, false); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	data, err := h.svc.ApplyPaymentByCreditor(
		r.Context(),
		chi.URLParam(r, "id"),
		claims.CompanyID,
		claims.Sub,
		in,
	)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var in CreatePaymentRecordInput
	if err := decodeDebtBody(r, &in, false); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	data, err := h.svc.CreatePaymentRecord(
		r.Context(),
		chi.URLParam(r, "debtEntryId"),
		claims.CompanyID,
		claims.Sub,
		in,
	)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, data)
}

func (h *Handler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.ConfirmPayment(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) RejectPayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	data, err := h.svc.RejectPayment(r.Context(), chi.URLParam(r, "id"), claims.CompanyID, claims.Sub)
	if err != nil {
		h.writeDebtErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) writeDebtErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPartnerNotFound), errors.Is(err, ErrNotFound), errors.Is(err, ErrPaymentNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrForbidden):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, ErrValidation), errors.Is(err, ErrAlreadyReviewed), errors.Is(err, ErrNoPending):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, err.Error())
	}
}

func decodeDebtBody(r *http.Request, out any, allowEmpty bool) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(out); err != nil {
		if allowEmpty && errors.Is(err, io.EOF) {
			return nil
		}
		if errors.Is(err, io.EOF) {
			return errors.New("Request body talab qilinadi")
		}
		return errors.New("JSON body notogri")
	}
	return nil
}

func ptrQuery(v string) *string {
	s := strings.TrimSpace(v)
	if s == "" {
		return nil
	}
	return &s
}
