package companies

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type UpsertTelegramBindingInput struct {
	ModuleKey string `json:"moduleKey"`
	Role      string `json:"role"`
	ChatID    string `json:"chatId"`
	Enabled   *bool  `json:"enabled"`
}

type RemoveTelegramBindingInput struct {
	ModuleKey string `json:"moduleKey"`
	Role      string `json:"role"`
}

func (s *Service) InitTelegramLink(ctx context.Context, companyID, userID string) (map[string]any, error) {
	botUsername := strings.TrimSpace(s.botUsername)
	if botUsername == "" {
		return nil, errors.New("TELEGRAM_BOT_USERNAME setilmagan")
	}
	botURL := "https://t.me/" + strings.TrimPrefix(botUsername, "@")

	var userPhone *string
	var userChatID *string
	err := s.pool.QueryRow(ctx, `
		SELECT phone, "telegramChatId"
		FROM "User" WHERE id = $1
	`, userID).Scan(&userPhone, &userChatID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var companyPhone *string
	var companyChatID *string
	err = s.pool.QueryRow(ctx, `
		SELECT phone, "telegramChatId"
		FROM "Company" WHERE id = $1
	`, companyID).Scan(&companyPhone, &companyChatID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}

	registeredPhone := ""
	if userPhone != nil && *userPhone != "" {
		registeredPhone = *userPhone
	} else if companyPhone != nil {
		registeredPhone = *companyPhone
	}
	if registeredPhone == "" {
		return nil, errors.New("Telegram ulanishi uchun avval profil yoki kompaniya sozlamalarida telefon raqamini kiriting.")
	}

	return map[string]any{
		"mode":                    "phone",
		"botUrl":                  botURL,
		"startUrl":                botURL,
		"botUsername":             botUsername,
		"registeredPhone":         registeredPhone,
		"userTelegramLinked":      userChatID != nil && *userChatID != "",
		"companyTelegramLinked":   companyChatID != nil && *companyChatID != "",
		"instructions":            "Botni oching va «Telefon raqamni ulashish» tugmasini bosing. Raqamni qo'lda yozmang — Telegram o'zi yuboradi.",
	}, nil
}

func (s *Service) GetTelegramBindings(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, "companyId", "moduleKey", role, "chatId", enabled, "createdAt", "updatedAt"
		FROM "TelegramChatBinding"
		WHERE "companyId" = $1
		ORDER BY "moduleKey" ASC, role ASC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, cid, moduleKey, role, chatID string
		var enabled bool
		var createdAt, updatedAt any
		if err := rows.Scan(&id, &cid, &moduleKey, &role, &chatID, &enabled, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "companyId": cid, "moduleKey": moduleKey, "role": role,
			"chatId": chatID, "enabled": enabled, "createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	return out, rows.Err()
}

func (s *Service) UpsertTelegramBinding(ctx context.Context, companyID string, in UpsertTelegramBindingInput) (map[string]any, error) {
	moduleKey := strings.ToUpper(strings.TrimSpace(in.ModuleKey))
	role := strings.ToUpper(strings.TrimSpace(in.Role))
	chatID := strings.TrimSpace(in.ChatID)
	enabled := true
	if in.Enabled != nil {
		enabled = *in.Enabled
	}
	var id, cid, mk, r, c string
	var en bool
	var createdAt, updatedAt any
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "TelegramChatBinding" ("companyId", "moduleKey", role, "chatId", enabled)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT ("companyId", role, "moduleKey") DO UPDATE SET "chatId" = $4, enabled = $5
		RETURNING id, "companyId", "moduleKey", role, "chatId", enabled, "createdAt", "updatedAt"
	`, companyID, moduleKey, role, chatID, enabled).Scan(&id, &cid, &mk, &r, &c, &en, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "companyId": cid, "moduleKey": mk, "role": r,
		"chatId": c, "enabled": en, "createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Service) RemoveTelegramBinding(ctx context.Context, companyID string, in RemoveTelegramBindingInput) (map[string]any, error) {
	moduleKey := strings.ToUpper(strings.TrimSpace(in.ModuleKey))
	role := strings.ToUpper(strings.TrimSpace(in.Role))
	_, err := s.pool.Exec(ctx, `
		DELETE FROM "TelegramChatBinding" WHERE "companyId" = $1 AND role = $2 AND "moduleKey" = $3
	`, companyID, role, moduleKey)
	if err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}
