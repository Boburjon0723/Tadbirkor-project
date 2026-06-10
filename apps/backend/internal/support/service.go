package support

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tadbirkor/axis-erp/backend/internal/config"
)

type Service struct {
	repo *Repository
	cfg  config.Config
}

func NewService(repo *Repository, cfg config.Config) *Service {
	return &Service{
		repo: repo,
		cfg:  cfg,
	}
}

func (s *Service) normalizeUsername(raw string) *string {
	val := strings.TrimSpace(raw)
	val = strings.TrimPrefix(val, "@")
	if val == "" {
		return nil
	}
	return &val
}

func (s *Service) GetPublicConfig() PublicConfig {
	var telegramUsername *string
	
	if s.cfg.SupportTelegramUsername != "" {
		telegramUsername = s.normalizeUsername(s.cfg.SupportTelegramUsername)
	} else if s.cfg.TelegramBotUsername != "" {
		telegramUsername = s.normalizeUsername(s.cfg.TelegramBotUsername)
	}

	var telegramUrl *string
	if telegramUsername != nil {
		url := "https://t.me/" + *telegramUsername
		telegramUrl = &url
	}

	email := "support@tadbirkor.uz"
	if s.cfg.SupportEmail != "" {
		email = s.cfg.SupportEmail
	}

	var phone *string
	if s.cfg.SupportPhone != "" {
		p := s.cfg.SupportPhone
		phone = &p
	}

	hours := "Dush–Juma, 09:00–18:00"
	if s.cfg.SupportHours != "" {
		hours = s.cfg.SupportHours
	}

	chatEnabled := telegramUsername != nil || s.cfg.SupportTelegramChatID != ""

	return PublicConfig{
		TelegramUsername: telegramUsername,
		TelegramUrl:      telegramUrl,
		Email:            email,
		Phone:            phone,
		Hours:            hours,
		ChatEnabled:      chatEnabled,
	}
}

func (s *Service) GetContext(ctx context.Context, companyID, userID string) (*ContextResponse, error) {
	user, _ := s.repo.FindUserBrief(ctx, userID)
	company, _ := s.repo.FindCompanyBrief(ctx, companyID)

	return &ContextResponse{
		Config:  s.GetPublicConfig(),
		User:    user,
		Company: company,
	}, nil
}

func (s *Service) SubmitMessage(ctx context.Context, companyID, userID string, input SubmitSupportMessageInput) (*SubmitResponse, error) {
	supportCtx, err := s.GetContext(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}

	topic := strings.TrimSpace(input.Topic)
	if topic == "" {
		topic = "Umumiy savol"
	}
	body := strings.TrimSpace(input.Message)

	companyName := companyID
	if supportCtx.Company != nil {
		companyName = supportCtx.Company.Name
	}

	userFullName := userID
	if supportCtx.User != nil {
		userFullName = supportCtx.User.FullName
	}

	lines := []string{
		"💬 Tadbirkor — Support chat",
		"",
		"Kompaniya: " + companyName,
		"Foydalanuvchi: " + userFullName,
	}

	if supportCtx.User != nil && supportCtx.User.Email != nil {
		lines = append(lines, "Email: "+*supportCtx.User.Email)
	}
	if supportCtx.User != nil && supportCtx.User.Phone != nil {
		lines = append(lines, "Tel: "+*supportCtx.User.Phone)
	}
	
	lines = append(lines, "Mavzu: "+topic, "", body)
	fullMessage := strings.Join(lines, "\n")

	delivered := s.sendTelegramMessage(fullMessage)

	preview := body
	if len(preview) > 200 {
		preview = preview[:200]
	}

	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		ID:         uuid.NewString(),
		CompanyID:  companyID,
		UserID:     userID,
		Action:     "support.message_sent",
		EntityType: "SUPPORT",
		EntityID:   strconv.FormatInt(time.Now().UnixMilli(), 10),
		NewData: map[string]any{
			"topic":               topic,
			"deliveredToTelegram": delivered,
			"preview":             preview,
		},
	})

	msg := "Xabaringiz saqlandi. Telegram orqali ham yozishingiz mumkin."
	if delivered {
		msg = "Xabaringiz qabul qilindi. Tez orada javob beramiz."
	}

	return &SubmitResponse{
		Ok:                  true,
		DeliveredToTelegram: delivered,
		TelegramUrl:         supportCtx.Config.TelegramUrl,
		Message:             msg,
	}, nil
}

func (s *Service) SubmitPublicMessage(ctx context.Context, input SubmitPublicSupportMessageInput) (*SubmitResponse, error) {
	topic := strings.TrimSpace(input.Topic)
	if topic == "" {
		topic = "Mehmon savoli"
	}
	body := strings.TrimSpace(input.Message)
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "Mehmon"
	}
	contact := strings.TrimSpace(input.Contact)

	lines := []string{
		"💬 Tadbirkor — Support chat (MEHMON)",
		"",
		"Foydalanuvchi: " + name,
		"Aloqa: " + contact,
		"Mavzu: " + topic,
		"",
		body,
	}
	fullMessage := strings.Join(lines, "\n")

	delivered := s.sendTelegramMessage(fullMessage)

	msg := "Tizimda xatolik yuz berdi. Telegram orqali ham yozishingiz mumkin."
	if delivered {
		msg = "Xabaringiz qabul qilindi. Tez orada javob beramiz."
	}

	return &SubmitResponse{
		Ok:                  true,
		DeliveredToTelegram: delivered,
		Message:             msg,
	}, nil
}

func (s *Service) sendTelegramMessage(text string) bool {
	if s.cfg.SupportTelegramChatID == "" || s.cfg.TelegramBotToken == "" {
		return false
	}

	url := "https://api.telegram.org/bot" + s.cfg.TelegramBotToken + "/sendMessage"
	payload := map[string]string{
		"chat_id": s.cfg.SupportTelegramChatID,
		"text":    text,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return false
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
