package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

const DefaultTelegramBotUsername = "tadbirkor_malumot_bot"

type Config struct {
	Port            string
	DatabaseURL     string
	RedisURL        string
	NestJSURL       string
	JWTSecret       string
	AuthCookieName  string
	AuthMeCacheTTL  int
	DashboardCacheTTL int
	CORSOrigins     []string
	IsProduction    bool
	TelegramBotUsername     string
	TelegramBotToken        string
	TelegramWebhookSecret   string
	TelegramUpdatesEnabled  bool
	RegistrationEnabled     *bool
	SupportTelegramChatID   string
	SupportTelegramUsername string
	SupportEmail            string
	SupportPhone            string
	SupportHours            string
	SupabaseURL             string
	SupabaseKey             string
	SupabaseBucket          string
	PublicBaseURL           string
}

func Load() Config {
	// Lokal .env fayl shell dagi eski DATABASE_URL ni bosib ketadi
	_ = godotenv.Overload()
	ttlMs, _ := strconv.Atoi(getEnv("AUTH_ME_CACHE_TTL_MS", "60000"))
	origins := strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	dashTTL, _ := strconv.Atoi(getEnv("DASHBOARD_CACHE_TTL_MS", "90000"))
	return Config{
		Port:              getEnv("PORT", "4003"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		RedisURL:          os.Getenv("REDIS_URL"),
		NestJSURL:         getEnv("NESTJS_URL", "http://localhost:4002"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		AuthCookieName:    getEnv("AUTH_COOKIE_NAME", "access_token"),
		AuthMeCacheTTL:    ttlMs,
		DashboardCacheTTL: dashTTL,
		CORSOrigins:       origins,
		IsProduction:      os.Getenv("NODE_ENV") == "production",
		TelegramBotUsername:     strings.TrimPrefix(strings.TrimSpace(getEnv("TELEGRAM_BOT_USERNAME", DefaultTelegramBotUsername)), "@"),
		TelegramBotToken:        strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")),
		TelegramWebhookSecret:   strings.TrimSpace(os.Getenv("TELEGRAM_WEBHOOK_SECRET")),
		TelegramUpdatesEnabled:  strings.EqualFold(strings.TrimSpace(os.Getenv("TELEGRAM_UPDATES_ENABLED")), "true"),
		RegistrationEnabled:     parseRegistrationFlag(),
		SupportTelegramChatID:   strings.TrimSpace(os.Getenv("SUPPORT_TELEGRAM_CHAT_ID")),
		SupportTelegramUsername: strings.TrimSpace(os.Getenv("SUPPORT_TELEGRAM_USERNAME")),
		SupportEmail:            strings.TrimSpace(os.Getenv("SUPPORT_EMAIL")),
		SupportPhone:            strings.TrimSpace(os.Getenv("SUPPORT_PHONE")),
		SupportHours:            strings.TrimSpace(os.Getenv("SUPPORT_HOURS")),
		SupabaseURL:             getEnv("SUPABASE_URL", os.Getenv("NEXT_PUBLIC_SUPABASE_URL")),
		SupabaseKey:             os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseBucket:          getEnv("SUPABASE_STORAGE_BUCKET", "product-images"),
		PublicBaseURL:           getEnv("PUBLIC_BASE_URL", os.Getenv("APP_URL")),
	}
}

func parseRegistrationFlag() *bool {
	flag := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_REGISTRATION_ENABLED")))
	if flag == "true" || flag == "1" || flag == "yes" {
		v := true
		return &v
	}
	if flag == "false" || flag == "0" || flag == "no" {
		v := false
		return &v
	}
	return nil
}

func (c Config) IsRegistrationEnabled() bool {
	if c.RegistrationEnabled != nil {
		return *c.RegistrationEnabled
	}
	// Ro‘yxatdan o‘tish ochiq; yopish uchun AUTH_REGISTRATION_ENABLED=false
	return true
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
