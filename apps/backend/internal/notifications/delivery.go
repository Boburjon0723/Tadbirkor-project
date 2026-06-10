package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TelegramMessenger — telegram moduli implement qiladi.
type TelegramMessenger interface {
	IsReady() bool
	SendToCompany(ctx context.Context, companyID, title, message, ntype string, payload *TelegramPayload) error
	SendToChat(ctx context.Context, companyID, chatID, title, message, ntype string, payload *TelegramPayload) error
}

type DeliveryService struct {
	pool      *pgxpool.Pool
	messenger TelegramMessenger
}

func NewDeliveryService(pool *pgxpool.Pool, messenger TelegramMessenger) *DeliveryService {
	return &DeliveryService{pool: pool, messenger: messenger}
}

type enqueueInput struct {
	Kind      string
	CompanyID string
	ChatID    string
	Title     string
	Message   string
	Type      string
	Telegram  *TelegramPayload
	DedupKey  string
	DedupTTL  time.Duration
	Throw     bool
}

func (d *DeliveryService) HasRecentDelivery(ctx context.Context, dedupKey string, ttl time.Duration) (bool, error) {
	if dedupKey == "" {
		return false, nil
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	since := time.Now().Add(-ttl)
	var id string
	err := d.pool.QueryRow(ctx, `
		SELECT id FROM "NotificationDelivery"
		WHERE "dedupKey" = $1 AND status IN ('PENDING','SENT','RETRYING') AND "createdAt" >= $2
		LIMIT 1
	`, dedupKey, since).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return id != "", nil
}

func (d *DeliveryService) EnqueueCompanyTelegram(ctx context.Context, companyID, title, message, ntype string, payload *TelegramPayload, dedupKey string, dedupTTL time.Duration) error {
	_, err := d.enqueue(ctx, enqueueInput{
		Kind: "company", CompanyID: companyID, Title: title, Message: message, Type: ntype,
		Telegram: payload, DedupKey: dedupKey, DedupTTL: dedupTTL,
	})
	return err
}

func (d *DeliveryService) EnqueueChatTelegram(ctx context.Context, companyID, chatID, title, message, ntype string, payload *TelegramPayload, dedupKey string, dedupTTL time.Duration, throw bool) error {
	_, err := d.enqueue(ctx, enqueueInput{
		Kind: "chat", CompanyID: companyID, ChatID: chatID, Title: title, Message: message, Type: ntype,
		Telegram: payload, DedupKey: dedupKey, DedupTTL: dedupTTL, Throw: throw,
	})
	return err
}

func (d *DeliveryService) enqueue(ctx context.Context, in enqueueInput) (string, error) {
	if d.messenger == nil || !d.messenger.IsReady() {
		return "", nil
	}
	if in.DedupKey != "" {
		ok, err := d.HasRecentDelivery(ctx, in.DedupKey, in.DedupTTL)
		if err != nil {
			return "", err
		}
		if ok {
			return "", nil
		}
	}
	body := map[string]any{
		"kind": in.Kind, "companyId": in.CompanyID, "chatId": in.ChatID,
		"title": in.Title, "message": in.Message, "type": in.Type,
		"telegramPayload": in.Telegram,
	}
	raw, _ := json.Marshal(body)
	target := "company:" + in.CompanyID
	if in.Kind == "chat" {
		target = in.ChatID
	}
	var moduleKey, eventKey *string
	if in.Telegram != nil {
		if in.Telegram.ModuleKey != "" {
			moduleKey = &in.Telegram.ModuleKey
		}
		if in.Telegram.EventKey != "" {
			eventKey = &in.Telegram.EventKey
		}
	}
	id := uuid.NewString()
	_, err := d.pool.Exec(ctx, `
		INSERT INTO "NotificationDelivery" (
			id, "companyId", channel, status, target, "moduleKey", "eventKey", "dedupKey", payload, attempt, "maxAttempts", "createdAt", "updatedAt"
		) VALUES ($1, $2, 'TELEGRAM', 'PENDING', $3, $4, $5, $6, $7::jsonb, 0, 5, NOW(), NOW())
	`, id, in.CompanyID, target, moduleKey, eventKey, nullIfEmpty(in.DedupKey), string(raw))
	if err != nil {
		return "", err
	}
	if err := d.processDelivery(ctx, id); err != nil {
		log.Printf("notifications delivery %s: %v", id, err)
		if in.Throw {
			return id, err
		}
	}
	return id, nil
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (d *DeliveryService) processDelivery(ctx context.Context, deliveryID string) error {
	var status string
	var companyID string
	var payloadJSON []byte
	err := d.pool.QueryRow(ctx, `
		SELECT status, "companyId", payload FROM "NotificationDelivery" WHERE id = $1
	`, deliveryID).Scan(&status, &companyID, &payloadJSON)
	if err != nil {
		return err
	}
	if status == "SENT" || status == "DEAD" {
		return nil
	}
	var body struct {
		Kind     string           `json:"kind"`
		CompanyID string          `json:"companyId"`
		ChatID   string           `json:"chatId"`
		Title    string           `json:"title"`
		Message  string           `json:"message"`
		Type     string           `json:"type"`
		Telegram *TelegramPayload `json:"telegramPayload"`
	}
	if err := json.Unmarshal(payloadJSON, &body); err != nil {
		_, _ = d.pool.Exec(ctx, `UPDATE "NotificationDelivery" SET status='DEAD', "lastError"=$2 WHERE id=$1`, deliveryID, "bad payload")
		return err
	}
	_, _ = d.pool.Exec(ctx, `UPDATE "NotificationDelivery" SET status='RETRYING', attempt=attempt+1, "updatedAt"=NOW() WHERE id=$1`, deliveryID)

	var sendErr error
	if body.Kind == "chat" {
		sendErr = d.messenger.SendToChat(ctx, body.CompanyID, body.ChatID, body.Title, body.Message, body.Type, body.Telegram)
	} else {
		sendErr = d.messenger.SendToCompany(ctx, body.CompanyID, body.Title, body.Message, body.Type, body.Telegram)
	}
	if sendErr != nil {
		msg := sendErr.Error()
		if len(msg) > 2000 {
			msg = msg[:2000]
		}
		_, _ = d.pool.Exec(ctx, `
			UPDATE "NotificationDelivery" SET status='RETRYING', "lastError"=$2, "updatedAt"=NOW() WHERE id=$1
		`, deliveryID, msg)
		return sendErr
	}
	_, _ = d.pool.Exec(ctx, `
		UPDATE "NotificationDelivery" SET status='SENT', "sentAt"=NOW(), "lastError"=NULL, "updatedAt"=NOW() WHERE id=$1
	`, deliveryID)
	return nil
}

// StartRetryWorker — RETRYING holatidagi Telegram delivery'larni fon'da qayta yuboradi.
func (d *DeliveryService) StartRetryWorker(ctx context.Context) {
	if d == nil || d.pool == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				d.retryFailedDeliveries(ctx)
			}
		}
	}()
}

func (d *DeliveryService) retryFailedDeliveries(ctx context.Context) {
	rows, err := d.pool.Query(ctx, `
		SELECT id FROM "NotificationDelivery"
		WHERE channel = 'TELEGRAM' AND status = 'RETRYING'
		ORDER BY "updatedAt" ASC
		LIMIT 20
	`)
	if err != nil {
		log.Printf("notifications delivery retry query: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		if err := d.processDelivery(ctx, id); err != nil {
			log.Printf("notifications delivery retry %s: %v", id, err)
		}
	}
}
