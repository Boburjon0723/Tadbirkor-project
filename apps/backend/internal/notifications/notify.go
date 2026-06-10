package notifications

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// NotifyCompanyRoles — kompaniyadagi ma'lum rollarga bildirishnoma + ixtiyoriy Telegram.
func (s *Service) NotifyCompanyRoles(ctx context.Context, companyID string, roles []string, title, message, ntype, moduleKey, eventKey string, telegram ...*TelegramPayload) error {
	if len(roles) == 0 {
		return nil
	}
	normalized := make([]string, len(roles))
	for i, r := range roles {
		normalized[i] = strings.ToUpper(strings.TrimSpace(r))
	}

	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT cu."userId"
		FROM "CompanyUser" cu
		WHERE cu."companyId" = $1 AND UPPER(cu.role) = ANY($2)
	`, companyID, normalized)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return err
		}
		_, err := s.pool.Exec(ctx, `
			INSERT INTO "Notification" (id, "userId", title, message, type, "moduleKey", "eventKey", "isRead", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW())
		`, userID, title, message, ntype, moduleKey, eventKey)
		if err != nil {
			return err
		}
		if s.hub != nil {
			s.hub.EmitToUser(userID, "notification:refresh", map[string]any{"reason": "company_broadcast"})
		}
	}

	var tgPayload *TelegramPayload
	if len(telegram) > 0 {
		tgPayload = telegram[0]
	}
	if tgPayload == nil && moduleKey != "" {
		tgPayload = &TelegramPayload{
			ModuleKey: moduleKey, EventKey: eventKey, TargetRoles: normalized,
		}
	}
	if s.delivery != nil && tgPayload != nil {
		dedupKey := ""
		if tgPayload.EventKey != "" {
			dedupKey = fmt.Sprintf("%s:%s:%s", companyID, tgPayload.ModuleKey, tgPayload.EventKey)
		}
		_ = s.delivery.EnqueueCompanyTelegram(ctx, companyID, title, message, ntype, tgPayload, dedupKey, 5*time.Minute)
	}
	return rows.Err()
}

// NotifyUser — bitta foydalanuvchiga bildirishnoma.
func (s *Service) NotifyUser(ctx context.Context, userID, title, message, ntype string) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "Notification" (id, "userId", title, message, type, "isRead", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, false, NOW())
		RETURNING id
	`, userID, title, message, ntype).Scan(&id)
	if err == nil && s.hub != nil {
		s.hub.EmitToUser(userID, "notification:new", map[string]any{
			"id": id, "userId": userID, "title": title, "message": message, "type": ntype, "isRead": false,
		})
	}
	return err
}

// EnqueueChatTelegram — to'g'ridan-to'g'ri chatga Telegram (partner-ledger va h.k.).
func (s *Service) EnqueueChatTelegram(ctx context.Context, companyID, chatID, title, message, ntype string, payload *TelegramPayload, dedupKey string, throw bool) error {
	if s.delivery == nil {
		return nil
	}
	return s.delivery.EnqueueChatTelegram(ctx, companyID, chatID, title, message, ntype, payload, dedupKey, 5*time.Minute, throw)
}
