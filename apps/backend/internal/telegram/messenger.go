package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
)

type pgxRows = pgx.Rows

func (s *Service) IsReady() bool {
	return s.tg != nil
}

func (s *Service) SendToCompany(ctx context.Context, companyID, title, message, ntype string, payload *notifications.TelegramPayload) error {
	if s.tg == nil {
		return fmt.Errorf("telegram bot yo'q")
	}
	event := payloadOrDefault(payload)
	chats, err := s.repo.resolveTargetChats(ctx, companyID, event.ModuleKey, event.TargetRoles)
	if err != nil {
		return err
	}
	if len(chats) == 0 {
		return nil
	}
	text := formatTelegramMessage(title, message, ntype, event.Details, len(event.Actions) > 0)
	var lastErr error
	sent := 0
	for _, chat := range chats {
		if err := s.sendEventToChat(ctx, companyID, chat.ChatID, text, event); err != nil {
			lastErr = err
		} else {
			sent++
		}
	}
	if sent == 0 && lastErr != nil {
		return lastErr
	}
	return nil
}

func (s *Service) SendToChat(ctx context.Context, companyID, chatID, title, message, ntype string, payload *notifications.TelegramPayload) error {
	if s.tg == nil {
		return fmt.Errorf("telegram bot yo'q")
	}
	event := payloadOrDefault(payload)
	text := formatTelegramMessage(title, message, ntype, event.Details, len(event.Actions) > 0)
	return s.sendEventToChat(ctx, companyID, chatID, text, event)
}

func (s *Service) SendRawMessage(ctx context.Context, chatID, text string) error {
	if s.tg == nil {
		return fmt.Errorf("telegram bot yo'q")
	}
	return s.tg.sendMessage(ctx, chatID, text, nil)
}

func payloadOrDefault(p *notifications.TelegramPayload) notifications.TelegramPayload {
	if p == nil {
		return notifications.TelegramPayload{ModuleKey: "GENERAL", EventKey: "general.notification"}
	}
	return *p
}

func (s *Service) sendEventToChat(ctx context.Context, companyID, chatID, text string, event notifications.TelegramPayload) error {
	records, err := s.repo.createActionRecords(ctx, companyID, chatID, event.ModuleKey, event.Actions)
	if err != nil {
		return err
	}
	var markup any
	if len(records) > 0 {
		row := make([]map[string]any, 0, len(records))
		for _, r := range records {
			row = append(row, map[string]any{"text": r.Label, "callback_data": "ta:" + r.RecordID})
		}
		markup = map[string]any{"inline_keyboard": [][]map[string]any{row}}
	}
	return s.tg.sendMessage(ctx, chatID, text, markup)
}

type targetChat struct {
	ChatID string
	Role   string
}

func (r *Repository) resolveTargetChats(ctx context.Context, companyID, moduleKey string, targetRoles []string) ([]targetChat, error) {
	moduleKey = strings.ToUpper(strings.TrimSpace(moduleKey))
	roles := []string{}
	for _, role := range targetRoles {
		role = strings.ToUpper(strings.TrimSpace(role))
		if validTelegramRoles[role] {
			roles = append(roles, role)
		}
	}
	var pgRows pgxRows
	var err error
	if len(roles) > 0 {
		pgRows, err = r.pool.Query(ctx, `
			SELECT DISTINCT "chatId", role FROM "TelegramChatBinding"
			WHERE "companyId" = $1 AND enabled = true
			  AND "moduleKey" IN ($2, 'ALL') AND UPPER(role) = ANY($3)
		`, companyID, moduleKey, roles)
	} else {
		pgRows, err = r.pool.Query(ctx, `
			SELECT DISTINCT "chatId", role FROM "TelegramChatBinding"
			WHERE "companyId" = $1 AND enabled = true AND "moduleKey" IN ($2, 'ALL')
		`, companyID, moduleKey)
	}
	if err != nil {
		return nil, err
	}
	defer pgRows.Close()
	out := []targetChat{}
	seen := map[string]bool{}
	for pgRows.Next() {
		var chatID, role string
		if err := pgRows.Scan(&chatID, &role); err != nil {
			return nil, err
		}
		if seen[chatID] {
			continue
		}
		seen[chatID] = true
		out = append(out, targetChat{ChatID: chatID, Role: role})
	}
	if len(out) > 0 {
		return out, nil
	}
	var companyChat *string
	var enabled bool
	err = r.pool.QueryRow(ctx, `
		SELECT "telegramChatId", "telegramEnabled" FROM "Company" WHERE id = $1
	`, companyID).Scan(&companyChat, &enabled)
	if err != nil || !enabled || companyChat == nil || strings.TrimSpace(*companyChat) == "" {
		return nil, err
	}
	return []targetChat{{ChatID: strings.TrimSpace(*companyChat), Role: "OWNER"}}, nil
}

type actionRecordRef struct {
	Label    string
	RecordID string
}

func (r *Repository) createActionRecords(ctx context.Context, companyID, chatID, moduleKey string, actions []notifications.TelegramAction) ([]actionRecordRef, error) {
	if len(actions) == 0 {
		return nil, nil
	}
	out := make([]actionRecordRef, 0, len(actions))
	for _, action := range actions {
		id := uuid.NewString()
		payloadJSON, _ := json.Marshal(action.Payload)
		_, err := r.pool.Exec(ctx, `
			INSERT INTO "TelegramActionRecord" (
				id, "companyId", "chatId", "moduleKey", "actionKey", "targetType", "targetId", payload, status, "createdAt", "updatedAt"
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'PENDING', NOW(), NOW())
		`, id, companyID, chatID, strings.ToUpper(moduleKey), action.Key, action.TargetType, action.TargetID, string(payloadJSON))
		if err != nil {
			return nil, err
		}
		out = append(out, actionRecordRef{Label: action.Label, RecordID: id})
	}
	return out, nil
}
