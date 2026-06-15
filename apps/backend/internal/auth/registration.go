package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
	"golang.org/x/crypto/bcrypt"
)

const registrationSessionTTL = 15 * time.Minute

var (
	ErrRegistrationSessionNotFound = errors.New("Ro'yxatdan o'tish sessiyasi topilmadi yoki muddati tugagan")
	ErrRegistrationOTPNotReady     = errors.New("Avval Telegram botda telefon raqamingizni tasdiqlang")
	ErrRegistrationOTPInvalid      = errors.New("Tasdiqlash kodi noto'g'ri")
)

type RegistrationStartInput struct {
	CompanyName string  `json:"companyName"`
	FullName    string  `json:"fullName"`
	Login       string  `json:"login"`
	Password    string  `json:"password"`
	Phone       string  `json:"phone"`
	Email       *string `json:"email"`
	Tin         *string `json:"tin"`
}

type RegistrationSession struct {
	OTP          string    `json:"otp"`
	OTPDelivered bool      `json:"otpDelivered"`
	Phone        string    `json:"phone"`
	CompanyName  string    `json:"companyName"`
	FullName     string    `json:"fullName"`
	Login        string    `json:"login"`
	PasswordHash string    `json:"passwordHash"`
	Email        *string   `json:"email,omitempty"`
	Tin          *string   `json:"tin,omitempty"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

func registrationCacheKey(code string) string {
	return "auth:reg:" + strings.TrimSpace(code)
}

func generateRegistrationCode() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func generateOTP6() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}

func loadRegistrationSession(ctx context.Context, c *cache.Cache, code string) (*RegistrationSession, error) {
	if c == nil {
		return nil, ErrRegistrationSessionNotFound
	}
	var session RegistrationSession
	ok, err := c.GetJSON(ctx, registrationCacheKey(code), &session)
	if err != nil || !ok {
		return nil, ErrRegistrationSessionNotFound
	}
	if time.Now().After(session.ExpiresAt) {
		_ = deleteRegistrationSession(ctx, c, code)
		return nil, ErrRegistrationSessionNotFound
	}
	return &session, nil
}

func saveRegistrationSession(ctx context.Context, c *cache.Cache, code string, session *RegistrationSession) error {
	if c == nil {
		return errors.New("cache unavailable")
	}
	ttl := time.Until(session.ExpiresAt)
	if ttl <= 0 {
		return ErrRegistrationSessionNotFound
	}
	return c.SetJSON(ctx, registrationCacheKey(code), session, ttl)
}

func deleteRegistrationSession(ctx context.Context, c *cache.Cache, code string) error {
	if c == nil {
		return nil
	}
	c.Del(ctx, registrationCacheKey(code))
	return nil
}

func (s *Service) validateRegistrationFields(input RegistrationStartInput) (RegistrationStartInput, error) {
	if !s.cfg.IsRegistrationEnabled() {
		return input, ErrRegistrationDisabled
	}
	input.CompanyName = strings.TrimSpace(input.CompanyName)
	input.FullName = strings.TrimSpace(input.FullName)
	input.Login = strings.TrimSpace(input.Login)
	input.Password = strings.TrimSpace(input.Password)
	if input.CompanyName == "" || input.FullName == "" || input.Login == "" || input.Password == "" {
		return input, errors.New("Kompaniya nomi, ism, login va parol majburiy")
	}
	if len(input.Login) < 4 {
		return input, errors.New("Login kamida 4 belgidan iborat bo'lishi kerak")
	}
	if len(input.Password) < 6 {
		return input, errors.New("Parol kamida 6 belgidan iborat bo'lishi kerak")
	}
	normalizedPhone := phone.NormalizeUzPhone(input.Phone)
	if normalizedPhone == "" {
		return input, ErrPhoneInvalid
	}
	input.Phone = normalizedPhone
	if input.Email != nil {
		email := strings.TrimSpace(*input.Email)
		if email == "" {
			input.Email = nil
		} else {
			input.Email = &email
		}
	}
	if input.Tin != nil {
		tin := strings.TrimSpace(*input.Tin)
		if tin == "" {
			input.Tin = nil
		} else {
			input.Tin = &tin
		}
	}
	return input, nil
}

func (s *Service) assertRegistrationAvailable(ctx context.Context, input RegistrationStartInput) error {
	if exists, err := s.repo.LoginExists(ctx, input.Login); err != nil {
		return err
	} else if exists {
		return ErrLoginTaken
	}
	if input.Email != nil {
		if exists, err := s.repo.EmailExists(ctx, *input.Email); err != nil {
			return err
		} else if exists {
			return ErrEmailTaken
		}
	}
	if exists, err := s.repo.PhoneExists(ctx, input.Phone); err != nil {
		return err
	} else if exists {
		return ErrPhoneTaken
	}
	return nil
}

// StartRegistration — forma ma'lumotlarini saqlaydi, Telegram bot havolasini qaytaradi.
func (s *Service) StartRegistration(ctx context.Context, input RegistrationStartInput) (map[string]any, error) {
	var err error
	input, err = s.validateRegistrationFields(input)
	if err != nil {
		return nil, err
	}
	if err := s.assertRegistrationAvailable(ctx, input); err != nil {
		return nil, err
	}
	if s.cfg.TelegramBotUsername == "" {
		return nil, ErrTelegramNotConfigured
	}

	sessionCode, err := generateRegistrationCode()
	if err != nil {
		return nil, err
	}
	otp, err := generateOTP6()
	if err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(registrationSessionTTL)
	session := &RegistrationSession{
		OTP:          otp,
		OTPDelivered: false,
		Phone:        input.Phone,
		CompanyName:  input.CompanyName,
		FullName:     input.FullName,
		Login:        input.Login,
		PasswordHash: string(hash),
		Email:        input.Email,
		Tin:          input.Tin,
		ExpiresAt:    expiresAt,
	}
	if err := saveRegistrationSession(ctx, s.cache, sessionCode, session); err != nil {
		return nil, err
	}

	if err := s.repo.CreateRegistrationIntent(ctx, sessionCode, input.Phone, expiresAt); err != nil {
		_ = deleteRegistrationSession(ctx, s.cache, sessionCode)
		return nil, err
	}

	startPayload := "reg_" + sessionCode
	botName := strings.TrimPrefix(s.cfg.TelegramBotUsername, "@")
	botURL := "https://t.me/" + botName + "?start=" + url.QueryEscape(startPayload)
	return map[string]any{
		"sessionToken": sessionCode,
		"botUrl":       botURL,
		"expiresAt":    expiresAt,
		"phone":        input.Phone,
		"instructions": fmt.Sprintf("Telegramda @%s botni oching, telefon raqamingizni ulashing — tasdiqlash kodi shu yerga keladi.", botName),
	}, nil
}

// RegistrationStatus — mobil ilova Telegram bosqichi uchun.
func (s *Service) RegistrationStatus(ctx context.Context, sessionToken string) (map[string]any, error) {
	session, err := loadRegistrationSession(ctx, s.cache, sessionToken)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"otpDelivered": session.OTPDelivered,
		"expiresAt":    session.ExpiresAt,
		"phone":        session.Phone,
	}, nil
}

// CompleteRegistration — Telegram orqali yuborilgan OTP bilan akkauntni yaratadi.
func (s *Service) CompleteRegistration(ctx context.Context, sessionToken, otp string) (*LoginResponse, error) {
	session, err := loadRegistrationSession(ctx, s.cache, sessionToken)
	if err != nil {
		return nil, err
	}
	if !session.OTPDelivered {
		return nil, ErrRegistrationOTPNotReady
	}
	normalizedOTP := strings.TrimSpace(otp)
	if normalizedOTP == "" || normalizedOTP != session.OTP {
		return nil, ErrRegistrationOTPInvalid
	}

	if err := s.assertRegistrationAvailable(ctx, RegistrationStartInput{
		CompanyName: session.CompanyName,
		FullName:    session.FullName,
		Login:       session.Login,
		Phone:       session.Phone,
		Email:       session.Email,
	}); err != nil {
		_ = deleteRegistrationSession(ctx, s.cache, sessionToken)
		return nil, err
	}

	companyID := uuid.NewString()
	userID := uuid.NewString()
	warehouseID := uuid.NewString()
	trialEnds := computeTrialEndsAt()

	err = s.repo.RegisterOwner(ctx, RegisterOwnerParams{
		CompanyID:    companyID,
		CompanyName:  session.CompanyName,
		Tin:          session.Tin,
		Phone:        session.Phone,
		TrialEndsAt:  trialEnds,
		UserID:       userID,
		FullName:     session.FullName,
		Login:        session.Login,
		PasswordHash: session.PasswordHash,
		Email:        session.Email,
		WarehouseID:  warehouseID,
	})
	if err != nil {
		return nil, err
	}

	_ = deleteRegistrationSession(ctx, s.cache, sessionToken)
	_ = s.repo.MarkRegistrationIntentUsed(ctx, sessionToken)

	token, err := s.signToken(userID, companyID, "OWNER")
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		AccessToken: token,
		User: UserBrief{
			ID: userID, FullName: session.FullName, Login: session.Login, Role: "OWNER",
		},
	}, nil
}

// DeliverRegistrationOTP — Telegram bot telefon tasdiqlangach OTP yuboradi.
func DeliverRegistrationOTP(ctx context.Context, c *cache.Cache, sessionCode, phoneRaw string) (otp string, err error) {
	session, err := loadRegistrationSession(ctx, c, sessionCode)
	if err != nil {
		return "", err
	}
	normalized := phone.NormalizeUzPhone(phoneRaw)
	if normalized == "" {
		return "", ErrPhoneInvalid
	}
	if normalized != session.Phone {
		return "", errors.New("Telefon raqami ilovada kiritilgan raqam bilan mos kelmayapti")
	}
	session.OTPDelivered = true
	session.ExpiresAt = time.Now().Add(registrationSessionTTL)
	if err := saveRegistrationSession(ctx, c, sessionCode, session); err != nil {
		return "", err
	}
	return session.OTP, nil
}
