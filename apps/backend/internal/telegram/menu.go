package telegram

import (
	"strings"
)

const (
	menuLink           = "📱 Ulanish / yangilash"
	menuPassword       = "🔑 Parolni tiklash"
	menuTasks          = "📋 Mening vazifalarim"
	menuPosReport      = "📊 POS bugun"
	menuWeb            = "🌐 Veb-ilovani ochish"
	menuHelp           = "ℹ️ Yordam"
	menuLeaveRequest   = "🏖 Dam olish so'rash"
	menuLeavePending   = "📋 Dam olish so'rovlari"
	menuPayroll        = "👥 Xodimlar oylik"
	triggerPassword    = "__TRIGGER_PASSWORD_RESET__"
	triggerLeaveMenu   = "__TRIGGER_LEAVE_MENU__"
	triggerPayrollMenu = "__TRIGGER_PAYROLL__"
)

var staffLeaveRoles = map[string]bool{
	"WORKER": true, "FIELD_WORKER": true, "WAREHOUSE": true, "SALES": true, "ACCOUNTANT": true,
}
var leaveReviewRoles = map[string]bool{"OWNER": true, "MANAGER": true}

func roleCanPosReport(role string) bool {
	switch strings.ToUpper(role) {
	case "OWNER", "MANAGER", "ACCOUNTANT", "SALES":
		return true
	default:
		return false
	}
}

func mainMenuKeyboard(role string) map[string]any {
	r := strings.ToUpper(strings.TrimSpace(role))
	rows := [][]map[string]any{
		{{"text": "📱 Telefon raqamni ulashish", "request_contact": true}},
		{{"text": menuPassword}},
	}
	tasksRow := []map[string]any{{"text": menuTasks}}
	if roleCanPosReport(r) {
		tasksRow = append(tasksRow, map[string]any{"text": menuPosReport})
	}
	rows = append(rows, tasksRow)

	var leaveRow []map[string]any
	if staffLeaveRoles[r] {
		leaveRow = append(leaveRow, map[string]any{"text": menuLeaveRequest})
	}
	if leaveReviewRoles[r] {
		leaveRow = append(leaveRow, map[string]any{"text": menuLeavePending})
	}
	if len(leaveRow) > 0 {
		rows = append(rows, leaveRow)
	}
	if leaveReviewRoles[r] {
		rows = append(rows, []map[string]any{{"text": menuPayroll}})
	}
	rows = append(rows, []map[string]any{{"text": menuWeb}, {"text": menuHelp}})
	return map[string]any{"keyboard": rows, "resize_keyboard": true}
}

func menuWelcomeText(role string) string {
	r := strings.ToUpper(strings.TrimSpace(role))
	lines := []string{
		"Tadbirkor botiga xush kelibsiz.",
		"",
		"Pastdagi menyu:",
		"• Ulanish — bildirishnomalar",
		"• Parolni tiklash",
		"• Mening vazifalarim — ochiq ishlar",
	}
	if roleCanPosReport(r) {
		lines = append(lines, "• POS bugun — kassa hisoboti")
	}
	lines = append(lines, "• Veb-ilova")
	if staffLeaveRoles[r] {
		lines = append(lines, "• Dam olish so'rash")
	}
	if leaveReviewRoles[r] {
		lines = append(lines, "• Dam olish so'rovlari (tasdiqlash)")
		lines = append(lines, "• Xodimlar oylik — maosh, avans, bonus")
	}
	lines = append(lines, "", "Raqamni qo'lda yozmang — faqat tugma.")
	return strings.Join(lines, "\n")
}

func menuHelpText() string {
	return strings.Join([]string{
		"ℹ️ Yordam",
		"",
		"/menu — asosiy menyu",
		"/vazifalar — kutayotgan ishlar",
		"/pos — POS kunlik hisobot",
		"/kompaniya — kompaniya tanlash (bir nechta bo'lsa)",
		"/parol — parolni tiklash",
		"/bekor — jarayonni bekor qilish",
		"/oylik — xodimlar oylik (owner/menejer)",
		"",
		"Bildirishnomalardagi tugmalar (Qabul/Rad) shu chatda ishlaydi.",
	}, "\n")
}

func isMenuButton(text string) bool {
	switch strings.TrimSpace(text) {
	case menuLink, menuPassword, menuTasks, menuPosReport, menuWeb, menuHelp,
		menuLeaveRequest, menuLeavePending, menuPayroll:
		return true
	default:
		return false
	}
}

func (s *Service) webAppURL() string {
	base := strings.TrimSpace(s.cfg.PublicBaseURL)
	if base == "" {
		base = "http://localhost:3000"
	}
	return strings.TrimRight(base, "/") + "/dashboard"
}

func companyPickerMarkup(user *botUser) map[string]any {
	rows := [][]map[string]any{}
	for _, m := range user.Memberships {
		label := m.CompanyName + " (" + m.Role + ")"
		rows = append(rows, []map[string]any{{"text": label, "callback_data": "mc:" + m.CompanyID}})
	}
	return map[string]any{"inline_keyboard": rows}
}
