package telegram

import (
	"context"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type resetStep string

const (
	resetAwaitPhone    resetStep = "await_phone"
	resetAwaitPassword resetStep = "await_password"
	resetAwaitConfirm  resetStep = "await_confirm"
	resetSessionTTL    = 15 * time.Minute
	minPasswordLen     = 6
	maxResetsPerHour   = 5
)

type resetSession struct {
	step            resetStep
	userID          string
	login           string
	fullName        string
	loginHint       string
	pendingPassword string
	expiresAt       time.Time
}

type passwordResetState struct {
	mu         sync.Mutex
	sessions   map[string]*resetSession
	rateLimits map[string]rateLimitEntry
}

type rateLimitEntry struct {
	count       int
	windowStart time.Time
}

func newPasswordResetState() *passwordResetState {
	return &passwordResetState{
		sessions:   map[string]*resetSession{},
		rateLimits: map[string]rateLimitEntry{},
	}
}

func (p *passwordResetState) getSession(chatID string) *resetSession {
	p.mu.Lock()
	defer p.mu.Unlock()
	s := p.sessions[chatID]
	if s == nil || time.Now().After(s.expiresAt) {
		delete(p.sessions, chatID)
		return nil
	}
	return s
}

func (p *passwordResetState) startFlow(chatID string, loginHint string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	hint := strings.TrimSpace(loginHint)
	s := &resetSession{step: resetAwaitPhone, expiresAt: time.Now().Add(resetSessionTTL)}
	if hint != "" {
		s.loginHint = hint
	}
	p.sessions[chatID] = s
}

func (p *passwordResetState) cancelFlow(chatID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	_, ok := p.sessions[chatID]
	delete(p.sessions, chatID)
	return ok
}

func (p *passwordResetState) isInFlow(chatID string) bool {
	return p.getSession(chatID) != nil
}

func (p *passwordResetState) isAwaitingPhone(chatID string) bool {
	s := p.getSession(chatID)
	return s != nil && s.step == resetAwaitPhone
}

func (s *Service) promptPasswordReset(ctx context.Context, chatID string, loginHint string) {
	s.reset.startFlow(chatID, loginHint)
	lines := []string{
		"🔑 Parolni tiklash",
		"",
		"Telefon raqamingizni ulashing — tizimdagi profil bilan mos kelishi kerak.",
		"/bekor — bekor qilish",
	}
	if loginHint != "" {
		lines = append(lines, "", "Login: "+loginHint)
	}
	_ = s.tg.sendMessage(ctx, chatID, strings.Join(lines, "\n"), contactOnlyKeyboard())
}

func (s *Service) handlePasswordResetContact(ctx context.Context, chatID, phone string) bool {
	if !s.reset.isAwaitingPhone(chatID) {
		return false
	}
	session := s.reset.getSession(chatID)
	if session == nil {
		return false
	}
	userID, login, fullName, hash, err := s.repo.findUserByPhone(ctx, phone)
	if err != nil {
		_ = s.tg.sendMessage(ctx, chatID, err.Error(), contactOnlyKeyboard())
		return true
	}
	if hash == nil || strings.TrimSpace(*hash) == "" {
		_ = s.tg.sendMessage(ctx, chatID,
			"Hisobda parol sozlanmagan. Administrator bilan bog'laning.", contactOnlyKeyboard())
		return true
	}
	if session.loginHint != "" && login != session.loginHint {
		_ = s.tg.sendMessage(ctx, chatID,
			"Bu telefon «"+login+"» akkauntiga tegishli. Vebda kiritilgan loginni tekshiring.",
			contactOnlyKeyboard())
		return true
	}
	if err := s.reset.assertRateLimit(userID); err != nil {
		_ = s.tg.sendMessage(ctx, chatID, err.Error(), contactOnlyKeyboard())
		return true
	}
	s.reset.mu.Lock()
	session.userID = userID
	session.login = login
	session.fullName = fullName
	session.step = resetAwaitPassword
	session.expiresAt = time.Now().Add(resetSessionTTL)
	s.reset.mu.Unlock()
	_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
		"✅ Tasdiqlandi: " + fullName,
		"Login: " + login,
		"",
		"Endi yangi parolni yozing (kamida 6 belgi).",
		"Keyin tasdiqlash uchun bir marta yana yuboring.",
		"/bekor — bekor qilish",
	}, "\n"), removeKeyboard())
	return true
}

