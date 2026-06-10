package telegram

import (
	"context"
	"strings"
)

func (s *Service) menuKeyboardForChat(ctx context.Context, chatID string) map[string]any {
	user, _ := s.findLinkedUser(ctx, chatID)
	role := ""
	if user != nil {
		if mem := s.activeMembership(chatID, user); mem != nil {
			role = mem.Role
		}
	}
	return mainMenuKeyboard(role)
}

func (s *Service) handleMenuButton(ctx context.Context, chatID, text string) (message string, markup any) {
	normalized := strings.TrimSpace(text)
	switch normalized {
	case menuLink:
		return strings.Join([]string{
			"Telefonni ulash uchun tugmani bosing.",
			"Tizimdagi profil raqami bilan mos kelishi kerak.",
		}, "\n"), contactOnlyKeyboard()
	case menuPassword:
		return triggerPassword, nil
	case menuTasks:
		msg, err := s.buildTasksMessage(ctx, chatID)
		if err != nil {
			return "Xatolik: " + err.Error(), nil
		}
		return msg, nil
	case menuPosReport:
		msg, err := s.buildPosReportForChat(ctx, chatID)
		if err != nil {
			return "Xatolik: " + err.Error(), nil
		}
		return msg, nil
	case menuWeb:
		url := s.webAppURL()
		user, _ := s.findLinkedUser(ctx, chatID)
		if user != nil {
			return strings.Join([]string{"🌐 Veb-ilova:", url, "", "Login bilan kiring."}, "\n"), nil
		}
		return strings.Join([]string{"🌐 Veb-ilova:", url, "", "Avval botda telefonni ulang."}, "\n"), nil
	case menuHelp:
		return menuHelpText(), nil
	case menuLeaveRequest, menuLeavePending:
		if s.leaveBot != nil {
			return s.leaveBot.handleMenu(ctx, chatID, normalized)
		}
		return "Dam olish moduli ulanmagan.", nil
	case menuPayroll:
		if s.payrollBot != nil {
			return s.payrollBot.handleMenu(ctx, chatID)
		}
		return "Oylik moduli ulanmagan.", nil
	default:
		user, _ := s.findLinkedUser(ctx, chatID)
		role := ""
		if user != nil {
			if mem := s.activeMembership(chatID, user); mem != nil {
				role = mem.Role
			}
		}
		return menuWelcomeText(role), mainMenuKeyboard(role)
	}
}

func (s *Service) buildPosReportForChat(ctx context.Context, chatID string) (string, error) {
	user, err := s.findLinkedUser(ctx, chatID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "Avval telefon orqali ulaning — «Ulanish» tugmasi.", nil
	}
	mem := s.activeMembership(chatID, user)
	if mem == nil {
		return "Kompaniya topilmadi.", nil
	}
	if !roleCanPosReport(mem.Role) {
		return "POS hisoboti uchun ruxsat yo'q (OWNER, MANAGER, ACCOUNTANT, SALES).", nil
	}
	enabled, err := s.repo.isPosModuleEnabled(ctx, mem.CompanyID)
	if err != nil {
		return "", err
	}
	if !enabled {
		return "POS moduli kompaniyada o'chirilgan. Sozlamalar → Modullar.", nil
	}
	report, err := s.repo.buildPosTodayReport(ctx, mem.CompanyID)
	if err != nil {
		return "", err
	}
	return s.formatProfileBlock(chatID, user) + "\n\n" + report, nil
}

func (s *Service) handleCompanyPicker(ctx context.Context, chatID string) bool {
	user, err := s.findLinkedUser(ctx, chatID)
	if err != nil || user == nil {
		_ = s.tg.sendMessage(ctx, chatID, "Avval telefonni ulaning.", s.menuKeyboardForChat(ctx, chatID))
		return true
	}
	if len(user.Memberships) <= 1 {
		_ = s.tg.sendMessage(ctx, chatID, "Sizda bitta kompaniya — tanlash shart emas.", s.menuKeyboardForChat(ctx, chatID))
		return true
	}
	lines := []string{"Kompaniyani tanlang:", ""}
	for _, m := range user.Memberships {
		lines = append(lines, "• "+m.CompanyName+" ("+m.Role+")")
	}
	_ = s.tg.sendMessage(ctx, chatID, strings.Join(lines, "\n"), companyPickerMarkup(user))
	return true
}

func (s *Service) replyWithMenu(ctx context.Context, chatID, text string, extraMarkup any) {
	markup := extraMarkup
	if markup == nil {
		markup = s.menuKeyboardForChat(ctx, chatID)
	}
	_ = s.tg.sendMessage(ctx, chatID, text, markup)
}
