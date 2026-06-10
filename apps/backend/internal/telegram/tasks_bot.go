package telegram

import (
	"context"
	"strconv"
	"strings"
)

func (s *Service) buildTasksMessage(ctx context.Context, chatID string) (string, error) {
	user, err := s.findLinkedUser(ctx, chatID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return strings.Join([]string{
			"Avval telefon orqali ulaning.",
			"«📱 Ulanish / yangilash» tugmasini bosing.",
		}, "\n"), nil
	}
	mem := s.activeMembership(chatID, user)
	if mem == nil {
		return "Kompaniya topilmadi. Administrator bilan bog'laning.", nil
	}

	lines := []string{
		s.formatProfileBlock(chatID, user),
		"",
		"📋 Mening vazifalarim",
		"",
	}

	pending, err := s.repo.countPendingTelegramActions(ctx, chatID, mem.CompanyID)
	if err != nil {
		return "", err
	}
	if len(pending) > 0 {
		lines = append(lines, "🔔 Botdagi kutayotgan tugmalar:")
		for _, label := range pending {
			lines = append(lines, "• "+label)
		}
		lines = append(lines, "")
	}

	mods, err := s.repo.getEnabledModules(ctx, mem.CompanyID)
	if err != nil {
		return "", err
	}
	counts := []string{}
	role := strings.ToUpper(mem.Role)

	if roleCanDebt(role) && mods["DEBT"] {
		if n, _ := s.repo.countPendingDebtPayments(ctx, mem.CompanyID); n > 0 {
			counts = append(counts, "💰 Qarz to'lovi tasdiqlash: "+itoa(n)+" ta")
		}
	}
	if roleCanB2b(role) && mods["B2B"] {
		if n, _ := s.repo.countSentB2BOrders(ctx, mem.CompanyID); n > 0 {
			counts = append(counts, "📦 Yangi B2B buyurtma: "+itoa(n)+" ta")
		}
	}
	if roleCanPartner(role) && mods["PARTNERS"] {
		if n, _ := s.repo.countPendingPartners(ctx, mem.CompanyID); n > 0 {
			counts = append(counts, "🤝 Hamkor so'rovi: "+itoa(n)+" ta")
		}
	}
	if roleCanField(role) && mods["FIELD_SERVICE"] {
		if n, _ := s.repo.countReportedFieldTasks(ctx, mem.CompanyID); n > 0 {
			counts = append(counts, "🌾 Dala hisoboti tasdiqlash: "+itoa(n)+" ta")
		}
	}

	if len(counts) > 0 {
		lines = append(lines, "Tizimdagi ochiq ishlar:")
		for _, c := range counts {
			lines = append(lines, "• "+c)
		}
		lines = append(lines, "", "Batafsil — veb-ilovada «Mening vazifalarim» bo'limi.")
	} else if len(pending) == 0 {
		lines = append(lines, "✅ Hozircha kutayotgan vazifa yo'q.")
	}
	lines = append(lines, "", "Yangi bildirishnoma kelganda shu yerda tugmalar paydo bo'ladi.")
	return strings.Join(lines, "\n"), nil
}

func roleCanDebt(role string) bool {
	return role == "OWNER" || role == "MANAGER" || role == "ACCOUNTANT"
}
func roleCanB2b(role string) bool {
	return role == "OWNER" || role == "MANAGER" || role == "SALES"
}
func roleCanPartner(role string) bool {
	return role == "OWNER" || role == "MANAGER"
}
func roleCanField(role string) bool {
	return role == "OWNER" || role == "MANAGER"
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
