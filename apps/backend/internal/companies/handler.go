package companies

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

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

func (h *Handler) Features(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	companyID, err := h.svc.ResolveCompanyID(r.Context(), claims.Sub, claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	cfg, err := h.svc.GetFeatureConfig(r.Context(), companyID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, cfg)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.FindOne(r.Context(), claims.CompanyID)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpdateCompanyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.Update(r.Context(), claims.CompanyID, in)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, ErrTinTaken) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) PosSettings(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	settings, err := h.svc.GetPosSettings(r.Context(), claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, settings)
}

func (h *Handler) PosReceiptSettings(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetPosReceiptSettings(r.Context(), claims.CompanyID)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpdatePosReceiptSettings(w http.ResponseWriter, r *http.Request) {
	if !intakeSettingsWriteAllowed(r) {
		httpx.Error(w, http.StatusForbidden, "Ombor kirimi sozlamalarini faqat boshqaruvchi tahrirlashi mumkin")
		return
	}
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var patch map[string]any
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdatePosReceiptSettings(r.Context(), claims.CompanyID, patch)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) IntakeSettings(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetIntakeSettings(r.Context(), claims.CompanyID, httpx.Query(r, "warehouseId"), claims.Sub)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, scope.ErrWarehouseForbidden) {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return
	}
	if err != nil && err.Error() == "Ombor topilmadi" {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpdateIntakeSettings(w http.ResponseWriter, r *http.Request) {
	if !intakeSettingsWriteAllowed(r) {
		httpx.Error(w, http.StatusForbidden, "Ombor kirimi sozlamalarini faqat boshqaruvchi tahrirlashi mumkin")
		return
	}
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var patch map[string]any
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateIntakeSettings(r.Context(), claims.CompanyID, patch)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) InitModules(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.InitModules(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpdateFeatures(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpdateFeatureInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateFeatureConfig(r.Context(), claims.CompanyID, in)
	if errors.Is(err, ErrFeatureNotFound) || errors.Is(err, ErrModuleNotFound) || errors.Is(err, ErrBundleNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, ErrFeatureKeyRequired) || errors.Is(err, ErrModuleNoFeatures) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpdateWarehouseBundle(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in struct {
		BundleID string `json:"bundleId"`
		Enabled  bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpdateWarehouseBundle(r.Context(), claims.CompanyID, strings.TrimSpace(in.BundleID), in.Enabled)
	if errors.Is(err, ErrBundleNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) RegenerateStorefrontToken(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.RegenerateStorefrontToken(r.Context(), claims.CompanyID)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) InitTelegramLink(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.InitTelegramLink(r.Context(), claims.CompanyID, claims.Sub)
	if errors.Is(err, ErrCompanyNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) GetTelegramBindings(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	data, err := h.svc.GetTelegramBindings(r.Context(), claims.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) UpsertTelegramBinding(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in UpsertTelegramBindingInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.UpsertTelegramBinding(r.Context(), claims.CompanyID, in)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func (h *Handler) RemoveTelegramBinding(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Token topilmadi")
		return
	}
	var in RemoveTelegramBindingInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Noto'g'ri so'rov")
		return
	}
	data, err := h.svc.RemoveTelegramBinding(r.Context(), claims.CompanyID, in)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Server xatosi")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

func intakeSettingsWriteAllowed(r *http.Request) bool {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		return false
	}
	role := strings.ToUpper(claims.Role)
	return role == "OWNER" || role == "MANAGER"
}
