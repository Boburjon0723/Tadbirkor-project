package telegram

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/field"
	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
)

type partnerOrderComment struct {
	CompanyID string
	BatchID   string
	Status    string
}

type actionDeps struct {
	fieldSvc *field.Service
	leaveSvc *payroll.LeaveService
}

func (s *Service) setActionDeps(fieldSvc *field.Service, leaveSvc *payroll.LeaveService) {
	s.actions = &actionDeps{fieldSvc: fieldSvc, leaveSvc: leaveSvc}
	if s.pendingPartnerComment == nil {
		s.pendingPartnerComment = map[string]partnerOrderComment{}
	}
}

func (s *Service) processActionCallback(ctx context.Context, rawData, chatID, callbackQueryID string) (toast, chatMessage string) {
	if !strings.HasPrefix(rawData, "ta:") {
		return "Noto'g'ri action", "❗️ Amal bajarilmadi: callback formati noto'g'ri."
	}
	recordID := strings.TrimPrefix(rawData, "ta:")
	var record struct {
		ID, CompanyID, ChatID, ModuleKey, ActionKey, TargetType, TargetID, Status string
		CallbackQueryID                                                            *string
	}
	err := s.repo.pool.QueryRow(ctx, `
		SELECT id, "companyId", "chatId", "moduleKey", "actionKey", "targetType", "targetId", status, "callbackQueryId"
		FROM "TelegramActionRecord" WHERE id = $1
	`, recordID).Scan(&record.ID, &record.CompanyID, &record.ChatID, &record.ModuleKey, &record.ActionKey,
		&record.TargetType, &record.TargetID, &record.Status, &record.CallbackQueryID)
	if errors.Is(err, pgx.ErrNoRows) || record.ChatID != chatID {
		return "Topilmadi", "⚠️ Ushbu action yozuvi topilmadi yoki chatga tegishli emas."
	}
	if record.Status == "DONE" {
		return "Allaqachon bajarilgan", "ℹ️ Bu amal avval bajarilgan."
	}
	if record.CallbackQueryID != nil && *record.CallbackQueryID == callbackQueryID {
		return "Qayta so'rov", "ℹ️ Ushbu callback allaqachon qayd etilgan."
	}

	actorUserID, _ := s.resolveActorUserID(ctx, record.CompanyID, chatID, record.ModuleKey)
	summary, awaitComment, execErr := s.executeAction(ctx, record.CompanyID, record.ActionKey, record.TargetID, actorUserID)
	if execErr != nil {
		_, _ = s.repo.pool.Exec(ctx, `
			UPDATE "TelegramActionRecord" SET status='FAILED', "processedAt"=NOW(), "callbackQueryId"=$2, "errorMessage"=$3, "updatedAt"=NOW()
			WHERE id=$1
		`, recordID, callbackQueryID, execErr.Error())
		return "Xatolik", "❗️ Amal bajarilmadi: " + execErr.Error()
	}
	_, _ = s.repo.pool.Exec(ctx, `
		UPDATE "TelegramActionRecord" SET status='DONE', "processedAt"=NOW(), "callbackQueryId"=$2, "errorMessage"=NULL, "updatedAt"=NOW()
		WHERE id=$1
	`, recordID, callbackQueryID)
	if awaitComment != nil {
		s.pendingMu.Lock()
		s.pendingPartnerComment[chatID] = *awaitComment
		s.pendingMu.Unlock()
	}
	if summary == "" {
		summary = "✅ Amal bajarildi: " + record.ActionKey
	}
	return "Bajarildi", summary
}

