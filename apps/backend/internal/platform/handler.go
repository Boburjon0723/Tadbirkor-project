package platform

import (
	"encoding/json"
	"errors"
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

func (h *Handler) write(w http.ResponseWriter, err error, data any) {
	if err == nil {
		httpx.JSON(w, http.StatusOK, data)
		return
	}
	switch {
	case errors.Is(err, ErrCompanyNotFound):
		httpx.Error(w, http.StatusNotFound, err.Error())
	default:
		var fe forbiddenError
		if errors.As(err, &fe) {
			httpx.Error(w, http.StatusForbidden, fe.Error())
			return
		}
		httpx.Error(w, http.StatusBadRequest, err.Error())
	}
}

func (h *Handler) VerifyPin(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	email, login, err := h.svc.repo.GetUserEmailLogin(r.Context(), c.Sub)
	if err != nil || !middleware.IsPlatformAdminUser(email, login) {
		httpx.Error(w, http.StatusForbidden, "Platforma administratori emas")
		return
	}
	if !middleware.PlatformAdminPinRequired() {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "pinRequired": false})
		return
	}
	var body struct {
		Pin string `json:"pin"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if !middleware.VerifyPlatformAdminPin(body.Pin) {
		httpx.JSON(w, http.StatusForbidden, map[string]any{
			"message": "Admin paroli noto'g'ri",
			"code":    "PLATFORM_ADMIN_PIN_INVALID",
		})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "pinRequired": true})
}

func (h *Handler) AccessInfo(w http.ResponseWriter, r *http.Request) {
	c, ok := claims(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	email, login, err := h.svc.repo.GetUserEmailLogin(r.Context(), c.Sub)
	isAdmin := err == nil && middleware.IsPlatformAdminUser(email, login)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"isPlatformAdmin": isAdmin,
		"pinRequired":     isAdmin && middleware.PlatformAdminPinRequired(),
	})
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetStats(r.Context())
	h.write(w, err, data)
}

func (h *Handler) RedisHealth(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.RedisHealth(r.Context())
	h.write(w, err, data)
}

func (h *Handler) ListCompanies(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(httpx.Query(r, "page"))
	limit, _ := strconv.Atoi(httpx.Query(r, "limit"))
	data, err := h.svc.ListCompanies(r.Context(), httpx.Query(r, "search"), page, limit)
	h.write(w, err, data)
}

func (h *Handler) UpdateCompany(w http.ResponseWriter, r *http.Request) {
	var input UpdateCompanySubscriptionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateCompanySubscription(r.Context(), chi.URLParam(r, "companyId"), input)
	h.write(w, err, data)
}

func (h *Handler) Broadcast(w http.ResponseWriter, r *http.Request) {
	var input BroadcastNotificationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.BroadcastToUsers(r.Context(), input)
	h.write(w, err, data)
}
