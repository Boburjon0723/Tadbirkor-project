package storefront

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/variants"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

type Handler struct {
	variants *variants.Service
}

func NewHandler(variantsSvc *variants.Service) *Handler {
	return &Handler{variants: variantsSvc}
}

func (h *Handler) GetProducts(w http.ResponseWriter, r *http.Request) {
	companyID := chi.URLParam(r, "companyId")
	token := r.Header.Get("x-storefront-token")
	search := r.URL.Query().Get("search")
	data, err := h.variants.GetWebsiteCatalog(r.Context(), companyID, token, search)
	if err != nil {
		if errors.Is(err, variants.ErrUnauthorized) {
			httpx.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
		if err != nil && err.Error() == "Storefront ochilmagan" {
			httpx.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
		if errors.Is(err, variants.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}
