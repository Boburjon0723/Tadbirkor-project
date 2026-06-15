package telegram

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"
)

type tgUpdate struct {
	UpdateID      int              `json:"update_id"`
	Message       *tgMessage       `json:"message"`
	CallbackQuery *tgCallbackQuery `json:"callback_query"`
}

type tgMessage struct {
	Chat    tgChat     `json:"chat"`
	From    *tgUser    `json:"from"`
	Text    string     `json:"text"`
	Contact *tgContact `json:"contact"`
}

type tgCallbackQuery struct {
	ID      string     `json:"id"`
	Data    string     `json:"data"`
	Message *tgMessage `json:"message"`
	From    *tgUser    `json:"from"`
}

type tgChat struct {
	ID int64 `json:"id"`
}

type tgUser struct {
	ID int64 `json:"id"`
}

type tgContact struct {
	PhoneNumber string `json:"phone_number"`
	UserID      int64  `json:"user_id"`
}

func formatChatID(id int64) string {
	return strconv.FormatInt(id, 10)
}

func (s *Service) processUpdateLocally(ctx context.Context, body []byte) {
	if s.tg == nil {
		return
	}
	var upd tgUpdate
	if err := json.Unmarshal(body, &upd); err != nil {
		log.Printf("telegram: update parse xato: %v", err)
		return
	}
	if upd.CallbackQuery != nil {
		s.handleCallback(ctx, upd.CallbackQuery)
		return
	}
	if upd.Message != nil {
		s.handleMessage(ctx, upd.Message)
	}
}

func (s *Service) handleCallback(ctx context.Context, cb *tgCallbackQuery) {
	data := strings.TrimSpace(cb.Data)
	chatID := ""
	if cb.Message != nil {
		chatID = formatChatID(cb.Message.Chat.ID)
	}
	if chatID == "" {
		return
	}

	linked, _ := s.findLinkedUser(ctx, chatID)
	actorUserID := ""
	if linked != nil {
		actorUserID = linked.ID
	}

	if strings.HasPrefix(data, "ta:") {
		toast, msg := s.processActionCallback(ctx, data, chatID, cb.ID)
		_ = s.tg.answerCallbackQuery(ctx, cb.ID, toast)
		if msg != "" {
			s.replyWithMenu(ctx, chatID, msg, nil)
		}
		return
	}

	if strings.HasPrefix(data, "lr:") {
		toast, msg, markup := "", "", any(nil)
		if s.leaveBot != nil {
			toast, msg, markup = s.leaveBot.handleCallback(ctx, chatID, data, actorUserID)
		} else {
			toast, msg = "Xato", "Dam olish moduli ulanmagan."
		}
		_ = s.tg.answerCallbackQuery(ctx, cb.ID, toast)
		if msg != "" {
			s.replyWithMenu(ctx, chatID, msg, markup)
		}
		return
	}

	if strings.HasPrefix(data, "pr:") {
		toast, msg, markup := "", "", any(nil)
		if s.payrollBot != nil {
			toast, msg, markup = s.payrollBot.handleCallback(ctx, chatID, data, linked)
		} else {
			toast, msg = "Xato", "Oylik moduli ulanmagan."
		}
		_ = s.tg.answerCallbackQuery(ctx, cb.ID, toast)
		if msg != "" {
			s.replyWithMenu(ctx, chatID, msg, markup)
		}
		return
	}

	if strings.HasPrefix(data, "mc:") {
		companyID := strings.TrimPrefix(data, "mc:")
		user, err := s.findLinkedUser(ctx, chatID)
		if err != nil || user == nil {
			_ = s.tg.answerCallbackQuery(ctx, cb.ID, "Avval telefonni ulang")
			return
		}
		if !s.setActiveCompany(chatID, companyID, user) {
			_ = s.tg.answerCallbackQuery(ctx, cb.ID, "Kompaniya topilmadi")
			return
		}
		_ = s.tg.answerCallbackQuery(ctx, cb.ID, "Tanlandi")
		msg, err := s.buildTasksMessage(ctx, chatID)
		if err != nil {
			msg = "Xatolik: " + err.Error()
		}
		s.replyWithMenu(ctx, chatID, msg, nil)
		return
	}
}

