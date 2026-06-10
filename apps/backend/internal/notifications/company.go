package notifications

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// NotifyCompany — kompaniyadagi barcha a'zolarga bildirishnoma + Telegram (Nest notifyCompany).
func (s *Service) NotifyCompany(ctx context.Context, companyID, title, message, ntype string, telegram *TelegramPayload, dedupKey string, dedupTTL time.Duration) error {
	if strings.TrimSpace(companyID) == "" {
		return nil
	}
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT "userId" FROM "CompanyUser" WHERE "companyId" = $1`, companyID)
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
		`, userID, title, message, ntype, nullStr(telegramModule(telegram)), nullStr(telegramEvent(telegram)))
		if err != nil {
			return err
		}
		if s.hub != nil {
			s.hub.EmitToUser(userID, "notification:refresh", map[string]any{"reason": "company_broadcast"})
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if s.delivery != nil && telegram != nil {
		if dedupKey == "" && telegram.EventKey != "" {
			dedupKey = fmt.Sprintf("%s:%s:%s", companyID, telegram.ModuleKey, telegram.EventKey)
		}
		if dedupTTL <= 0 {
			dedupTTL = 5 * time.Minute
		}
		_ = s.delivery.EnqueueCompanyTelegram(ctx, companyID, title, message, ntype, telegram, dedupKey, dedupTTL)
	}
	return nil
}

func telegramModule(p *TelegramPayload) string {
	if p == nil {
		return ""
	}
	return p.ModuleKey
}

func telegramEvent(p *TelegramPayload) string {
	if p == nil {
		return ""
	}
	return p.EventKey
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
