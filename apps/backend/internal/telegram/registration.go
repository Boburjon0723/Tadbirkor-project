package telegram

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/auth"
)

type registrationStep string

const (
	regAwaitPhone   registrationStep = "await_phone"
	regSessionTTL                    = 15 * time.Minute
)

type registrationBotSession struct {
	step        registrationStep
	sessionCode string
	phoneHint   string
	expiresAt   time.Time
}

type registrationState struct {
	mu       sync.Mutex
	sessions map[string]*registrationBotSession
}

func newRegistrationState() *registrationState {
	return &registrationState{sessions: map[string]*registrationBotSession{}}
}

func (p *registrationState) getSession(chatID string) *registrationBotSession {
	p.mu.Lock()
	defer p.mu.Unlock()
	s := p.sessions[chatID]
	if s == nil || time.Now().After(s.expiresAt) {
		delete(p.sessions, chatID)
		return nil
	}
	return s
}

func (p *registrationState) startFlow(chatID, sessionCode, phoneHint string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sessions[chatID] = &registrationBotSession{
		step:        regAwaitPhone,
		sessionCode: sessionCode,
		phoneHint:   strings.TrimSpace(phoneHint),
		expiresAt:   time.Now().Add(regSessionTTL),
	}
}

func (p *registrationState) cancelFlow(chatID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	_, ok := p.sessions[chatID]
	delete(p.sessions, chatID)
	return ok
}

func (p *registrationState) isAwaitingPhone(chatID string) bool {
	s := p.getSession(chatID)
	return s != nil && s.step == regAwaitPhone
}

func (s *Service) promptRegistration(ctx context.Context, chatID, sessionCode, phoneHint string) {
	s.reg.startFlow(chatID, sessionCode, phoneHint)
	lines := []string{
		"📝 Ro'yxatdan o'tish",
		"",
		"Telefon raqamingizni ulashing — ilovada kiritilgan raqam bilan mos kelishi kerak.",
		"Tasdiqlash kodi shu chatga yuboriladi.",
		"/bekor — bekor qilish",
	}
	if phoneHint != "" {
		lines = append(lines, "", "Kutilayotgan raqam: "+phoneHint)
	}
	_ = s.tg.sendMessage(ctx, chatID, strings.Join(lines, "\n"), contactOnlyKeyboard())
}

func (s *Service) handleRegistrationContact(ctx context.Context, chatID, phone string) bool {
	if !s.reg.isAwaitingPhone(chatID) {
		return false
	}
	session := s.reg.getSession(chatID)
	if session == nil || s.cache == nil {
		return false
	}

	otp, err := auth.DeliverRegistrationOTP(ctx, s.cache, session.sessionCode, phone)
	if err != nil {
		_ = s.tg.sendMessage(ctx, chatID, err.Error(), contactOnlyKeyboard())
		return true
	}

	s.reg.cancelFlow(chatID)
	_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
		"✅ Telefon tasdiqlandi!",
		"",
		"🔐 Sizning tasdiqlash kodingiz:",
		"",
		"    " + otp,
		"",
		"Bu kodni mobil ilovaga kiriting (15 daqiqa amal qiladi).",
		"Kodni hech kimga bermang.",
	}, "\n"), removeKeyboard())
	return true
}
