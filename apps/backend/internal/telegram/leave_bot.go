package telegram

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
)

type leaveBot struct {
	svc   *Service
	leave *payroll.LeaveService
}

func newLeaveBot(svc *Service, leave *payroll.LeaveService) *leaveBot {
	return &leaveBot{svc: svc, leave: leave}
}

func leaveDaysKeyboard() map[string]any {
	return map[string]any{"inline_keyboard": [][]map[string]any{
		{{"text": "1 kun", "callback_data": "lr:d:1"}, {"text": "2 kun", "callback_data": "lr:d:2"}, {"text": "3 kun", "callback_data": "lr:d:3"}},
		{{"text": "5 kun", "callback_data": "lr:d:5"}, {"text": "7 kun", "callback_data": "lr:d:7"}, {"text": "10 kun", "callback_data": "lr:d:10"}},
	}}
}

func leaveStartKeyboard(days int) map[string]any {
	return map[string]any{"inline_keyboard": [][]map[string]any{
		{{"text": "Bugun", "callback_data": fmt.Sprintf("lr:s:%d:0", days)}, {"text": "Ertaga", "callback_data": fmt.Sprintf("lr:s:%d:1", days)}},
		{{"text": "3 kundan keyin", "callback_data": fmt.Sprintf("lr:s:%d:3", days)}},
		{{"text": "❌ Bekor", "callback_data": "lr:cancel"}},
	}}
}

func (b *leaveBot) handleMenu(ctx context.Context, chatID, text string) (message string, markup any) {
	user, _ := b.svc.findLinkedUser(ctx, chatID)
	if user == nil {
		return "Avval telefon orqali ulaning — «Ulanish» tugmasi.", nil
	}
	mem := b.svc.activeMembership(chatID, user)
	if mem == nil {
		return "Kompaniya tanlanmagan. /kompaniya", nil
	}
	if err := b.leave.AssertPayrollModule(ctx, mem.CompanyID); err != nil {
		return err.Error(), nil
	}
	if strings.TrimSpace(text) == menuLeavePending {
		if !leaveReviewRoles[strings.ToUpper(mem.Role)] {
			return "Bu bo'lim faqat owner va menejer uchun.", nil
		}
		list, err := b.leave.ListLeaveRequests(ctx, mem.CompanyID, user.ID, "PENDING", false)
		if err != nil {
			return "Xatolik: " + err.Error(), nil
		}
		if len(list) == 0 {
			return "Kutilayotgan dam olish so'rovi yo'q.", nil
		}
		lines := []string{fmt.Sprintf("📋 Kutilayotgan so'rovlar: %d", len(list)), ""}
		for i, row := range list {
			if i >= 8 {
				break
			}
			name := leaveEmployeeName(row)
			days, _ := row["daysCount"].(float64)
			start := formatLeaveDate(row["startDate"])
			end := formatLeaveDate(row["endDate"])
			lines = append(lines, fmt.Sprintf("• %s: %.0f kun (%s — %s)", name, days, start, end))
		}
		lines = append(lines, "", "Tasdiqlash/rad — bildirishnomadagi tugmalar yoki veb-ilova.")
		return strings.Join(lines, "\n"), nil
	}
	if !staffLeaveRoles[strings.ToUpper(mem.Role)] {
		return "Dam olish so'rovi faqat xodimlar uchun.", nil
	}
	return strings.Join([]string{"🏖 Dam olish muddati", "", "Necha kun dam olmoqchisiz?"}, "\n"), leaveDaysKeyboard()
}

func (b *leaveBot) handleCallback(ctx context.Context, chatID, data, userID string) (toast, message string, markup any) {
	if data == "lr:cancel" {
		return "Bekor qilindi", "Dam olish so'rovi bekor qilindi.", nil
	}
	user, _ := b.svc.findLinkedUser(ctx, chatID)
	if user == nil {
		return "Ulanmagan", "Avval telefonni ulang.", nil
	}
	mem := b.svc.activeMembership(chatID, user)
	if mem == nil {
		return "Kompaniya yo'q", "/kompaniya — kompaniya tanlang.", nil
	}
	if strings.HasPrefix(data, "lr:d:") {
		days := atoiSafe(strings.TrimPrefix(data, "lr:d:"))
		if days < 1 {
			return "Xato", "Noto'g'ri kun soni.", nil
		}
		return "Tanlandi", fmt.Sprintf("%d kun — boshlanish sanasini tanlang:", days), leaveStartKeyboard(days)
	}
	if strings.HasPrefix(data, "lr:s:") {
		parts := strings.Split(data, ":")
		if len(parts) < 4 {
			return "Xato", "Noto'g'ri ma'lumot.", nil
		}
		days := atoiSafe(parts[2])
		offset := atoiSafe(parts[3])
		if days < 1 {
			return "Xato", "Noto'g'ri kun soni.", nil
		}
		created, err := b.leave.CreateLeaveFromBot(ctx, mem.CompanyID, user.ID, days, offset, "")
		if err != nil {
			return "Xatolik", "❗️ " + err.Error(), nil
		}
		id, _ := created["id"].(string)
		short := id
		if len(short) > 8 {
			short = short[:8] + "…"
		}
		start := time.Now().UTC().AddDate(0, 0, offset)
		end := start.AddDate(0, 0, days-1)
		return "Yuborildi", strings.Join([]string{
			"✅ Dam olish so'rovi yuborildi.",
			fmt.Sprintf("📅 %s — %s (%d kun)", start.Format("02.01.2006"), end.Format("02.01.2006"), days),
			"", "Owner va menejerga xabar borildi.", "ID: " + short,
		}, "\n"), nil
	}
	return "Noma'lum", "Amal topilmadi.", nil
}

func atoiSafe(s string) int {
	var n int
	fmt.Sscanf(strings.TrimSpace(s), "%d", &n)
	return n
}

func leaveEmployeeName(row map[string]any) string {
	if cu, ok := row["companyUser"].(map[string]any); ok {
		if u, ok := cu["user"].(map[string]any); ok {
			if n, ok := u["fullName"].(string); ok {
				return n
			}
		}
	}
	return "Xodim"
}

func formatLeaveDate(v any) string {
	switch t := v.(type) {
	case time.Time:
		return t.Format("02.01.2006")
	case string:
		return t
	default:
		return fmt.Sprint(v)
	}
}
