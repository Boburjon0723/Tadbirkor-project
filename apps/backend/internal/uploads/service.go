package uploads

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/config"
)

type Service struct {
	cfg config.Config
}

func NewService(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) IsEnabled() bool {
	return s.cfg.SupabaseURL != "" && s.cfg.SupabaseKey != ""
}

type UploadResult struct {
	URL      string `json:"url"`
	Path     string `json:"path"`
	Filename string `json:"filename"`
	Storage  string `json:"storage"`
}

func (s *Service) UploadImage(ctx context.Context, file multipart.File, header *multipart.FileHeader) (*UploadResult, error) {
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, file); err != nil {
		return nil, errors.New("faylni o'qib bo'lmadi")
	}

	if s.IsEnabled() {
		res, err := s.uploadToSupabase(ctx, buf.Bytes(), header.Filename, header.Header.Get("Content-Type"))
		if err == nil {
			return res, nil
		}
		log.Printf("Supabase upload xatoligi (lokalga o'tilmoqda): %v", err)
	}

	log.Println("Supabase Storage sozlanmagan yoki xatolik berdi; rasm lokal diskka yozilmoqda.")
	return s.uploadToLocal(buf.Bytes(), header.Filename)
}

func (s *Service) uploadToSupabase(ctx context.Context, data []byte, originalName, mimeType string) (*UploadResult, error) {
	url := strings.TrimRight(s.cfg.SupabaseURL, "/")
	bucket := s.cfg.SupabaseBucket

	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" || strings.ContainsAny(ext, "\\/") {
		ext = ".jpg"
	}

	filename := fmt.Sprintf("%d-%d%s", time.Now().UnixMilli(), time.Now().UnixNano()%1000000, ext)
	path := fmt.Sprintf("products/%s", filename)

	reqURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", url, bucket, path)
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.cfg.SupabaseKey)
	req.Header.Set("apikey", s.cfg.SupabaseKey)
	req.Header.Set("Content-Type", mimeType)
	req.Header.Set("cache-control", "31536000")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", url, bucket, path)

	return &UploadResult{
		URL:      publicURL,
		Path:     path,
		Filename: filename,
		Storage:  "supabase",
	}, nil
}

func (s *Service) uploadToLocal(data []byte, originalName string) (*UploadResult, error) {
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return nil, fmt.Errorf("papkalar yaratishda xatolik: %v", err)
	}

	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" || strings.ContainsAny(ext, "\\/") {
		ext = ".jpg"
	}

	filename := fmt.Sprintf("%d-%d%s", time.Now().UnixMilli(), time.Now().UnixNano()%1000000, ext)
	filePath := filepath.Join(uploadDir, filename)

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return nil, fmt.Errorf("faylni saqlashda xatolik: %v", err)
	}

	urlPath := "/uploads/" + filename
	fullURL := urlPath
	if s.cfg.PublicBaseURL != "" {
		fullURL = strings.TrimRight(s.cfg.PublicBaseURL, "/") + urlPath
	}

	return &UploadResult{
		URL:      fullURL,
		Path:     urlPath,
		Filename: filename,
		Storage:  "local",
	}, nil
}

func (s *Service) DeleteFile(ctx context.Context, path string) error {
	if !s.IsEnabled() || path == "" {
		return nil
	}
	url := strings.TrimRight(s.cfg.SupabaseURL, "/")
	bucket := s.cfg.SupabaseBucket

	reqURL := fmt.Sprintf("%s/storage/v1/object/%s", url, bucket)
	body := map[string][]string{"prefixes": {path}}
	b, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "DELETE", reqURL, bytes.NewReader(b))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+s.cfg.SupabaseKey)
	req.Header.Set("apikey", s.cfg.SupabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("failed to delete file: HTTP %d", resp.StatusCode)
	}
	return nil
}
