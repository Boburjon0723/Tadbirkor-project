package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/tadbirkor/axis-erp/backend/internal/config"
	"github.com/tadbirkor/axis-erp/backend/internal/permissions"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials    = errors.New("Login yoki parol noto'g'ri")
	ErrNoMembership          = errors.New("Hisobingiz hech qanday kompaniyaga biriktirilmagan. Administrator bilan bog'laning.")
	ErrNoPassword            = errors.New("Hisob paroli sozlanmagan. Administrator bilan bog'laning.")
	ErrCompanyNotFound       = errors.New("Kompaniya topilmadi yoki hisobingiz ushbu kompaniyaga bog'lanmagan.")
	ErrRegistrationDisabled  = errors.New("Ro'yxatdan o'tish vaqtincha yopiq. Mavjud hisob bilan kiring yoki administrator bilan bog'laning.")
	ErrLoginTaken            = errors.New("Bunday login allaqachon band")
	ErrEmailTaken            = errors.New("Bunday email allaqachon ro'yxatdan o'tgan")
	ErrPhoneInvalid          = errors.New("Telefon raqami noto'g'ri (masalan: +998901234567)")
	ErrPhoneTaken            = errors.New("Bunday telefon raqami band")
	ErrTelegramNotConfigured = errors.New("TELEGRAM_BOT_USERNAME sozlanmagan")
)

type Service struct {
	repo      *Repository
	cache     *cache.Cache
	cfg       config.Config
	jwtSecret string
	meTTL     time.Duration
}

func NewService(repo *Repository, c *cache.Cache, cfg config.Config) *Service {
	return &Service{
		repo:      repo,
		cache:     c,
		cfg:       cfg,
		jwtSecret: cfg.JWTSecret,
		meTTL:     time.Duration(cfg.AuthMeCacheTTL) * time.Millisecond,
	}
}

type LoginInput struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type RegisterInput struct {
	CompanyName string  `json:"companyName"`
	FullName    string  `json:"fullName"`
	Login       string  `json:"login"`
	Password    string  `json:"password"`
	Tin         *string `json:"tin"`
	Email       *string `json:"email"`
	Phone       string  `json:"phone"`
}

type PasswordResetLinkInput struct {
	Login string `json:"login"`
}

type LoginResponse struct {
	AccessToken string    `json:"access_token"`
	User        UserBrief `json:"user"`
}

type UserBrief struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Login    string `json:"login"`
	Role     string `json:"role"`
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*LoginResponse, error) {
	if !s.cfg.IsRegistrationEnabled() {
		return nil, ErrRegistrationDisabled
	}
	login := strings.TrimSpace(input.Login)
	if exists, err := s.repo.LoginExists(ctx, login); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrLoginTaken
	}
	if input.Email != nil && strings.TrimSpace(*input.Email) != "" {
		email := strings.TrimSpace(*input.Email)
		if exists, err := s.repo.EmailExists(ctx, email); err != nil {
			return nil, err
		} else if exists {
			return nil, ErrEmailTaken
		}
		input.Email = &email
	} else {
		input.Email = nil
	}
	normalizedPhone := phone.NormalizeUzPhone(input.Phone)
	if normalizedPhone == "" {
		return nil, ErrPhoneInvalid
	}
	if exists, err := s.repo.PhoneExists(ctx, normalizedPhone); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrPhoneTaken
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		return nil, err
	}
	companyID := uuid.NewString()
	userID := uuid.NewString()
	warehouseID := uuid.NewString()
	trialEnds := computeTrialEndsAt()
	var tin *string
	if input.Tin != nil && strings.TrimSpace(*input.Tin) != "" {
		t := strings.TrimSpace(*input.Tin)
		tin = &t
	}
	err = s.repo.RegisterOwner(ctx, RegisterOwnerParams{
		CompanyID:    companyID,
		CompanyName:  strings.TrimSpace(input.CompanyName),
		Tin:          tin,
		Phone:        normalizedPhone,
		TrialEndsAt:  trialEnds,
		UserID:       userID,
		FullName:     strings.TrimSpace(input.FullName),
		Login:        login,
		PasswordHash: string(hash),
		Email:        input.Email,
		WarehouseID:  warehouseID,
	})
	if err != nil {
		return nil, err
	}
	token, err := s.signToken(userID, companyID, "OWNER")
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		AccessToken: token,
		User: UserBrief{
			ID: userID, FullName: strings.TrimSpace(input.FullName), Login: login, Role: "OWNER",
		},
	}, nil
}