func (s *Service) handlePasswordResetText(ctx context.Context, chatID, text string) bool {
	session := s.reset.getSession(chatID)
	if session == nil {
		return false
	}
	normalized := strings.TrimSpace(text)
	if normalized == "" {
		_ = s.tg.sendMessage(ctx, chatID, "Matn bo'sh. Qayta yuboring yoki /bekor bosing.", nil)
		return true
	}
	if strings.EqualFold(normalized, "bekor") || normalized == "/bekor" {
		s.reset.cancelFlow(chatID)
		_ = s.tg.sendMessage(ctx, chatID, "Parol tiklash bekor qilindi. Kerak bo'lsa /parol buyrug'ini yuboring.", nil)
		return true
	}
	switch session.step {
	case resetAwaitPassword:
		if len(normalized) < minPasswordLen {
			_ = s.tg.sendMessage(ctx, chatID,
				"Parol kamida 6 belgidan iborat bo'lishi kerak. Qayta yozing.", nil)
			return true
		}
		s.reset.mu.Lock()
		session.pendingPassword = normalized
		session.step = resetAwaitConfirm
		session.expiresAt = time.Now().Add(resetSessionTTL)
		s.reset.mu.Unlock()
		_ = s.tg.sendMessage(ctx, chatID, "Parolni tasdiqlang — bir xil parolni yana bir marta yuboring.", nil)
		return true
	case resetAwaitConfirm:
		if session.pendingPassword == "" || session.userID == "" {
			s.reset.cancelFlow(chatID)
			_ = s.tg.sendMessage(ctx, chatID, "Sessiya tugadi. /parol bilan qaytadan boshlang.", nil)
			return true
		}
		if normalized != session.pendingPassword {
			s.reset.mu.Lock()
			session.step = resetAwaitPassword
			session.pendingPassword = ""
			s.reset.mu.Unlock()
			_ = s.tg.sendMessage(ctx, chatID, "Parollar mos kelmadi. Yangi parolni qaytadan yozing.", nil)
			return true
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(session.pendingPassword), 10)
		if err != nil {
			_ = s.tg.sendMessage(ctx, chatID, "Parolni saqlashda xato. Keyinroq urinib ko'ring.", nil)
			return true
		}
		if err := s.repo.updateUserPassword(ctx, session.userID, string(hash)); err != nil {
			_ = s.tg.sendMessage(ctx, chatID, "Parolni saqlashda xato. Keyinroq urinib ko'ring.", nil)
			return true
		}
		s.reset.recordRateLimit(session.userID)
		s.reset.cancelFlow(chatID)
		_ = s.repo.linkTelegramChatToUser(ctx, chatID, session.userID)
		s.botCtx.invalidateLinkedUser(chatID)
		_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
			"✅ Parol yangilandi, " + session.fullName + "!",
			"Login: " + session.login,
			"",
			"Endi veb-ilovada yangi parol bilan kiring.",
			"Xavfsizlik uchun ushbu xabarlarni o'chirishingiz mumkin.",
		}, "\n"), nil)
		return true
	}
	return false
}

func (p *passwordResetState) assertRateLimit(userID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	entry := p.rateLimits[userID]
	if !entry.windowStart.IsZero() && now.Sub(entry.windowStart) <= time.Hour && entry.count >= maxResetsPerHour {
		return errBadRequest("Juda ko'p urinish. 1 soatdan keyin qayta urinib ko'ring yoki administrator bilan bog'laning.")
	}
	return nil
}

func (p *passwordResetState) recordRateLimit(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	entry := p.rateLimits[userID]
	if entry.windowStart.IsZero() || now.Sub(entry.windowStart) > time.Hour {
		p.rateLimits[userID] = rateLimitEntry{count: 1, windowStart: now}
		return
	}
	entry.count++
	p.rateLimits[userID] = entry
}

func contactOnlyKeyboard() map[string]any {
	return map[string]any{
		"keyboard":          [][]map[string]any{{{ "text": "📱 Telefon raqamni ulashish", "request_contact": true}}},
		"resize_keyboard":   true,
		"one_time_keyboard": true,
	}
}
