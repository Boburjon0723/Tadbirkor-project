package telegram

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
)

var monthNamesUz = []string{
	"Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
	"Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
}

type payrollSession struct {
	step          string
	companyUserID string
	year          int
	month         int
	maxAmount     float64
}

type payrollBot struct {
	svc   *Service
	leave *payroll.LeaveService
	data  *payroll.DataService

	mu       sync.Mutex
	sessions map[string]payrollSession
}

func newPayrollBot(svc *Service, leave *payroll.LeaveService, data *payroll.DataService) *payrollBot {
	return &payrollBot{
		svc:      svc,
		leave:    leave,
		data:     data,
		sessions: map[string]payrollSession{},
	}
}

func (b *payrollBot) clearSession(chatID string) {
	b.mu.Lock()
	delete(b.sessions, chatID)
	b.mu.Unlock()
}

func (b *payrollBot) cancelSession(chatID string) {
	b.clearSession(chatID)
}

func currentYearMonth() (year, month int) {
	now := time.Now()
	return now.Year(), int(now.Month())
}

func monthLabel(year, month int) string {
	name := monthNamesUz[month-1]
	if name == "" {
		name = strconv.Itoa(month)
	}
	return fmt.Sprintf("%s %d", name, year)
}

func (b *payrollBot) handleMenu(ctx context.Context, chatID string) (message string, markup any) {
	ctxRes, err := b.resolveMembership(ctx, chatID, nil)
	if err != nil {
		return err.Error(), nil
	}
	b.clearSession(chatID)
	members, err := b.leave.ListCompanyMembers(ctx, ctxRes.membership.CompanyID)
	if err != nil {
		return "Xatolik: " + err.Error(), nil
	}
	if len(members) == 0 {
		return "Oylik ro'yxatida xodim yo'q. Veb-ilovada «Mavjud xodimni qo'shish» dan foydalaning.", nil
	}
	year, month := currentYearMonth()
	return strings.Join([]string{
		fmt.Sprintf("👥 Xodimlar — %s", monthLabel(year, month)),
		"", "Xodimni tanlang:",
	}, "\n"), b.employeeListKeyboard(members, 0)
}

func (b *payrollBot) employeeListKeyboard(members []map[string]any, page int) map[string]any {
	pageSize := 8
	start := page * pageSize
	end := start + pageSize
	if start > len(members) {
		start = 0
	}
	if end > len(members) {
		end = len(members)
	}
	rows := [][]map[string]any{}
	for _, m := range members[start:end] {
		name := memberFullName(m)
		if len(name) > 38 {
			name = name[:38]
		}
		id, _ := m["id"].(string)
		rows = append(rows, []map[string]any{{"text": name, "callback_data": "pr:e:" + id}})
	}
	nav := []map[string]any{}
	if start > 0 {
		nav = append(nav, map[string]any{"text": "◀️", "callback_data": fmt.Sprintf("pr:p:%d", page-1)})
	}
	if end < len(members) {
		nav = append(nav, map[string]any{"text": "▶️", "callback_data": fmt.Sprintf("pr:p:%d", page+1)})
	}
	if len(nav) > 0 {
		rows = append(rows, nav)
	}
	rows = append(rows, []map[string]any{{"text": "❌ Yopish", "callback_data": "pr:cancel"}})
	return map[string]any{"inline_keyboard": rows}
}

func memberFullName(m map[string]any) string {
	if u, ok := m["user"].(map[string]any); ok {
		if n, ok := u["fullName"].(string); ok {
			return n
		}
	}
	return "Xodim"
}

type payrollMembershipCtx struct {
	user       *botUser
	membership *botMembership
}

func (b *payrollBot) resolveMembership(ctx context.Context, chatID string, linked *botUser) (*payrollMembershipCtx, error) {
	user := linked
	if user == nil {
		u, _ := b.svc.findLinkedUser(ctx, chatID)
		user = u
	}
	if user == nil {
		return nil, fmt.Errorf("avval telefon orqali ulaning — «Ulanish» tugmasi")
	}
	mem := b.svc.activeMembership(chatID, user)
	if mem == nil {
		return nil, fmt.Errorf("/kompaniya — kompaniya tanlang")
	}
	if !leaveReviewRoles[strings.ToUpper(mem.Role)] {
		return nil, fmt.Errorf("bu bo'lim faqat owner va menejer uchun")
	}
	if err := b.leave.AssertPayrollModule(ctx, mem.CompanyID); err != nil {
		return nil, err
	}
	return &payrollMembershipCtx{user: user, membership: mem}, nil
}

