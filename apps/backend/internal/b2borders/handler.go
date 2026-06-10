package b2borders

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
	claims, ok := middleware.ClaimsFromContext(r.Context())
	return claims, ok
}

func queryMap(r *http.Request, keys ...string) map[string]string {
	out := make(map[string]string, len(keys))
	for _, key := range keys {
		out[key] = httpx.Query(r, key)
	}
	return out
}

func (h *Handler) write(w http.ResponseWriter, err error, data any, status int) {
	if err == nil {
		httpx.JSON(w, status, data)
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
		httpx.Error(w, http.StatusBadRequest, err.Error())
	}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.CreateOrder(r.Context(), c.CompanyID, c.Sub, input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) HubStats(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetOrdersHubStats(r.Context(), c.CompanyID)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) BuyerStats(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetListStats(r.Context(), c.CompanyID, "BUYER")
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) IncomingStats(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetListStats(r.Context(), c.CompanyID, "SELLER")
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) FindAllBuyer(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindAll(r.Context(), c.CompanyID, "BUYER", queryMap(r, "search", "status", "page", "limit", "all", "full"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) FindAllIncoming(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindAll(r.Context(), c.CompanyID, "SELLER", queryMap(r, "search", "status", "page", "limit", "all", "full"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) SellerCatalog(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetSellerCatalogForBuyer(
		r.Context(),
		c.CompanyID,
		httpx.Query(r, "sellerCompanyId"),
		httpx.Query(r, "search"),
	)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) PricingSuggestion(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetSellerPriceSuggestion(
		r.Context(),
		c.CompanyID,
		httpx.Query(r, "sellerCompanyId"),
		httpx.Query(r, "productName"),
	)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	content, filename, err := h.svc.ExportOrderToExcel(r.Context(), chi.URLParam(r, "id"), c.CompanyID)
	if err != nil {
		h.write(w, err, nil, http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

func (h *Handler) FindOrderItems(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOrderItemsPage(r.Context(), chi.URLParam(r, "id"), c.CompanyID, queryMap(r, "page", "limit", "search", "unmappedOnly"))
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) FindOne(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), chi.URLParam(r, "id"), c.CompanyID)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.SendOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) UpdateDraft(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input UpdateDraftOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateDraftOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, input)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.CancelOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) CloseRemainder(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.CloseUndispatchedRemainder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.DeleteOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) AcceptIncoming(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var body AcceptOrderInput
	_ = json.NewDecoder(r.Body).Decode(&body)
	data, err := h.svc.AcceptOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub, body)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) RejectIncoming(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.RejectOrder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) CloseIncomingRemainder(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.CloseUndispatchedRemainder(r.Context(), chi.URLParam(r, "id"), c.CompanyID, c.Sub)
	h.write(w, err, data, http.StatusOK)
}

func (h *Handler) MapIncomingItem(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var input MapIncomingOrderItemInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.MapIncomingOrderItem(
		r.Context(),
		chi.URLParam(r, "id"),
		chi.URLParam(r, "itemId"),
		c.CompanyID,
		c.Sub,
		input,
	)
	h.write(w, err, data, http.StatusOK)
}
