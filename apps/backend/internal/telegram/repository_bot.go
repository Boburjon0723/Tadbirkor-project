package telegram

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
	"github.com/tadbirkor/axis-erp/backend/pkg/tashkent"
)

func (r *Repository) findLinkedBotUser(ctx context.Context, chatID string) (*botUser, error) {
	var u botUser
	var phoneVal *string
	err := r.pool.QueryRow(ctx, `
		SELECT id, "fullName", login, phone FROM "User" WHERE "telegramChatId" = $1
	`, chatID).Scan(&u.ID, &u.FullName, &u.Login, &phoneVal)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.Phone = phoneVal

	rows, err := r.pool.Query(ctx, `
		SELECT cu."companyId", c.name, UPPER(cu.role)
		FROM "CompanyUser" cu
		JOIN "Company" c ON c.id = cu."companyId"
		WHERE cu."userId" = $1 AND c.status != 'archived'
		ORDER BY cu."createdAt" ASC
	`, u.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var m botMembership
		if err := rows.Scan(&m.CompanyID, &m.CompanyName, &m.Role); err != nil {
			return nil, err
		}
		u.Memberships = append(u.Memberships, m)
	}
	return &u, rows.Err()
}

func (r *Repository) getEnabledModules(ctx context.Context, companyID string) (map[string]bool, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT UPPER(m.key)
		FROM "CompanyFeature" cf
		JOIN "Feature" f ON f.id = cf."featureId"
		JOIN "Module" m ON m.id = f."moduleId"
		WHERE cf."companyId" = $1 AND cf.enabled = true
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	mods := map[string]bool{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		mods[key] = true
	}
	if len(mods) == 0 {
		for _, k := range []string{"WAREHOUSE", "B2B", "PARTNERS", "DEBT", "POS", "FIELD_SERVICE", "EMPLOYEES"} {
			mods[k] = true
		}
	}
	return mods, rows.Err()
}

func (r *Repository) isPosModuleEnabled(ctx context.Context, companyID string) (bool, error) {
	mods, err := r.getEnabledModules(ctx, companyID)
	if err != nil {
		return false, err
	}
	if len(mods) == 0 {
		return true, nil
	}
	return mods["POS"], nil
}

func (r *Repository) countPendingTelegramActions(ctx context.Context, chatID, companyID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT "actionKey" FROM "TelegramActionRecord"
		WHERE "chatId" = $1 AND "companyId" = $2 AND status = 'PENDING'
		ORDER BY "createdAt" DESC LIMIT 8
	`, chatID, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	labels := map[string]string{
		"DEBT_CONFIRM": "Qarz to'lovi — qabul qilish", "DEBT_REJECT": "Qarz to'lovi — rad etish",
		"ORDER_ACCEPT": "B2B buyurtma — qabul", "ORDER_REJECT": "B2B buyurtma — rad",
		"PARTNER_ACCEPT": "Hamkor — qabul", "PARTNER_REJECT": "Hamkor — rad",
		"FIELD_APPROVE": "Dala hisoboti — tasdiq", "FIELD_REJECT": "Dala hisoboti — rad",
	}
	out := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		if l, ok := labels[key]; ok {
			out = append(out, l)
		} else {
			out = append(out, key)
		}
	}
	return out, rows.Err()
}

func (r *Repository) countPendingDebtPayments(ctx context.Context, companyID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.status = 'PENDING' AND de."creditorId" = $1
	`, companyID).Scan(&n)
	return n, err
}

func (r *Repository) countSentB2BOrders(ctx context.Context, companyID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "B2BOrder" WHERE "sellerCompanyId" = $1 AND status = 'SENT'
	`, companyID).Scan(&n)
	return n, err
}

func (r *Repository) countPendingPartners(ctx context.Context, companyID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Partner" WHERE "partnerCompanyId" = $1 AND status = 'PENDING'
	`, companyID).Scan(&n)
	return n, err
}