func (s *Service) CreatePasswordResetTelegramLink(ctx context.Context, input PasswordResetLinkInput) (map[string]any, error) {
	if s.cfg.TelegramBotUsername == "" {
		return nil, ErrTelegramNotConfigured
	}
	login := strings.TrimSpace(input.Login)
	codeBytes := make([]byte, 8)
	if _, err := rand.Read(codeBytes); err != nil {
		return nil, err
	}
	code := hex.EncodeToString(codeBytes)
	expiresAt := time.Now().Add(15 * time.Minute)
	var loginHint *string
	if login != "" {
		user, memberships, err := s.repo.FindUserByLogin(ctx, login)
		if err == nil && user != nil && user.PasswordHash != nil && len(memberships) > 0 {
			loginHint = &login
		}
	}
	if err := s.repo.CreatePasswordResetIntent(ctx, code, loginHint, expiresAt); err != nil {
		return nil, err
	}
	startPayload := "rp_" + code
	botURL := "https://t.me/" + strings.TrimPrefix(s.cfg.TelegramBotUsername, "@") + "?start=" + url.QueryEscape(startPayload)
	return map[string]any{
		"botUrl":       botURL,
		"startUrl":     botURL,
		"expiresAt":    expiresAt,
		"instructions": "Telegram botni oching, «Telefon raqamni ulashish» tugmasini bosing, keyin yangi parol kiriting.",
	}, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (*LoginResponse, error) {
	user, memberships, err := s.repo.FindUserByLogin(ctx, strings.TrimSpace(input.Login))
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}
	if user.PasswordHash == nil || *user.PasswordHash == "" {
		return nil, ErrNoPassword
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	if len(memberships) == 0 {
		return nil, ErrNoMembership
	}
	main := memberships[0]
	token, err := s.signToken(user.ID, main.CompanyID, main.Role)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		AccessToken: token,
		User: UserBrief{
			ID:       user.ID,
			FullName: user.FullName,
			Login:    user.Login,
			Role:     main.Role,
		},
	}, nil
}

func (s *Service) GetMe(ctx context.Context, userID, companyID string) (map[string]any, error) {
	resolved, err := s.repo.ResolveCompanyID(ctx, userID, companyID)
	if err != nil {
		return nil, ErrCompanyNotFound
	}
	cacheKey := s.cache.AuthMeKey(userID, resolved)
	var cached map[string]any
	if ok, _ := s.cache.GetJSON(ctx, cacheKey, &cached); ok {
		return cached, nil
	}
	payload, err := s.loadMe(ctx, userID, resolved)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetJSON(ctx, cacheKey, payload, s.meTTL)
	return payload, nil
}

func (s *Service) loadMe(ctx context.Context, userID, companyID string) (map[string]any, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	company, err := s.repo.LoadCompany(ctx, companyID)
	if err != nil {
		return nil, ErrCompanyNotFound
	}
	cu, err := s.repo.LoadCompanyUser(ctx, userID, companyID)
	if err != nil {
		return nil, err
	}
	role := cu.Role
	if role == "" {
		role = "OWNER"
	}
	access := resolveSubscriptionAccess(company)
	if access["status"] == "TRIAL" && !access["trialActive"].(bool) && strings.ToUpper(company.SubscriptionStatus) == "TRIAL" {
		_ = s.repo.UpdateSubscriptionExpired(ctx, companyID)
		company.SubscriptionStatus = "EXPIRED"
		access = resolveSubscriptionAccess(company)
		s.cache.Del(ctx, s.cache.AuthMeKey(userID, companyID))
	}
	platformAdmin := isPlatformAdmin(user)
	perms := permissions.Effective(role, cu.GrantPermissions, cu.DenyPermissions)
	warehouseScope := buildWarehouseScope(role, cu.WarehouseID)
	var warehouse any = nil
	if cu.WarehouseID != nil && cu.WarehouseStatus != nil && *cu.WarehouseStatus != "ARCHIVED" {
		warehouse = map[string]any{
			"id":     *cu.WarehouseID,
			"name":   deref(cu.WarehouseName),
			"status": *cu.WarehouseStatus,
		}
	}
	return map[string]any{
		"user": sanitizeUser(user),
		"isPlatformAdmin": platformAdmin,
		"company": map[string]any{
			"id":                            company.ID,
			"name":                          company.Name,
			"tin":                           company.Tin,
			"status":                        company.Status,
			"address":                       company.Address,
			"businessType":                  company.BusinessType,
			"storefrontUrl":                 company.StorefrontURL,
			"storefrontToken":               company.StorefrontToken,
			"telegramChatId":                company.TelegramChatID,
			"telegramEnabled":               company.TelegramEnabled,
			"telegramLinkedAt":              company.TelegramLinkedAt,
			"trialEndsAt":                   company.TrialEndsAt,
			"subscriptionStatus":            access["status"],
			"subscriptionNote":              company.SubscriptionNote,
			"subscriptionActivatedAt":       company.SubscriptionActivatedAt,
			"createdAt":                     company.CreatedAt,
			"posCreditEnabled":              company.PosCreditEnabled,
			"posMaxDiscountPercent":         company.PosMaxDiscountPercent,
			"inventoryVarianceTolerancePct": company.InventoryVarianceTolerance,
			"trialDays":                     trialDays(),
			"trialActive":                   access["trialActive"],
			"canWrite":                      platformAdmin || boolVal(access["canWrite"]),
			"subscriptionLabel":             access["labelUz"],
		},
		"role":             role,
		"permissions":      perms,
		"grantPermissions": cu.GrantPermissions,
		"denyPermissions":  cu.DenyPermissions,
		"warehouse":        warehouse,
		"warehouseScope":   warehouseScope,
	}, nil
}

