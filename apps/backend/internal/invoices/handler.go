package invoices

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/b2borders"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	orders *b2borders.Service
}

func NewHandler(orders *b2borders.Service) *Handler {
	return &Handler{orders: orders}
}

func (h *Handler) DownloadPDF(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	id := chi.URLParam(r, "id")
	order, err := h.orders.FindOne(r.Context(), id, claims.CompanyID)
	if err != nil {
		if errors.Is(err, b2borders.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "Invoice topilmadi")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	itemsRaw, _ := order["items"].([]map[string]any)
	pdfItems := make([]pdfItem, 0, len(itemsRaw))
	total := 0.0
	currency := "UZS"
	for i, item := range itemsRaw {
		qty := toFloat(item["quantity"])
		price := toFloat(item["expectedPrice"])
		lineTotal := qty * price
		total += lineTotal
		if i == 0 {
			if c, ok := item["expectedCurrency"].(string); ok && c != "" {
				currency = c
			}
		}
		name := fmt.Sprintf("%v", item["productNameSnapshot"])
		variant := ""
		if v, ok := item["variantNameSnapshot"].(string); ok {
			variant = v
		}
		category := "Boshqa"
		if c, ok := item["categoryNameSnapshot"].(string); ok && strings.TrimSpace(c) != "" {
			category = strings.TrimSpace(c)
		}
		pdfItems = append(pdfItems, pdfItem{
			ProductName: name, VariantName: variant, CategoryName: category,
			Quantity: qty, Price: price, Total: lineTotal,
		})
	}

	createdAt := time.Now().UTC()
	if t, ok := order["createdAt"].(time.Time); ok {
		createdAt = t
	}
	year := createdAt.Year()
	shortID := strings.ToUpper(id)
	if len(shortID) > 4 {
		shortID = shortID[:4]
	}
	invoiceNumber := fmt.Sprintf("INV-%d-%s", year, shortID)

	seller := mapParty(order["seller"])
	buyer := mapParty(order["buyer"])
	if buyer.Phone == "" {
		buyer.Phone = "---"
	}

	buf, err := generateInvoicePDF(invoiceNumber, createdAt, fmt.Sprintf("%v", order["status"]), seller, buyer, currency, pdfItems, total)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=invoice-%s.pdf", invoiceNumber))
	_, _ = w.Write(buf)
}

func mapParty(v any) pdfParty {
	m, _ := v.(map[string]any)
	if m == nil {
		return pdfParty{}
	}
	return pdfParty{
		Name:    fmt.Sprintf("%v", m["name"]),
		TIN:     strVal(m["tin"]),
		Phone:   strVal(m["phone"]),
		Address: strVal(m["address"]),
	}
}

func strVal(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func toFloat(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}
