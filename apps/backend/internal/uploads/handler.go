package uploads

import (
	"net/http"
	"strings"

	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{
		"supabaseEnabled": h.svc.IsEnabled(),
	})
}

func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Fayl hajmi 5MB dan oshmasligi kerak")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Fayl yuklanmadi")
		return
	}
	defer file.Close()

	ext := strings.ToLower(header.Filename)
	if !strings.HasSuffix(ext, ".jpg") && !strings.HasSuffix(ext, ".jpeg") &&
		!strings.HasSuffix(ext, ".png") && !strings.HasSuffix(ext, ".gif") &&
		!strings.HasSuffix(ext, ".webp") {
		httpx.Error(w, http.StatusBadRequest, "Faqat rasm fayllari (jpg, png, gif, webp) ruxsat etilgan!")
		return
	}

	res, err := h.svc.UploadImage(r.Context(), file, header)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, res)
}
