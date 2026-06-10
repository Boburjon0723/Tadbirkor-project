package telegram

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
)

var validTelegramRoles = map[string]bool{
	"OWNER": true, "MANAGER": true, "WAREHOUSE": true, "ACCOUNTANT": true,
	"SALES": true, "FIELD_WORKER": true, "WORKER": true,
}

type userLinkResult struct {
	UserID, FullName, Phone string
	Roles, Companies        []string
}

func (r *Repository) linkChatToUserByPhone(ctx context.Context, chatID, phoneRaw string) (*userLinkResult, error) {
	chatID = strings.TrimSpace(chatID)
	if chatID == "" {
		return nil, errBadRequest("Telegram chat topilmadi")
	}
	normalized := phone.NormalizeUzPhone(phoneRaw)
	if normalized == "" {
		return nil, errBadRequest("Telefon formati noto'g'ri")
	}

	var userID, fullName string
	err := r.pool.QueryRow(ctx, `SELECT id, "fullName" FROM "User" WHERE phone = $1`, normalized).Scan(&userID, &fullName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errBadRequest("Bu telefon tizimda topilmadi. Ro'yxatdan o'tish yoki jamoa sozlamalarida kiritilgan raqamni tekshiring.")
	}
	if err != nil {
		return nil, err
	}

	var existingOwnerID, existingName string
	err = r.pool.QueryRow(ctx, `SELECT id, "fullName" FROM "User" WHERE "telegramChatId" = $1`, chatID).Scan(&existingOwnerID, &existingName)
	if err == nil && existingOwnerID != userID {
		return nil, errBadRequest("Bu Telegram akkaunt boshqa foydalanuvchiga bog'langan.")
	}

	now := time.Now()
	_, err = r.pool.Exec(ctx, `UPDATE "User" SET "telegramChatId" = $1, "telegramLinkedAt" = $2 WHERE id = $3`, chatID, now, userID)
	if err != nil {
		return nil, err
	}
	if err := r.syncBindingsForUser(ctx, userID, chatID, now); err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT UPPER(cu.role), c.name FROM "CompanyUser" cu
		JOIN "Company" c ON c.id = cu."companyId"
		WHERE cu."userId" = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := []string{}
	companies := []string{}
	for rows.Next() {
		var role, name string
		if err := rows.Scan(&role, &name); err != nil {
			return nil, err
		}
		roles = append(roles, role)
		companies = append(companies, name)
	}
	return &userLinkResult{
		UserID: userID, FullName: fullName, Phone: normalized,
		Roles: roles, Companies: companies,
	}, rows.Err()
}

