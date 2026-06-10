package partnerledger

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

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func claims(r *http.Request) (*middleware.JWTClaims, bool) {
	return middleware.ClaimsFromContext(r.Context())
}

func (h *Handler) write(w http.ResponseWriter, err error, data any, status int) {
	if err == nil {
		httpx.JSON(w, status, data)
		return
	}
	switch {
	case errors.Is(err, ErrContactNotFound), errors.Is(err, ErrOperationNotFound), errors.Is(err, ErrSaleOrderNotFound), errors.Is(err, ErrWarehouseNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	default:
		var br badRequestError
		if errors.As(err, &br) {
			httpx.Error(w, http.StatusBadRequest, br.Error())
			return
		}
		if errors.Is(err, ErrTelegramNotLinked) {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		httpx.Error(w, http.StatusBadRequest, err.Error())
	}
}

func (h *Handler) writeExcel(w http.ResponseWriter, err error, data []byte, filename string) {
	if err != nil {
		h.write(w, err, nil, 0)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func ptrQuery(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (h *Handler) SaleOrderTemplate(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	warehouseID := httpx.Query(r, "warehouseId")
	contactName := ptrQuery(httpx.Query(r, "contactName"))
	data, filename, err := h.svc.SaleOrderTemplate(r.Context(), c.CompanyID, warehouseID, contactName)
	h.writeExcel(w, err, data, filename)
}

func (h *Handler) PreviewSaleOrderExcel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
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
	data, err := h.svc.PreviewSaleOrderExcel(r.Context(), c.CompanyID, httpx.Query(r, "warehouseId"), buf)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportSaleOrderExcel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportSaleOrderExcel(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"), chi.URLParam(r, "batchId"))
	h.writeExcel(w, err, data, filename)
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetGlobalSummary(r.Context(), c.CompanyID)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ListContactsForSelect(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.ListContactsForSelect(r.Context(), c.CompanyID, ptrQuery(httpx.Query(r, "search")))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ListContacts(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.ListContacts(r.Context(), c.CompanyID, ptrQuery(httpx.Query(r, "search")))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreatePartnerLedgerContactInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.CreateContact(r.Context(), c.CompanyID, input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) GetContact(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetContact(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input UpdatePartnerLedgerContactInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateContact(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"), input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) DeleteContact(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.DeleteContact(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "contactId"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportOperationsExcel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportOperationsExcel(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"))
	h.writeExcel(w, err, data, filename)
}

func (h *Handler) ListOperations(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.ListOperations(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"),
		ptrQuery(httpx.Query(r, "page")), ptrQuery(httpx.Query(r, "limit")))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) BalanceHistory(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	days := 7
	if raw := httpx.Query(r, "days"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			days = v
		}
	}
	data, err := h.svc.GetBalanceHistory(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"), days)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) SaleCatalog(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetSaleCatalog(r.Context(), c.CompanyID, httpx.Query(r, "warehouseId"),
		ptrQuery(httpx.Query(r, "search")), ptrQuery(httpx.Query(r, "page")), ptrQuery(httpx.Query(r, "limit")))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) GetSaleOrderLines(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetSaleOrderLines(r.Context(), c.CompanyID, chi.URLParam(r, "contactId"), chi.URLParam(r, "batchId"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) CreateSaleOrder(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreatePartnerLedgerSaleOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.CreateSaleOrder(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "contactId"), input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) SendSaleOrderToPartner(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.SendSaleOrderToPartner(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "contactId"), chi.URLParam(r, "batchId"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) CreateOperation(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreatePartnerLedgerOperationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.CreateOperation(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "contactId"), input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) GetOperationLines(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetOperationLines(r.Context(), c.CompanyID, chi.URLParam(r, "operationId"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportOperationExcel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, filename, err := h.svc.ExportOperationExcel(r.Context(), c.CompanyID, chi.URLParam(r, "operationId"))
	h.writeExcel(w, err, data, filename)
}

func (h *Handler) UpdateOperation(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input UpdatePartnerLedgerOperationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateOperation(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "operationId"), input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) DeleteOperation(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.DeleteOperation(r.Context(), c.CompanyID, c.Sub, chi.URLParam(r, "operationId"))
	h.write(w, err, data, http.StatusOK)
}
