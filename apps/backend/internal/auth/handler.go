package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/config"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

type Handler struct {
	svc    *Service
	cfg    config.Config
}

func NewHandler(svc *Service, cfg config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var input LoginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri JSON")
		return
	}
	if input.Login == "" || input.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "Login va parol majburiy")
		return
	}
	result, err := h.svc.Login(r.Context(), input)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials), errors.Is(err, ErrNoPassword):
			httpx.Error(w, http.StatusUnauthorized, err.Error())
		case errors.Is(err, ErrNoMembership):
			httpx.Error(w, http.StatusUnauthorized, err.Error())
		default:
			httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		}
		return
	}
	h.setAuthCookie(w, result.AccessToken)
	httpx.JSON(w, http.StatusOK, result)
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var input RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri JSON")
		return
	}
	result, err := h.svc.Register(r.Context(), input)
	if err != nil {
		switch {
		case errors.Is(err, ErrRegistrationDisabled):
			httpx.Error(w, http.StatusForbidden, err.Error())
		case errors.Is(err, ErrLoginTaken), errors.Is(err, ErrEmailTaken), errors.Is(err, ErrPhoneInvalid), errors.Is(err, ErrPhoneTaken):
			httpx.Error(w, http.StatusBadRequest, err.Error())
		default:
			httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		}
		return
	}
	h.setAuthCookie(w, result.AccessToken)
	httpx.JSON(w, http.StatusCreated, result)
}

func (h *Handler) PasswordResetTelegramLink(w http.ResponseWriter, r *http.Request) {
	var input PasswordResetLinkInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri JSON")
		return
	}
	result, err := h.svc.CreatePasswordResetTelegramLink(r.Context(), input)
	if err != nil {
		if errors.Is(err, ErrTelegramNotConfigured) {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	h.clearAuthCookie(w)
	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Invite(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in InviteInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.InviteUser(r.Context(), claims.CompanyID, in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, data)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	me, err := h.svc.GetMe(r.Context(), claims.Sub, claims.CompanyID)
	if err != nil {
		if errors.Is(err, ErrCompanyNotFound) {
			httpx.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, me)
}

func (h *Handler) setAuthCookie(w http.ResponseWriter, token string) {
	secure := h.cfg.IsProduction || false
	sameSite := http.SameSiteLaxMode
	if h.cfg.IsProduction {
		sameSite = http.SameSiteNoneMode
		secure = true
	}
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.AuthCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   7 * 24 * 60 * 60,
	})
}

func (h *Handler) clearAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.AuthCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}