func (r *Repository) linkChatToPartnerByPhone(ctx context.Context, chatID, phoneRaw string) (contactName, companyName, normalizedPhone string, err error) {
	chatID = strings.TrimSpace(chatID)
	normalizedPhone = phone.NormalizeUzPhone(phoneRaw)
	if normalizedPhone == "" {
		return "", "", "", errBadRequest("Telefon formati noto'g'ri")
	}

	rows, err := r.pool.Query(ctx, `
		SELECT plc.id, plc.name, c.name
		FROM "PartnerLedgerContact" plc
		JOIN "Company" c ON c.id = plc."companyId"
		WHERE plc."isActive" = true AND plc.phone = $1
	`, normalizedPhone)
	if err != nil {
		return "", "", "", err
	}
	defer rows.Close()

	type row struct{ id, contact, company string }
	items := []row{}
	for rows.Next() {
		var it row
		if err := rows.Scan(&it.id, &it.contact, &it.company); err != nil {
			return "", "", "", err
		}
		items = append(items, it)
	}
	if len(items) == 0 {
		return "", "", "", errBadRequest("Bu telefon bo'yicha hamkor daftari kontakti topilmadi.")
	}
	if len(items) > 1 {
		return "", "", "", errBadRequest("Bu telefon bir nechta hamkor kontaktida bor. Bog'lash uchun admin bilan aniqlang.")
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE "PartnerLedgerContact"
		SET phone = $1, "telegramChatId" = $2, "telegramLinkedAt" = NOW(), "telegramLinkStatus" = 'LINKED'
		WHERE id = $3
	`, normalizedPhone, chatID, items[0].id)
	return items[0].contact, items[0].company, normalizedPhone, err
}

func (r *Repository) linkCompanyByStartCode(ctx context.Context, chatID, code string) (companyName string, err error) {
	now := time.Now()
	var companyID string
	err = r.pool.QueryRow(ctx, `
		SELECT id, name FROM "Company"
		WHERE "telegramLinkCode" = $1 AND "telegramLinkCodeExpiresAt" > $2
	`, strings.TrimSpace(code), now).Scan(&companyID, &companyName)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errBadRequest("Ulanish kodi noto'g'ri yoki muddati o'tgan.")
	}
	if err != nil {
		return "", err
	}

	_, err = r.pool.Exec(ctx, `
		UPDATE "Company" SET "telegramChatId" = $1, "telegramEnabled" = true, "telegramLinkedAt" = $2,
			"telegramLinkCode" = NULL, "telegramLinkCodeExpiresAt" = NULL
		WHERE id = $3
	`, chatID, now, companyID)
	if err != nil {
		return "", err
	}

	var ownerID string
	_ = r.pool.QueryRow(ctx, `
		SELECT "userId" FROM "CompanyUser" WHERE "companyId" = $1 AND role = 'OWNER' LIMIT 1
	`, companyID).Scan(&ownerID)
	if ownerID != "" {
		_, _ = r.pool.Exec(ctx, `UPDATE "User" SET "telegramChatId" = $1, "telegramLinkedAt" = $2 WHERE id = $3`, chatID, now, ownerID)
		_ = r.syncBindingsForUser(ctx, ownerID, chatID, now)
	}
	return companyName, nil
}

func (r *Repository) syncBindingsForUser(ctx context.Context, userID, chatID string, linkedAt time.Time) error {
	rows, err := r.pool.Query(ctx, `SELECT "companyId", role FROM "CompanyUser" WHERE "userId" = $1`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var companyID, role string
		if err := rows.Scan(&companyID, &role); err != nil {
			return err
		}
		role = strings.ToUpper(strings.TrimSpace(role))
		if !validTelegramRoles[role] {
			continue
		}
		_, err := r.pool.Exec(ctx, `
			INSERT INTO "TelegramChatBinding" (id, "companyId", role, "moduleKey", "chatId", enabled, "createdAt", "updatedAt")
			VALUES ($1, $2, $3, 'ALL', $4, true, NOW(), NOW())
			ON CONFLICT ("companyId", role, "moduleKey") DO UPDATE SET
				"chatId" = EXCLUDED."chatId", enabled = true, "updatedAt" = NOW()
		`, uuid.NewString(), companyID, role, chatID)
		if err != nil {
			return err
		}
		if role == "OWNER" {
			_, _ = r.pool.Exec(ctx, `
				UPDATE "Company" SET "telegramChatId" = $1, "telegramEnabled" = true, "telegramLinkedAt" = $2 WHERE id = $3
			`, chatID, linkedAt, companyID)
		}
	}
	return rows.Err()
}

func (r *Repository) findLinkedUserRole(ctx context.Context, chatID string) (fullName, role string, linked bool) {
	var userID, name string
	err := r.pool.QueryRow(ctx, `SELECT id, "fullName" FROM "User" WHERE "telegramChatId" = $1`, chatID).Scan(&userID, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false
	}
	if err != nil {
		return "", "", false
	}
	var rname string
	_ = r.pool.QueryRow(ctx, `
		SELECT role FROM "CompanyUser" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1
	`, userID).Scan(&rname)
	return name, strings.ToUpper(rname), true
}

type badRequestError struct{ msg string }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }
func (e badRequestError) Error() string { return e.msg }

func formatRoles(roles []string) string {
	if len(roles) == 0 {
		return "—"
	}
	labels := map[string]string{
		"OWNER": "Egasi", "MANAGER": "Menejer", "WAREHOUSE": "Ombor",
		"ACCOUNTANT": "Hisobchi", "SALES": "Sotuvchi", "FIELD_WORKER": "Dala xodimi", "WORKER": "Ishchi",
	}
	parts := []string{}
	for _, r := range roles {
		if l, ok := labels[r]; ok {
			parts = append(parts, l)
		} else {
			parts = append(parts, r)
		}
	}
	return strings.Join(parts, ", ")
}
