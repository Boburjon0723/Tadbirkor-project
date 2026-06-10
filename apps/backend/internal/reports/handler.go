package reports

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) MonthlyOverview(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := MonthlyOverviewQueryInput{
		Year:  parseIntOrDefault(r.URL.Query().Get("year"), 0),
		Month: parseIntOrDefault(r.URL.Query().Get("month"), 0),
	}
	data, err := h.svc.GetMonthlyOverview(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) PosSummary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetPosSummary(r.Context(), claims.CompanyID, claims.Sub, q)
	h.writeResult(w, data, err)
}

func (h *Handler) PosTopProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetPosTopProducts(r.Context(), claims.CompanyID, claims.Sub, q)
	h.writeResult(w, data, err)
}

func (h *Handler) FieldWorkerInstallations(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetFieldWorkerInstallations(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetCostSummary(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) SummaryDaily(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetDailyBreakdown(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) SummaryTopProducts(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetTopProducts(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) SummaryExport(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, filename, err := h.svc.ExportSummaryToExcel(r.Context(), claims.CompanyID, q)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) Stock(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetStockReport(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) StockMovements(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetStockMovementReport(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) Debtors(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetDebtorsReport(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) Creditors(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetCreditorsReport(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) PartnersBalance(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetPartnersBalanceReport(r.Context(), claims.CompanyID)
	h.writeResult(w, data, err)
}

func (h *Handler) B2BOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, err := h.svc.GetB2BOrdersReport(r.Context(), claims.CompanyID, q)
	h.writeResult(w, data, err)
}

func (h *Handler) AnalyticsOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	days := parseIntOrDefault(r.URL.Query().Get("days"), 30)
	data, err := h.svc.GetB2BOrdersAnalytics(r.Context(), claims.CompanyID, days)
	h.writeResult(w, data, err)
}

func (h *Handler) AnalyticsStock(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	days := parseIntOrDefault(r.URL.Query().Get("days"), 30)
	data, err := h.svc.GetStockMovementAnalytics(r.Context(), claims.CompanyID, days)
	h.writeResult(w, data, err)
}

func (h *Handler) ExportStock(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, filename, err := h.svc.ExportStockToExcel(r.Context(), claims.CompanyID, q)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) ExportStockPDF(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	data, filename, err := h.svc.ExportStockToPDF(r.Context(), claims.CompanyID, q)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) ExportProductsImportFormat(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	warehouseID := strings.TrimSpace(r.URL.Query().Get("warehouseId"))
	mode := strings.TrimSpace(r.URL.Query().Get("mode"))
	if mode == "" {
		mode = "with_stock"
	}
	data, filename, err := h.svc.ExportProductsForImportToExcel(r.Context(), claims.CompanyID, warehouseID, mode)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) ProductTemplate(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.GenerateProductImportTemplate(r.Context(), claims.CompanyID)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) PartnerBalancePDF(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	q := parseReportQuery(r)
	partnerCompanyID := chi.URLParam(r, "partnerCompanyId")
	data, filename, err := h.svc.GeneratePartnerBalancePDF(r.Context(), claims.CompanyID, partnerCompanyID, q)
	if err != nil {
		h.writeResult(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func parseReportQuery(r *http.Request) ReportQueryInput {
	q := r.URL.Query()
	return ReportQueryInput{
		DateFrom:         ptrTrimmed(q.Get("dateFrom")),
		DateTo:           ptrTrimmed(q.Get("dateTo")),
		PartnerCompanyID: ptrTrimmed(q.Get("partnerCompanyId")),
		WarehouseID:      ptrTrimmed(q.Get("warehouseId")),
		ProductVariantID: ptrTrimmed(q.Get("productVariantId")),
		Status:           ptrTrimmed(q.Get("status")),
		Limit:            parseIntOrDefault(q.Get("limit"), 0),
		Days:             parseIntOrDefault(q.Get("days"), 0),
	}
}

func (h *Handler) writeResult(w http.ResponseWriter, data any, err error) {
	if err == nil {
		httpx.JSON(w, http.StatusOK, data)
		return
	}
	switch {
	case errors.Is(err, scope.ErrNoWarehouseAssigned), errors.Is(err, scope.ErrWarehouseForbidden):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case strings.Contains(strings.ToLower(err.Error()), "ruxsat"),
		strings.Contains(strings.ToLower(err.Error()), "biriktirilmagan"):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case strings.Contains(strings.ToLower(err.Error()), "topilmadi"):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case strings.Contains(strings.ToLower(err.Error()), "noto'g'ri"),
		strings.Contains(strings.ToLower(err.Error()), "majburiy"),
		strings.Contains(strings.ToLower(err.Error()), "datefrom"),
		strings.Contains(strings.ToLower(err.Error()), "limit"):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, err.Error())
	}
}