func (s *Service) handleMessage(ctx context.Context, msg *tgMessage) {
	chatID := formatChatID(msg.Chat.ID)
	if chatID == "" {
		return
	}

	if msg.Contact != nil && msg.Contact.PhoneNumber != "" {
		if s.handleRegistrationContact(ctx, chatID, msg.Contact.PhoneNumber) {
			return
		}
		if s.handlePasswordResetContact(ctx, chatID, msg.Contact.PhoneNumber) {
			return
		}
		s.handleContact(ctx, chatID, msg)
		return
	}

	text := strings.TrimSpace(msg.Text)
	if text == "" {
		return
	}

	if cmd, ok := parseCommand(text); ok {
		s.handleCommand(ctx, chatID, cmd, text)
		return
	}

	if s.handlePartnerOrderComment(ctx, chatID, text) {
		return
	}

	linked, _ := s.findLinkedUser(ctx, chatID)
	actorUserID := ""
	if linked != nil {
		actorUserID = linked.ID
	}
	if s.payrollBot != nil {
		if handled, reply, markup := s.payrollBot.handleText(ctx, chatID, text, actorUserID); handled {
			s.replyWithMenu(ctx, chatID, reply, markup)
			return
		}
	}

	if isMenuButton(text) {
		message, markup := s.handleMenuButton(ctx, chatID, text)
		if message == triggerPassword {
			s.promptPasswordReset(ctx, chatID, "")
			return
		}
		s.replyWithMenu(ctx, chatID, message, markup)
		return
	}

	if s.reset.isInFlow(chatID) {
		s.handlePasswordResetText(ctx, chatID, text)
		return
	}
}

func parseCommand(text string) (cmd string, ok bool) {
	if !strings.HasPrefix(text, "/") {
		return "", false
	}
	parts := strings.Fields(text)
	if len(parts) == 0 {
		return "", false
	}
	cmd = strings.ToLower(strings.Split(parts[0], "@")[0])
	return cmd, true
}

func (s *Service) handleCommand(ctx context.Context, chatID, cmd, fullText string) {
	switch cmd {
	case "/start":
		s.handleStart(ctx, chatID, fullText)
	case "/menu":
		s.handleMenu(ctx, chatID)
	case "/vazifalar":
		msg, err := s.buildTasksMessage(ctx, chatID)
		if err != nil {
			s.replyWithMenu(ctx, chatID, "Xatolik: "+err.Error(), nil)
		} else {
			s.replyWithMenu(ctx, chatID, msg, nil)
		}
	case "/kompaniya":
		s.handleCompanyPicker(ctx, chatID)
	case "/pos":
		msg, err := s.buildPosReportForChat(ctx, chatID)
		if err != nil {
			s.replyWithMenu(ctx, chatID, "Xatolik: "+err.Error(), nil)
		} else {
			s.replyWithMenu(ctx, chatID, msg, nil)
		}
	case "/parol":
		s.promptPasswordReset(ctx, chatID, "")
	case "/bekor":
		cancelled := false
		if s.reg.getSession(chatID) != nil {
			s.reg.cancelFlow(chatID)
			cancelled = true
		}
		if s.reset.cancelFlow(chatID) {
			cancelled = true
		}
		if s.payrollBot != nil {
			s.payrollBot.cancelSession(chatID)
			cancelled = true
		}
		if cancelled {
			_ = s.tg.sendMessage(ctx, chatID, "Jarayon bekor qilindi.", removeKeyboard())
			s.replyWithMenu(ctx, chatID, "Menyu:", nil)
		}
	case "/oylik":
		if s.payrollBot != nil {
			msg, markup := s.payrollBot.handleMenu(ctx, chatID)
			s.replyWithMenu(ctx, chatID, msg, markup)
		} else {
			s.replyWithMenu(ctx, chatID, "Oylik moduli ulanmagan.", nil)
		}
	}
}