func (s *Service) resolveActorUserID(ctx context.Context, companyID, chatID, moduleKey string) (string, error) {
	var userID string
	err := s.repo.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE "telegramChatId" = $1`, chatID).Scan(&userID)
	if err == nil {
		var cuID string
		err = s.repo.pool.QueryRow(ctx, `SELECT "userId" FROM "CompanyUser" WHERE "companyId"=$1 AND "userId"=$2`, companyID, userID).Scan(&cuID)
		if err == nil {
			return userID, nil
		}
	}
	var role string
	err = s.repo.pool.QueryRow(ctx, `
		SELECT role FROM "TelegramChatBinding"
		WHERE "companyId"=$1 AND "chatId"=$2 AND enabled=true AND "moduleKey" IN ($3,'ALL')
		ORDER BY "updatedAt" DESC LIMIT 1
	`, companyID, chatID, strings.ToUpper(moduleKey)).Scan(&role)
	if err != nil {
		return "", err
	}
	_ = s.repo.pool.QueryRow(ctx, `
		SELECT "userId" FROM "CompanyUser" WHERE "companyId"=$1 AND UPPER(role)=$2 LIMIT 1
	`, companyID, strings.ToUpper(role)).Scan(&userID)
	return userID, nil
}

func (s *Service) executeAction(ctx context.Context, companyID, actionKey, targetID, actorUserID string) (summary string, awaitComment *partnerOrderComment, err error) {
	switch actionKey {
	case "DEBT_CONFIRM":
		return s.debtConfirm(ctx, companyID, targetID, actorUserID)
	case "DEBT_REJECT":
		return s.debtReject(ctx, companyID, targetID, actorUserID)
	case "PARTNER_ACCEPT":
		return s.partnerAccept(ctx, companyID, targetID, actorUserID)
	case "PARTNER_REJECT":
		return s.partnerReject(ctx, companyID, targetID, actorUserID)
	case "ORDER_ACCEPT":
		return s.orderAccept(ctx, companyID, targetID, actorUserID)
	case "ORDER_REJECT":
		return s.orderReject(ctx, companyID, targetID, actorUserID)
	case "PL_ORDER_ACCEPT":
		return s.plOrderAccept(ctx, companyID, targetID, actorUserID)
	case "PL_ORDER_PARTIAL":
		return "📝 Qisman qabul qilindi deb belgilash uchun izoh yozing.", &partnerOrderComment{CompanyID: companyID, BatchID: targetID, Status: "PARTIAL"}, nil
	case "PL_ORDER_REJECT":
		return "📝 Qabul qilinmadi deb belgilash uchun izoh yozing.", &partnerOrderComment{CompanyID: companyID, BatchID: targetID, Status: "REJECTED"}, nil
	case "FIELD_APPROVE":
		if s.actions == nil || s.actions.fieldSvc == nil || actorUserID == "" {
			return "⚠️ Tasdiqlash uchun tizim foydalanuvchisi bilan ulaning.", nil, nil
		}
		_, err = s.actions.fieldSvc.ApproveTask(ctx, companyID, actorUserID, targetID)
		return "✅ Dala vazifasi hisoboti tasdiqlandi.", nil, err
	case "FIELD_REJECT":
		if s.actions == nil || s.actions.fieldSvc == nil || actorUserID == "" {
			return "⚠️ Rad etish uchun tizim foydalanuvchisi bilan ulaning.", nil, nil
		}
		_, err = s.actions.fieldSvc.RejectTask(ctx, companyID, actorUserID, targetID, "Telegram orqali rad etildi")
		return "⚠️ Dala vazifasi hisoboti rad etildi.", nil, err
	case "LEAVE_APPROVE":
		if s.actions == nil || s.actions.leaveSvc == nil || actorUserID == "" {
			return "⚠️ Tasdiqlash uchun tizim foydalanuvchisi bilan ulaning.", nil, nil
		}
		res, err := s.actions.leaveSvc.ApproveLeaveRequest(ctx, companyID, actorUserID, targetID, nil)
		if err != nil {
			return "", nil, err
		}
		name := leaveActionEmployeeName(res)
		days, _ := res["daysCount"].(float64)
		return fmt.Sprintf("✅ Dam olish tasdiqlandi: %s (%.0f kun).", name, days), nil, nil
	case "LEAVE_REJECT":
		if s.actions == nil || s.actions.leaveSvc == nil || actorUserID == "" {
			return "⚠️ Rad etish uchun tizim foydalanuvchisi bilan ulaning.", nil, nil
		}
		res, err := s.actions.leaveSvc.RejectLeaveRequest(ctx, companyID, actorUserID, targetID, nil)
		if err != nil {
			return "", nil, err
		}
		name := leaveActionEmployeeName(res)
		return fmt.Sprintf("❌ Dam olish rad etildi: %s.", name), nil, nil
	default:
		return "", nil, fmt.Errorf("unsupported action: %s", actionKey)
	}
}

func (s *Service) debtConfirm(ctx context.Context, companyID, paymentID, actorUserID string) (string, *partnerOrderComment, error) {
	tx, err := s.repo.pool.Begin(ctx)
	if err != nil {
		return "", nil, err
	}
	defer tx.Rollback(ctx)
	var amount, remaining float64
	var entryID, status string
	err = tx.QueryRow(ctx, `
		SELECT dpr.amount, dpr.status, dpr."debtEntryId", de."remainingAmount"
		FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.id = $1 AND de."creditorId" = $2
	`, paymentID, companyID).Scan(&amount, &status, &entryID, &remaining)
	if err != nil || status != "PENDING" {
		return "ℹ️ To'lov allaqachon ko'rib chiqilgan yoki mavjud emas.", nil, nil
	}
	next := remaining - amount
	if next < 0 {
		next = 0
	}
	newStatus := "PARTIAL"
	if next <= 0 {
		newStatus = "PAID"
	}
	_, err = tx.Exec(ctx, `UPDATE "DebtPaymentRecord" SET status='CONFIRMED', "confirmedBy"=$2 WHERE id=$1`, paymentID, nullUUID(actorUserID))
	if err != nil {
		return "", nil, err
	}
	_, err = tx.Exec(ctx, `UPDATE "DebtEntry" SET "remainingAmount"=$2, status=$3 WHERE id=$1`, entryID, next, newStatus)
	if err != nil {
		return "", nil, err
	}
	if actorUserID != "" {
		_, _ = tx.Exec(ctx, `
			INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, 'debt.payment_confirmed.telegram', 'DEBT_PAYMENT', $3, '{"status":"CONFIRMED","source":"TELEGRAM"}'::jsonb, NOW())
		`, companyID, actorUserID, paymentID)
	}
	if err := tx.Commit(ctx); err != nil {
		return "", nil, err
	}
	suffix := fmt.Sprintf("Qolgan qarzdorlik: %s.", formatMoneyUZS(next))
	if next <= 0 {
		suffix = "✅ Barchasi to'landi."
	}
	return fmt.Sprintf("✅ To'lov tasdiqlandi: %s. %s", formatMoneyUZS(amount), suffix), nil, nil
}

func (s *Service) debtReject(ctx context.Context, companyID, paymentID, actorUserID string) (string, *partnerOrderComment, error) {
	var status string
	var amount float64
	err := s.repo.pool.QueryRow(ctx, `
		SELECT dpr.status, dpr.amount FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.id = $1 AND de."creditorId" = $2
	`, paymentID, companyID).Scan(&status, &amount)
	if err != nil || status != "PENDING" {
		return "ℹ️ To'lov allaqachon ko'rib chiqilgan yoki mavjud emas.", nil, nil
	}
	_, err = s.repo.pool.Exec(ctx, `UPDATE "DebtPaymentRecord" SET status='REJECTED' WHERE id=$1`, paymentID)
	if err != nil {
		return "", nil, err
	}
	return fmt.Sprintf("⚠️ To'lov rad etildi: %s.", formatMoneyUZS(amount)), nil, nil
}

func (s *Service) partnerAccept(ctx context.Context, companyID, partnerID, actorUserID string) (string, *partnerOrderComment, error) {
	var status string
	err := s.repo.pool.QueryRow(ctx, `SELECT status FROM "Partner" WHERE id=$1 AND "partnerCompanyId"=$2`, partnerID, companyID).Scan(&status)
	if err != nil || status != "PENDING" {
		return "ℹ️ Hamkor so'rovi allaqachon ko'rib chiqilgan.", nil, nil
	}
	_, err = s.repo.pool.Exec(ctx, `UPDATE "Partner" SET status='ACTIVE', "acceptedAt"=NOW() WHERE id=$1`, partnerID)
	return "✅ Hamkorlik so'rovi qabul qilindi.", nil, err
}

func (s *Service) partnerReject(ctx context.Context, companyID, partnerID, actorUserID string) (string, *partnerOrderComment, error) {
	var status string
	err := s.repo.pool.QueryRow(ctx, `SELECT status FROM "Partner" WHERE id=$1 AND "partnerCompanyId"=$2`, partnerID, companyID).Scan(&status)
	if err != nil || status != "PENDING" {
		return "ℹ️ Hamkor so'rovi allaqachon ko'rib chiqilgan.", nil, nil
	}
	_, err = s.repo.pool.Exec(ctx, `UPDATE "Partner" SET status='REJECTED' WHERE id=$1`, partnerID)
	return "⚠️ Hamkorlik so'rovi rad etildi.", nil, err
}

func (s *Service) orderAccept(ctx context.Context, companyID, orderID, actorUserID string) (string, *partnerOrderComment, error) {
	var status string
	err := s.repo.pool.QueryRow(ctx, `SELECT status FROM "B2BOrder" WHERE id=$1 AND "sellerCompanyId"=$2`, orderID, companyID).Scan(&status)
	if err != nil {
		return "ℹ️ Buyurtma topilmadi.", nil, nil
	}
	if status == "REJECTED" || status == "CANCELLED" || status == "COMPLETED" || status == "DISPATCHED" {
		return fmt.Sprintf("ℹ️ Buyurtma holati sababli qabul qilib bo'lmaydi (%s).", status), nil, nil
	}
	_, err = s.repo.pool.Exec(ctx, `UPDATE "B2BOrder" SET status='ACCEPTED' WHERE id=$1`, orderID)
	return "✅ Buyurtma qabul qilindi.", nil, err
}

func (s *Service) orderReject(ctx context.Context, companyID, orderID, actorUserID string) (string, *partnerOrderComment, error) {
	var status string
	err := s.repo.pool.QueryRow(ctx, `SELECT status FROM "B2BOrder" WHERE id=$1 AND "sellerCompanyId"=$2`, orderID, companyID).Scan(&status)
	if err != nil {
		return "ℹ️ Buyurtma topilmadi.", nil, nil
	}
	if status == "COMPLETED" || status == "DISPATCHED" || status == "CANCELLED" {
		return fmt.Sprintf("ℹ️ Buyurtma holati sababli rad etib bo'lmaydi (%s).", status), nil, nil
	}
	_, err = s.repo.pool.Exec(ctx, `UPDATE "B2BOrder" SET status='REJECTED' WHERE id=$1`, orderID)
	return "⚠️ Buyurtma rad etildi.", nil, err
}

func (s *Service) plOrderAccept(ctx context.Context, companyID, batchID, actorUserID string) (string, *partnerOrderComment, error) {
	if err := s.appendPartnerOrderStatusNote(ctx, companyID, batchID, "ACCEPTED", ""); err != nil {
		return "", nil, err
	}
	return "✅ Buyurtma qabul qilindi.", nil, nil
}

func (s *Service) appendPartnerOrderStatusNote(ctx context.Context, companyID, batchID, status, comment string) error {
	var contactID string
	_ = s.repo.pool.QueryRow(ctx, `
		SELECT "contactId" FROM "PartnerLedgerOperation"
		WHERE "companyId"=$1 AND "sourceType"='PARTNER_SALE_ORDER' AND "sourceId"=$2 LIMIT 1
	`, companyID, batchID).Scan(&contactID)
	if contactID != "" {
		_, _ = s.repo.pool.Exec(ctx, `
			INSERT INTO "PartnerLedgerSaleOrderStatus"
				("companyId","contactId","batchId","status","comment","source","updatedById","createdAt","updatedAt")
			VALUES ($1,$2,$3,$4,$5,'TELEGRAM',NULL,NOW(),NOW())
			ON CONFLICT ("companyId","batchId") DO UPDATE SET
				"contactId"=EXCLUDED."contactId", status=EXCLUDED.status, comment=EXCLUDED.comment,
				source=EXCLUDED.source, "updatedAt"=NOW()
		`, companyID, contactID, batchID, status, nullStr(comment))
	}
	line := fmt.Sprintf("[BOT_ORDER] status=%s; at=%s", status, "now")
	if strings.TrimSpace(comment) != "" {
		line = fmt.Sprintf("[BOT_ORDER] status=%s; comment=%s", status, strings.TrimSpace(comment))
	}
	rows, err := s.repo.pool.Query(ctx, `
		SELECT id, notes FROM "PartnerLedgerOperation"
		WHERE "companyId"=$1 AND "sourceType"='PARTNER_SALE_ORDER' AND "sourceId"=$2
	`, companyID, batchID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var notes *string
		if err := rows.Scan(&id, &notes); err != nil {
			return err
		}
		merged := line
		if notes != nil && strings.TrimSpace(*notes) != "" {
			merged = strings.TrimSpace(*notes) + "\n" + line
		}
		_, _ = s.repo.pool.Exec(ctx, `UPDATE "PartnerLedgerOperation" SET notes=$2 WHERE id=$1`, id, merged)
	}
	return rows.Err()
}

func (s *Service) handlePartnerOrderComment(ctx context.Context, chatID, text string) bool {
	s.pendingMu.Lock()
	pending, ok := s.pendingPartnerComment[chatID]
	if ok {
		delete(s.pendingPartnerComment, chatID)
	}
	s.pendingMu.Unlock()
	if !ok {
		return false
	}
	comment := strings.TrimSpace(text)
	if len(comment) < 3 {
		_ = s.tg.sendMessage(ctx, chatID, "Izoh kamida 3 ta belgi bo'lsin.", nil)
		s.pendingMu.Lock()
		s.pendingPartnerComment[chatID] = pending
		s.pendingMu.Unlock()
		return true
	}
	_ = s.appendPartnerOrderStatusNote(ctx, pending.CompanyID, pending.BatchID, pending.Status, comment)
	label := "Qabul qilinmadi"
	if pending.Status == "PARTIAL" {
		label = "Qisman qabul qilindi"
	}
	_ = s.tg.sendMessage(ctx, chatID, fmt.Sprintf("✅ Holat saqlandi: %s\n📝 Izoh: %s", label, comment), nil)
	return true
}

func nullUUID(id string) any {
	if strings.TrimSpace(id) == "" {
		return nil
	}
	return id
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func leaveActionEmployeeName(res map[string]any) string {
	if cu, ok := res["companyUser"].(map[string]any); ok {
		if u, ok := cu["user"].(map[string]any); ok {
			if n, ok := u["fullName"].(string); ok {
				return n
			}
		}
	}
	return "Xodim"
}