type employeePayrollState struct {
	year, month          int
	member               map[string]any
	baseSalary           float64
	currency             string
	advancesTotal        float64
	bonus                float64
	leaveDays            int
	leaveLines           []string
	paidQuota            int
	salaryCap            float64
	salaryClosed         bool
}

func (b *payrollBot) loadEmployeePayrollState(ctx context.Context, companyID, companyUserID string) (*employeePayrollState, error) {
	year, month := currentYearMonth()
	member, err := b.leave.GetRosterMember(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	comp, err := b.data.GetActiveCompensation(ctx, companyID, companyUserID)
	baseSalary := 0.0
	currency := "UZS"
	if err == nil && comp != nil {
		baseSalary, _ = comp["baseSalary"].(float64)
		if c, ok := comp["currency"].(string); ok && c != "" {
			currency = c
		}
	}
	advancesTotal, _ := b.data.SumAdvances(ctx, companyID, companyUserID, year, month)
	settlement, _ := b.data.GetSettlement(ctx, companyID, companyUserID, year, month, baseSalary)
	bonus := 0.0
	if settlement != nil {
		bonus, _ = settlement["bonus"].(float64)
	}
	leaves, _ := b.leave.ListApprovedLeaveDays(ctx, companyID, companyUserID, year, month)
	leaveDays := 0
	leaveLines := []string{}
	for _, l := range leaves {
		start, _ := l["startDate"].(time.Time)
		end, _ := l["endDate"].(time.Time)
		days := countLeaveWeekdaysInMonthBot(start, end, year, month)
		leaveDays += days
		leaveLines = append(leaveLines, fmt.Sprintf("  • %s — %s (%d kun)", formatDateUz(start), formatDateUz(end), days))
	}
	profile, _ := b.leave.GetPayrollProfile(ctx, companyID, companyUserID)
	paidQuota := 0
	if profile != nil {
		if q, ok := profile["monthlyPaidLeaveQuota"].(float64); ok {
			paidQuota = int(q)
		} else if q, ok := profile["monthlyPaidLeaveQuota"].(int); ok {
			paidQuota = q
		}
	}
	excessLeave := leaveDays - paidQuota
	if excessLeave < 0 {
		excessLeave = 0
	}
	wm, err := b.leave.GetWorkMonthForBot(ctx, companyID, companyUserID, year, month)
	if err != nil {
		return nil, err
	}
	totalDays, _ := wm["totalDays"].(int)
	workedRecord, _ := wm["workedDays"].(int)
	isManual, _ := wm["isManual"].(bool)
	workedMode, _ := wm["workedDaysMode"].(string)
	workedForCap := payroll.ComputeWorkedDaysForSalaryCapExported(totalDays, workedRecord, excessLeave, isManual, workedMode)
	salaryCap := payroll.ComputeEffectiveSalaryCapExported(baseSalary, totalDays, workedForCap)
	salaryClosed := baseSalary > 0 && advancesTotal >= salaryCap && salaryCap > 0
	return &employeePayrollState{
		year: year, month: month, member: member,
		baseSalary: baseSalary, currency: currency,
		advancesTotal: advancesTotal, bonus: bonus,
		leaveDays: leaveDays, leaveLines: leaveLines, paidQuota: paidQuota,
		salaryCap: salaryCap, salaryClosed: salaryClosed,
	}, nil
}

func countLeaveWeekdaysInMonthBot(start, end time.Time, year, month int) int {
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	a := start
	if a.Before(monthStart) {
		a = monthStart
	}
	b := end
	if b.After(monthEnd) {
		b = monthEnd
	}
	count := 0
	for d := a; !d.After(b); d = d.AddDate(0, 0, 1) {
		wd := d.Weekday()
		if wd != time.Saturday && wd != time.Sunday {
			count++
		}
	}
	return count
}

func formatDateUz(t time.Time) string {
	return t.Format("02.01.2006")
}

func (b *payrollBot) buildEmployeeCard(ctx context.Context, companyID, companyUserID string) (message string, markup map[string]any, salaryCap, advancesTotal, baseSalary float64, err error) {
	state, err := b.loadEmployeePayrollState(ctx, companyID, companyUserID)
	if err != nil {
		return "", nil, 0, 0, 0, err
	}
	position := "—"
	department := "—"
	profile, _ := b.leave.GetPayrollProfile(ctx, companyID, companyUserID)
	if profile != nil {
		if p, ok := profile["position"].(string); ok && strings.TrimSpace(p) != "" {
			position = strings.TrimSpace(p)
		}
		if d, ok := profile["department"].(string); ok && strings.TrimSpace(d) != "" {
			department = strings.TrimSpace(d)
		}
	}
	lines := []string{
		fmt.Sprintf("👤 %s", memberFullName(state.member)),
		fmt.Sprintf("📌 %s · %s", position, department),
		"",
		fmt.Sprintf("💰 Oylik: %s%s", formatMoneyUZS(state.baseSalary), currencySuffix(state.currency)),
		fmt.Sprintf("📅 %s", monthLabel(state.year, state.month)),
		fmt.Sprintf("• Avanslar: %s", formatMoneyUZS(state.advancesTotal)),
	}
	if state.bonus > 0 {
		lines = append(lines, fmt.Sprintf("• Bonus: %s", formatMoneyUZS(state.bonus)))
	}
	quotaSuffix := ""
	if state.paidQuota > 0 {
		quotaSuffix = fmt.Sprintf(" / limit %d", state.paidQuota)
	}
	lines = append(lines, fmt.Sprintf("• Dam olish (tasdiq): %d kun%s", state.leaveDays, quotaSuffix))
	if len(state.leaveLines) > 0 {
		lines = append(lines, "", "Dam olish sanalari:")
		lines = append(lines, state.leaveLines...)
		if len(state.leaveLines) > 5 {
			lines = append(lines, fmt.Sprintf("  … va yana %d ta", len(state.leaveLines)-5))
		}
	}
	lines = append(lines, "")
	if state.salaryClosed {
		lines = append(lines, "✅ Oylik to'liq to'langan (avanslar limitga yetdi)")
	} else if state.baseSalary > 0 {
		lines = append(lines, fmt.Sprintf("📊 Avans qoldiq: %s", formatMoneyUZS(max(0, state.salaryCap-state.advancesTotal))))
	} else {
		lines = append(lines, "⚠️ Oylik maosh belgilanmagan")
	}
	return strings.Join(lines, "\n"), b.employeeDetailKeyboard(companyUserID, state.baseSalary > 0, state.salaryClosed),
		state.salaryCap, state.advancesTotal, state.baseSalary, nil
}

func currencySuffix(currency string) string {
	if strings.ToUpper(currency) != "UZS" && currency != "" {
		return " (" + currency + ")"
	}
	return ""
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func (b *payrollBot) employeeDetailKeyboard(companyUserID string, hasSalary, salaryClosed bool) map[string]any {
	rows := [][]map[string]any{}
	if hasSalary && !salaryClosed {
		rows = append(rows, []map[string]any{{"text": "💵 Avans/To'lov", "callback_data": "pr:a:" + companyUserID}})
	}
	if hasSalary {
		rows = append(rows, []map[string]any{{"text": "🎁 Bonus", "callback_data": "pr:b:" + companyUserID}})
	}
	rows = append(rows, []map[string]any{
		{"text": "◀️ Ro'yxat", "callback_data": "pr:list"},
		{"text": "❌", "callback_data": "pr:cancel"},
	})
	return map[string]any{"inline_keyboard": rows}
}

func (b *payrollBot) handleCallback(ctx context.Context, chatID, data string, linked *botUser) (toast, message string, markup any) {
	if data == "pr:cancel" {
		b.clearSession(chatID)
		return "Yopildi", "Amal bekor qilindi.", nil
	}
	if data == "pr:list" {
		msg, kb := b.handleMenu(ctx, chatID)
		return "Ro'yxat", msg, kb
	}
	ctxRes, err := b.resolveMembership(ctx, chatID, linked)
	if err != nil {
		return "Xato", err.Error(), nil
	}
	companyID := ctxRes.membership.CompanyID

	if strings.HasPrefix(data, "pr:p:") {
		page := atoiSafe(strings.TrimPrefix(data, "pr:p:"))
		members, err := b.leave.ListCompanyMembers(ctx, companyID)
		if err != nil {
			return "Xato", err.Error(), nil
		}
		year, month := currentYearMonth()
		return "Sahifa", fmt.Sprintf("👥 Xodimlar — %s", monthLabel(year, month)), b.employeeListKeyboard(members, page)
	}
	if strings.HasPrefix(data, "pr:e:") {
		companyUserID := strings.TrimPrefix(data, "pr:e:")
		msg, kb, _, _, _, err := b.buildEmployeeCard(ctx, companyID, companyUserID)
		if err != nil {
			return "Xato", err.Error(), nil
		}
		return "Xodim", msg, kb
	}
	if strings.HasPrefix(data, "pr:a:") {
		companyUserID := strings.TrimPrefix(data, "pr:a:")
		state, err := b.loadEmployeePayrollState(ctx, companyID, companyUserID)
		if err != nil {
			return "Xato", err.Error(), nil
		}
		remaining := max(0, state.salaryCap-state.advancesTotal)
		kb := b.employeeDetailKeyboard(companyUserID, state.baseSalary > 0, state.salaryClosed)
		if remaining <= 0 {
			return "To'langan", "Oylik allaqachon to'liq to'langan.", kb
		}
		b.mu.Lock()
		b.sessions[chatID] = payrollSession{
			step: "advance_amount", companyUserID: companyUserID,
			year: state.year, month: state.month, maxAmount: remaining,
		}
		b.mu.Unlock()
		return "Avans", strings.Join([]string{
			"💵 Avans / oylik to'lov", "",
			fmt.Sprintf("Maksimal: %s", formatMoneyUZS(remaining)),
			"Summani yozing (faqat raqam, masalan 500000):", "", "Bekor: /bekor",
		}, "\n"), nil
	}
	if strings.HasPrefix(data, "pr:b:") {
		companyUserID := strings.TrimPrefix(data, "pr:b:")
		year, month := currentYearMonth()
		b.mu.Lock()
		b.sessions[chatID] = payrollSession{
			step: "bonus_amount", companyUserID: companyUserID, year: year, month: month,
		}
		b.mu.Unlock()
		return "Bonus", strings.Join([]string{
			"🎁 Bonus berish", "", "Summani yozing (faqat raqam):", "Bekor: /bekor",
		}, "\n"), nil
	}
	return "Noma'lum", "Amal topilmadi.", nil
}

func (b *payrollBot) handleText(ctx context.Context, chatID, text, actorUserID string) (handled bool, reply string, markup any) {
	b.mu.Lock()
	session, ok := b.sessions[chatID]
	b.mu.Unlock()
	if !ok {
		return false, "", nil
	}
	ctxRes, err := b.resolveMembership(ctx, chatID, nil)
	if err != nil {
		b.clearSession(chatID)
		return true, err.Error(), nil
	}
	amount := parseAmount(text)
	if amount <= 0 {
		return true, "Noto'g'ri summa. Faqat musbat raqam kiriting.", nil
	}
	if session.step == "advance_amount" {
		if amount > session.maxAmount {
			return true, fmt.Sprintf("Limitdan oshdi. Maksimal: %s", formatMoneyUZS(session.maxAmount)), nil
		}
		result, err := b.data.AddAdvance(ctx, ctxRes.membership.CompanyID, actorUserID, payroll.AddPayrollAdvanceInput{
			CompanyUserID: session.companyUserID,
			Year:          session.year,
			Month:         session.month,
			Amount:        amount,
			Reason:        "Telegram bot orqali avans",
		})
		b.clearSession(chatID)
		if err != nil {
			return true, "❗️ " + err.Error(), nil
		}
		paid := ""
		if done, _ := result["paymentCompleted"].(bool); done {
			paid = "\n\n✅ Oylik to'liq to'langan deb belgilandi."
		}
		return true, fmt.Sprintf("✅ Avans saqlandi: %s%s", formatMoneyUZS(amount), paid), nil
	}
	if session.step == "bonus_amount" {
		reason := "Telegram bot orqali bonus"
		result, err := b.data.AddBonus(ctx, ctxRes.membership.CompanyID, actorUserID, payroll.AddPayrollBonusInput{
			CompanyUserID: session.companyUserID,
			Year:          session.year,
			Month:         session.month,
			Amount:        amount,
			Reason:        &reason,
		})
		b.clearSession(chatID)
		if err != nil {
			return true, "❗️ " + err.Error(), nil
		}
		bonusTotal, _ := result["bonusTotal"].(float64)
		return true, fmt.Sprintf("✅ Bonus qo'shildi: %s\nJami bonus (oy): %s",
			formatMoneyUZS(amount), formatMoneyUZS(bonusTotal)), nil
	}
	return false, "", nil
}

func parseAmount(text string) float64 {
	s := strings.ReplaceAll(strings.TrimSpace(text), " ", "")
	s = strings.ReplaceAll(s, ",", ".")
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