func (s *Service) handleStart(ctx context.Context, chatID, text string) {
	parts := strings.Fields(text)
	payload := ""
	if len(parts) > 1 {
		payload = strings.TrimSpace(parts[1])
	}
	if payload != "" {
		lower := strings.ToLower(payload)
		if lower == "parol" {
			s.promptPasswordReset(ctx, chatID, "")
			return
		}
		if strings.HasPrefix(payload, "reg_") {
			phoneHint, err := s.repo.consumeRegistrationIntent(ctx, strings.TrimPrefix(payload, "reg_"))
			if err != nil {
				_ = s.tg.sendMessage(ctx, chatID, "Xatolik. Keyinroq urinib ko'ring.", nil)
				return
			}
			if phoneHint == nil {
				_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
					"⚠️ Havola muddati o'tgan yoki allaqachon ishlatilgan.",
					"Ilovada qayta ro'yxatdan o'tishni boshlang.",
				}, "\n"), nil)
				return
			}
			sessionCode := strings.TrimPrefix(payload, "reg_")
			hint := ""
			if phoneHint != nil {
				hint = *phoneHint
			}
			s.promptRegistration(ctx, chatID, sessionCode, hint)
			return
		}
		if strings.HasPrefix(payload, "rp_") {
			hint, err := s.repo.consumePasswordResetIntent(ctx, strings.TrimPrefix(payload, "rp_"))
			if err != nil {
				_ = s.tg.sendMessage(ctx, chatID, "Xatolik. Keyinroq urinib ko'ring.", nil)
				return
			}
			if hint == nil {
				_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
					"⚠️ Havola muddati o'tgan yoki allaqachon ishlatilgan.",
					"Veb-saytda qayta «Parolni unutdingizmi» ni bosing.",
				}, "\n"), nil)
				return
			}
			s.promptPasswordReset(ctx, chatID, *hint)
			return
		}
		name, err := s.repo.linkCompanyByStartCode(ctx, chatID, payload)
		if err != nil {
			_ = s.tg.sendMessage(ctx, chatID, err.Error(), nil)
			return
		}
		s.botCtx.invalidateLinkedUser(chatID)
		_ = s.tg.sendMessage(ctx, chatID,
			"✅ «"+name+"» kompaniyasi Telegramga ulandi. Bildirishnomalar shu chatga keladi.",
			removeKeyboard())
		return
	}
	s.handleMenu(ctx, chatID)
}

func (s *Service) handleMenu(ctx context.Context, chatID string) {
	user, _ := s.findLinkedUser(ctx, chatID)
	role := ""
	if user != nil {
		if mem := s.activeMembership(chatID, user); mem != nil {
			role = mem.Role
		}
	}
	kb := s.menuKeyboardForChat(ctx, chatID)
	if user == nil {
		kb = contactOnlyKeyboard()
	}
	_ = s.tg.sendMessage(ctx, chatID, menuWelcomeText(role), kb)
}

func (s *Service) handleContact(ctx context.Context, chatID string, msg *tgMessage) {
	phone := msg.Contact.PhoneNumber
	if msg.Contact.UserID != 0 && msg.From != nil && msg.Contact.UserID != msg.From.ID {
		_ = s.tg.sendMessage(ctx, chatID,
			"Boshqa odamning kontaktini yubormang. Faqat «📱 Telefon raqamni ulashish» tugmasini bosing.",
			contactOnlyKeyboard())
		return
	}

	linked, err := s.repo.linkChatToUserByPhone(ctx, chatID, phone)
	if err == nil {
		s.botCtx.invalidateLinkedUser(chatID)
		lines := []string{
			"✅ Salom, " + linked.FullName + "!",
			"📱 Telefon: " + linked.Phone,
			"👤 Rollar: " + formatRoles(linked.Roles),
		}
		if len(linked.Companies) > 0 {
			lines = append(lines, "🏢 Kompaniyalar: "+strings.Join(linked.Companies, ", "))
		}
		lines = append(lines, "", "Bildirishnomalar shu chatga keladi.", "", "Menyudan «Mening vazifalarim» ni oching.")
		_ = s.tg.sendMessage(ctx, chatID, strings.Join(lines, "\n"), removeKeyboard())
		s.replyWithMenu(ctx, chatID, "Asosiy menyu:", nil)
		return
	}

	contactName, companyName, normPhone, perr := s.repo.linkChatToPartnerByPhone(ctx, chatID, phone)
	if perr == nil {
		_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
			"✅ Salom, " + contactName + "!",
			"🏢 Hamkor kartasi topildi: " + companyName,
			"📱 Telefon: " + normPhone,
			"", "Bildirishnomalar shu chatga keladi.",
		}, "\n"), removeKeyboard())
		return
	}

	userErr := err.Error()
	_ = s.tg.sendMessage(ctx, chatID, strings.Join([]string{
		userErr, "", "Raqamni qo'lda yozmang — faqat tugmani bosing.",
	}, "\n"), contactOnlyKeyboard())
	log.Printf("telegram: contact link failed chat=%s: %v / partner: %v", chatID, err, perr)
}