func (r *Repository) countReportedFieldTasks(ctx context.Context, companyID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "FieldTask" WHERE "companyId" = $1 AND status = 'REPORTED'
	`, companyID).Scan(&n)
	return n, err
}

type posTodayStats struct {
	CheckCount  int
	Total       float64
	Discount    float64
	TotalQty    float64
	VoidedCount int
	ByMethod    map[string]float64
	TopProducts []struct {
		Name string
		Qty  float64
	}
	DateLabel string
}

func (r *Repository) buildPosTodayReport(ctx context.Context, companyID string) (string, error) {
	dr := tashkent.DayRangeNow()
	stats, err := r.posTodayStats(ctx, companyID, dr.Start, dr.End)
	if err != nil {
		return "", err
	}
	stats.DateLabel = dr.DateLabel
	return formatPosReport(stats), nil
}

func (r *Repository) posTodayStats(ctx context.Context, companyID string, start, end time.Time) (*posTodayStats, error) {
	s := &posTodayStats{ByMethod: map[string]float64{"CASH": 0, "CARD": 0, "CREDIT": 0, "OTHER": 0}}

	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM("totalAmount"),0), COALESCE(SUM("discountAmount"),0)
		FROM "PosSale"
		WHERE "companyId" = $1 AND status = 'COMPLETED'
		  AND (
		    ("completedAt" >= $2 AND "completedAt" <= $3)
		    OR ("completedAt" IS NULL AND "createdAt" >= $2 AND "createdAt" <= $3)
		  )
	`, companyID, start, end).Scan(&s.CheckCount, &s.Total, &s.Discount)
	if err != nil {
		return nil, err
	}

	_ = r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM "PosSale"
		WHERE "companyId" = $1 AND status = 'VOIDED' AND "createdAt" >= $2 AND "createdAt" <= $3
	`, companyID, start, end).Scan(&s.VoidedCount)

	payRows, err := r.pool.Query(ctx, `
		SELECT pp.method, pp.amount FROM "PosPayment" pp
		JOIN "PosSale" ps ON ps.id = pp."saleId"
		WHERE ps."companyId" = $1 AND ps.status = 'COMPLETED'
		  AND (
		    (ps."completedAt" >= $2 AND ps."completedAt" <= $3)
		    OR (ps."completedAt" IS NULL AND ps."createdAt" >= $2 AND ps."createdAt" <= $3)
		  )
	`, companyID, start, end)
	if err != nil {
		return nil, err
	}
	defer payRows.Close()
	for payRows.Next() {
		var method string
		var amount float64
		if err := payRows.Scan(&method, &amount); err != nil {
			return nil, err
		}
		key := strings.ToUpper(method)
		if key != "CASH" && key != "CARD" && key != "CREDIT" {
			key = "OTHER"
		}
		s.ByMethod[key] += amount
	}

	_ = r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(psi.quantity),0) FROM "PosSaleItem" psi
		JOIN "PosSale" ps ON ps.id = psi."saleId"
		WHERE ps."companyId" = $1 AND ps.status = 'COMPLETED'
		  AND (
		    (ps."completedAt" >= $2 AND ps."completedAt" <= $3)
		    OR (ps."completedAt" IS NULL AND ps."createdAt" >= $2 AND ps."createdAt" <= $3)
		  )
	`, companyID, start, end).Scan(&s.TotalQty)

	topRows, err := r.pool.Query(ctx, `
		SELECT psi."productNameSnapshot", SUM(psi.quantity) AS qty
		FROM "PosSaleItem" psi
		JOIN "PosSale" ps ON ps.id = psi."saleId"
		WHERE ps."companyId" = $1 AND ps.status = 'COMPLETED'
		  AND (
		    (ps."completedAt" >= $2 AND ps."completedAt" <= $3)
		    OR (ps."completedAt" IS NULL AND ps."createdAt" >= $2 AND ps."createdAt" <= $3)
		  )
		GROUP BY psi."productNameSnapshot"
		ORDER BY qty DESC LIMIT 8
	`, companyID, start, end)
	if err != nil {
		return nil, err
	}
	defer topRows.Close()
	for topRows.Next() {
		var name string
		var qty float64
		if err := topRows.Scan(&name, &qty); err != nil {
			return nil, err
		}
		s.TopProducts = append(s.TopProducts, struct {
			Name string
			Qty  float64
		}{name, qty})
	}
	return s, topRows.Err()
}

func formatMoneyUZS(v float64) string {
	n := int64(v + 0.5)
	return fmt.Sprintf("%s so'm", formatIntComma(n))
}

func formatIntComma(n int64) string {
	s := fmt.Sprintf("%d", n)
	if n < 0 {
		s = s[1:]
	}
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	parts = append([]string{s}, parts...)
	out := strings.Join(parts, " ")
	if n < 0 {
		return "-" + out
	}
	return out
}

func formatQty(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", v), "0"), ".")
}