func (s *Service) signToken(userID, companyID, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":       userID,
		"companyId": companyID,
		"role":      role,
		"exp":       time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":       time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func sanitizeUser(u *UserRow) map[string]any {
	if u == nil {
		return nil
	}
	return map[string]any{
		"id":               u.ID,
		"fullName":         u.FullName,
		"login":            u.Login,
		"email":            u.Email,
		"phone":            u.Phone,
		"telegramChatId":   u.TelegramChat,
		"telegramLinkedAt": u.TelegramAt,
	}
}

func buildWarehouseScope(role string, warehouseID *string) map[string]any {
	if permissions.RoleAllowsAllWarehouses(role) {
		var def any = nil
		if warehouseID != nil {
			def = *warehouseID
		}
		return map[string]any{
			"all":                true,
			"warehouseIds":       []string{},
			"defaultWarehouseId": def,
			"role":               role,
		}
	}
	ids := []string{}
	var def any = nil
	if warehouseID != nil {
		ids = []string{*warehouseID}
		def = *warehouseID
	}
	return map[string]any{
		"all":                false,
		"warehouseIds":       ids,
		"defaultWarehouseId": def,
		"role":               role,
	}
}

func resolveSubscriptionAccess(c *CompanyRow) map[string]any {
	status := strings.ToUpper(c.SubscriptionStatus)
	if status != "ACTIVE" && status != "EXPIRED" {
		status = "TRIAL"
	}
	trialActive := isTrialActive(c.TrialEndsAt)
	if status == "ACTIVE" {
		return map[string]any{"status": "ACTIVE", "canWrite": true, "trialActive": false, "labelUz": "Faol obuna"}
	}
	if status == "TRIAL" && trialActive {
		return map[string]any{"status": "TRIAL", "canWrite": true, "trialActive": true, "labelUz": "Bepul sinov"}
	}
	return map[string]any{"status": "EXPIRED", "canWrite": false, "trialActive": false, "labelUz": "Sinov tugagan"}
}

func isTrialActive(t *time.Time) bool {
	if t == nil {
		return false
	}
	return time.Now().Before(*t)
}

func trialDays() int {
	n, err := strconv.Atoi(strings.TrimSpace(os.Getenv("TRIAL_DAYS")))
	if err != nil || n <= 0 {
		return 7
	}
	if n > 365 {
		return 365
	}
	return n
}

func computeTrialEndsAt() time.Time {
	end := time.Now()
	end = end.AddDate(0, 0, trialDays())
	return end
}

func isPlatformAdmin(u *UserRow) bool {
	if u == nil {
		return false
	}
	raw := os.Getenv("PLATFORM_ADMIN_LOGINS")
	if raw == "" {
		return false
	}
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\n'
	}) {
		if strings.EqualFold(strings.TrimSpace(part), u.Login) {
			return true
		}
	}
	return false
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func boolVal(v any) bool {
	b, _ := v.(bool)
	return b
}
