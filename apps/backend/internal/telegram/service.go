package telegram

import (
	"context"
	"crypto/subtle"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/tadbirkor/axis-erp/backend/internal/config"
	"github.com/tadbirkor/axis-erp/backend/internal/field"
	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

type Service struct {
	repo   *Repository
	cfg    config.Config
	cache  *cache.Cache
	tg     *tgClient
	botCtx *botContext
	reset  *passwordResetState
	reg    *registrationState
	actions *actionDeps
	leaveBot *leaveBot
	payrollBot *payrollBot

	pendingMu             sync.Mutex
	pendingPartnerComment map[string]partnerOrderComment
}

func NewService(repo *Repository, cfg config.Config, c *cache.Cache) *Service {
	s := &Service{
		repo:                  repo,
		cfg:                   cfg,
		cache:                 c,
		botCtx:                newBotContext(),
		reset:                 newPasswordResetState(),
		reg:                   newRegistrationState(),
		pendingPartnerComment: map[string]partnerOrderComment{},
	}
	if token := strings.TrimSpace(cfg.TelegramBotToken); token != "" {
		s.tg = newTGClient(token)
	}
	return s
}

// BindBots — payroll/field servislarini ulash (main.go dan chaqiriladi).
func (s *Service) BindBots(leaveSvc *payroll.LeaveService, dataSvc *payroll.DataService, fieldSvc *field.Service) {
	s.setActionDeps(fieldSvc, leaveSvc)
	s.leaveBot = newLeaveBot(s, leaveSvc)
	s.payrollBot = newPayrollBot(s, leaveSvc, dataSvc)
}

func (s *Service) validateWebhookSecret(secretFromHeader string) error {
	secret := strings.TrimSpace(s.cfg.TelegramWebhookSecret)
	if s.cfg.IsProduction && secret == "" {
		return ErrInvalidWebhookSecret
	}
	if secret != "" && subtle.ConstantTimeCompare([]byte(secretFromHeader), []byte(secret)) != 1 {
		return ErrInvalidWebhookSecret
	}
	return nil
}

// HandleWebhookUpdate — barcha Telegram update'lar Go'da qayta ishlanadi.
func (s *Service) HandleWebhookUpdate(ctx context.Context, secretFromHeader string, r *http.Request) error {
	if err := s.validateWebhookSecret(secretFromHeader); err != nil {
		return err
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	if s.tg == nil {
		log.Printf("telegram: TELEGRAM_BOT_TOKEN yo'q, update e'tiborsiz qoldirildi")
		return nil
	}
	s.processUpdateLocally(ctx, body)
	return nil
}