func formatPosReport(s *posTodayStats) string {
	lines := []string{
		fmt.Sprintf("📊 POS — bugun (%s, Toshkent)", s.DateLabel),
		"",
		fmt.Sprintf("🧾 Cheklar: %d ta", s.CheckCount),
		fmt.Sprintf("💰 Jami savdo: %s", formatMoneyUZS(s.Total)),
	}
	if s.Discount > 0 {
		lines = append(lines, fmt.Sprintf("🏷 Chegirma: %s", formatMoneyUZS(s.Discount)))
	}
	lines = append(lines, "", "💳 To'lov turlari:")
	if s.ByMethod["CASH"] > 0 {
		lines = append(lines, "• Naqd: "+formatMoneyUZS(s.ByMethod["CASH"]))
	}
	if s.ByMethod["CARD"] > 0 {
		lines = append(lines, "• Karta: "+formatMoneyUZS(s.ByMethod["CARD"]))
	}
	if s.ByMethod["CREDIT"] > 0 {
		lines = append(lines, "• Nasiya: "+formatMoneyUZS(s.ByMethod["CREDIT"]))
	}
	if s.ByMethod["OTHER"] > 0 {
		lines = append(lines, "• Boshqa: "+formatMoneyUZS(s.ByMethod["OTHER"]))
	}
	if s.CheckCount == 0 {
		lines = append(lines, "• Bugun yakunlangan savdo yo'q")
	}
	lines = append(lines, "", fmt.Sprintf("📦 Jami sotilgan (pozitsiya): %s dona", formatQty(s.TotalQty)))
	if len(s.TopProducts) > 0 {
		lines = append(lines, "", "🔝 Ko'p sotilgan mahsulotlar:")
		for _, row := range s.TopProducts {
			lines = append(lines, fmt.Sprintf("• %s — %s", row.Name, formatQty(row.Qty)))
		}
	}
	if s.VoidedCount > 0 {
		lines = append(lines, "", fmt.Sprintf("⚠️ Bekor qilingan cheklar: %d ta", s.VoidedCount))
	}
	lines = append(lines, "", "Batafsil — veb-ilovada POS bo'limi.")
	return strings.Join(lines, "\n")
}

func (r *Repository) findUserByPhone(ctx context.Context, phoneRaw string) (id, login, fullName string, passwordHash *string, err error) {
	normalized := phone.NormalizeUzPhone(phoneRaw)
	if normalized == "" {
		return "", "", "", nil, errBadRequest("Telefon formati noto'g'ri")
	}
	err = r.pool.QueryRow(ctx, `
		SELECT id, login, "fullName", "passwordHash" FROM "User" WHERE phone = $1
	`, normalized).Scan(&id, &login, &fullName, &passwordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", nil, errBadRequest("Bu telefon tizimda topilmadi. Administrator yoki jamoa sozlamalaridagi raqamni tekshiring.")
	}
	return id, login, fullName, passwordHash, err
}

func (r *Repository) consumePasswordResetIntent(ctx context.Context, code string) (loginHint *string, err error) {
	now := time.Now()
	var id, login string
	err = r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(login, '') FROM "TelegramBotIntent"
		WHERE code = $1 AND intent = 'PASSWORD_RESET' AND "usedAt" IS NULL AND "expiresAt" > $2
	`, strings.TrimSpace(code), now).Scan(&id, &login)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_, err = r.pool.Exec(ctx, `UPDATE "TelegramBotIntent" SET "usedAt" = $1 WHERE id = $2`, now, id)
	if err != nil {
		return nil, err
	}
	if login != "" {
		return &login, nil
	}
	empty := ""
	return &empty, nil
}

func (r *Repository) consumeRegistrationIntent(ctx context.Context, code string) (phoneHint *string, err error) {
	now := time.Now()
	var id, phone string
	err = r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(login, '') FROM "TelegramBotIntent"
		WHERE code = $1 AND intent = 'REGISTRATION' AND "usedAt" IS NULL AND "expiresAt" > $2
	`, strings.TrimSpace(code), now).Scan(&id, &phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if phone != "" {
		return &phone, nil
	}
	return nil, nil
}

func (r *Repository) updateUserPassword(ctx context.Context, userID, passwordHash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, passwordHash, userID)
	return err
}

func (r *Repository) linkTelegramChatToUser(ctx context.Context, chatID, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE "User" SET "telegramChatId" = $1, "telegramLinkedAt" = $2 WHERE id = $3
	`, chatID, time.Now(), userID)
	return err
}
