package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/users"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInviteLoginTaken    = errors.New("Bunday login band")
	ErrInviteAlreadyMember = errors.New("Bu login allaqachon jamoada mavjud")
	ErrInvitePhoneTaken    = errors.New("Bunday telefon raqami band")
	ErrEmployeesDisabled   = errors.New("EMPLOYEES moduli kompaniyada o'chirilgan")
)

type InviteInput struct {
	FullName         string   `json:"fullName"`
	Login            string   `json:"login"`
	Password         string   `json:"password"`
	Role             string   `json:"role"`
	Email            *string  `json:"email"`
	Phone            string   `json:"phone"`
	WarehouseID      *string  `json:"warehouseId"`
	GrantPermissions []string `json:"grantPermissions"`
	DenyPermissions  []string `json:"denyPermissions"`
}

func (s *Service) InviteUser(ctx context.Context, companyID string, in InviteInput) (map[string]any, error) {
	pool := s.repo.Pool()
	if err := assertEmployeesModule(ctx, pool, companyID); err != nil {
		return nil, err
	}
	whID, err := users.ResolveWarehouseForRole(in.Role, in.WarehouseID)
	if err != nil {
		return nil, err
	}
	if whID != nil {
		if err := users.AssertWarehouseBelongsToCompany(ctx, pool, companyID, *whID); err != nil {
			return nil, err
		}
	}
	p := phone.NormalizeUzPhone(in.Phone)
	if p == "" {
		return nil, ErrPhoneInvalid
	}
	login := strings.TrimSpace(in.Login)
	grant, deny := users.SanitizePosOverrides(in.GrantPermissions, in.DenyPermissions)

	var existingID, status string
	err = pool.QueryRow(ctx, `SELECT id, status FROM "User" WHERE login = $1`, login).Scan(&existingID, &status)
	if err == nil {
		return s.inviteExistingUser(ctx, pool, companyID, existingID, status, in, login, p, whID, grant, deny)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var phoneOwner string
	if err := pool.QueryRow(ctx, `SELECT id FROM "User" WHERE phone = $1`, p).Scan(&phoneOwner); err == nil {
		return nil, ErrInvitePhoneTaken
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), 10)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var userID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "User" (id, "fullName", login, "passwordHash", email, phone, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'active', NOW(), NOW()) RETURNING id
	`, strings.TrimSpace(in.FullName), login, string(hash), in.Email, p).Scan(&userID)
	if err != nil {
		return nil, err
	}
	membershipID, err := insertMembership(ctx, tx, companyID, userID, in.Role, whID, grant, deny)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.InvalidateMe(ctx, userID, companyID)
	return map[string]any{
		"id": userID, "companyUserId": membershipID, "fullName": in.FullName,
		"login": login, "email": in.Email, "phone": p,
	}, nil
}

func (s *Service) inviteExistingUser(ctx context.Context, pool *pgxpool.Pool, companyID, existingID, status string, in InviteInput, login, p string, whID *string, grant, deny []string) (map[string]any, error) {
	var memberCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2`, companyID, existingID).Scan(&memberCount)
	if memberCount > 0 {
		return nil, ErrInviteAlreadyMember
	}
	canReactivate := strings.EqualFold(status, "inactive")
	var otherCompanies int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyUser" WHERE "userId" = $1`, existingID).Scan(&otherCompanies)
	if !canReactivate && otherCompanies > 0 {
		return nil, ErrInviteLoginTaken
	}
	var phoneOwner string
	if err := pool.QueryRow(ctx, `SELECT id FROM "User" WHERE phone = $1`, p).Scan(&phoneOwner); err == nil && phoneOwner != existingID {
		return nil, ErrInvitePhoneTaken
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(in.Password), 10)
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE "User" SET "fullName" = $1, "passwordHash" = $2, email = COALESCE($3, email), phone = $4,
		       status = 'active', "telegramChatId" = NULL, "telegramLinkedAt" = NULL
		WHERE id = $5
	`, strings.TrimSpace(in.FullName), string(hash), in.Email, p, existingID)
	if err != nil {
		return nil, err
	}
	membershipID, err := insertMembership(ctx, tx, companyID, existingID, in.Role, whID, grant, deny)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.InvalidateMe(ctx, existingID, companyID)
	return map[string]any{
		"id": existingID, "companyUserId": membershipID, "fullName": in.FullName,
		"login": login, "email": in.Email, "phone": p, "reactivated": true,
	}, nil
}

func insertMembership(ctx context.Context, tx pgx.Tx, companyID, userID, role string, whID *string, grant, deny []string) (string, error) {
	var membershipID string
	err := tx.QueryRow(ctx, `
		INSERT INTO "CompanyUser" (id, "companyId", "userId", role, "warehouseId", "grantPermissions", "denyPermissions", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id
	`, companyID, userID, strings.ToUpper(role), whID, grant, deny).Scan(&membershipID)
	return membershipID, err
}

func assertEmployeesModule(ctx context.Context, pool *pgxpool.Pool, companyID string) error {
	var modules []string
	err := pool.QueryRow(ctx, `
		SELECT COALESCE("enabledModules", '{}') FROM "CompanyFeatureConfig" WHERE "companyId" = $1
	`, companyID).Scan(&modules)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if len(modules) == 0 {
		return nil
	}
	for _, m := range modules {
		if m == "EMPLOYEES" {
			return nil
		}
	}
	return ErrEmployeesDisabled
}
