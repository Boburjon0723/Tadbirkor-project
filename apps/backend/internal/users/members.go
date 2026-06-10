package users

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrMemberNotFound = errors.New("Kompaniya a'zosi topilmadi")
	ErrOwnerProtected = errors.New("Egasi (OWNER) uchun bu amal mumkin emas")
	ErrSelfRemove     = errors.New("O'zingizni o'chirib bo'lmaydi")
	ErrBadRole        = errors.New("Rol noto'g'ri")
	ErrBadPassword    = errors.New("Joriy parol noto'g'ri")
)

type UpdateMemberRoleInput struct {
	Role             string   `json:"role"`
	WarehouseID      *string  `json:"warehouseId"`
	GrantPermissions []string `json:"grantPermissions"`
	DenyPermissions  []string `json:"denyPermissions"`
}

type ResetMemberPasswordInput struct {
	NewPassword string `json:"newPassword"`
}

type UpdateMemberPhoneInput struct {
	Phone string `json:"phone"`
}

type UpdatePasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func ResolveWarehouseForRole(role string, warehouseID *string) (*string, error) {
	return resolveWarehouseIDForRole(role, warehouseID)
}

func resolveWarehouseIDForRole(role string, warehouseID *string) (*string, error) {
	upper := strings.ToUpper(strings.TrimSpace(role))
	if roleRequiresWarehouse(upper) {
		if warehouseID == nil || strings.TrimSpace(*warehouseID) == "" {
			return nil, errors.New(upper + " roli uchun ombor tanlanishi shart")
		}
		v := strings.TrimSpace(*warehouseID)
		return &v, nil
	}
	return nil, nil
}

func AssertWarehouseBelongsToCompany(ctx context.Context, pool *pgxpool.Pool, companyID, warehouseID string) error {
	var status string
	err := pool.QueryRow(ctx, `SELECT status FROM "Warehouse" WHERE id = $1 AND "companyId" = $2`, warehouseID, companyID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("Bunday ombor topilmadi yoki bu kompaniyaga tegishli emas")
	}
	if err != nil {
		return err
	}
	if status == "ARCHIVED" {
		return errors.New("Bu ombor arxivlangan, biriktirib bo'lmaydi")
	}
	return nil
}

func (s *Service) assertWarehouseBelongsToCompany(ctx context.Context, companyID, warehouseID string) error {
	return AssertWarehouseBelongsToCompany(ctx, s.pool, companyID, warehouseID)
}

func (s *Service) getMembership(ctx context.Context, companyID, membershipID string) (userID, role string, err error) {
	err = s.pool.QueryRow(ctx, `SELECT "userId", role FROM "CompanyUser" WHERE id = $1 AND "companyId" = $2`, membershipID, companyID).Scan(&userID, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrMemberNotFound
	}
	return userID, role, err
}

func (s *Service) UpdateMemberRole(ctx context.Context, companyID, membershipID string, in UpdateMemberRoleInput) (map[string]any, error) {
	upper := strings.ToUpper(strings.TrimSpace(in.Role))
	if !isAssignableRole(upper) {
		return nil, ErrBadRole
	}
	userID, role, err := s.getMembership(ctx, companyID, membershipID)
	if err != nil {
		return nil, err
	}
	if role == "OWNER" {
		return nil, errors.New("Egasi (OWNER) rolini bu yerda o'zgartirib bo'lmaydi")
	}
	whID, err := resolveWarehouseIDForRole(upper, in.WarehouseID)
	if err != nil {
		return nil, err
	}
	if whID != nil {
		if err := s.assertWarehouseBelongsToCompany(ctx, companyID, *whID); err != nil {
			return nil, err
		}
	}
	grant, deny := sanitizePosOverrides(in.GrantPermissions, in.DenyPermissions)
	_, err = s.pool.Exec(ctx, `
		UPDATE "CompanyUser" SET role = $1, "warehouseId" = $2, "grantPermissions" = $3, "denyPermissions" = $4, "updatedAt" = NOW()
		WHERE id = $5 AND "companyId" = $6
	`, upper, whID, grant, deny, membershipID, companyID)
	if err != nil {
		return nil, err
	}
	_ = userID
	return s.findMembership(ctx, companyID, membershipID)
}

func (s *Service) findMembership(ctx context.Context, companyID, membershipID string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT cu.id, cu.role, cu."warehouseId", cu."grantPermissions", cu."denyPermissions",
		       u.id, u."fullName", u.login, u.email, u.phone
		FROM "CompanyUser" cu JOIN "User" u ON u.id = cu."userId"
		WHERE cu.id = $1 AND cu."companyId" = $2
	`, membershipID, companyID)
	var id, role, uid, fullName, login string
	var whID, email, phoneNum *string
	var grant, deny []string
	if err := row.Scan(&id, &role, &whID, &grant, &deny, &uid, &fullName, &login, &email, &phoneNum); err != nil {
		return nil, ErrMemberNotFound
	}
	return map[string]any{
		"id": id, "role": role, "warehouseId": whID,
		"grantPermissions": grant, "denyPermissions": deny,
		"user": map[string]any{"id": uid, "fullName": fullName, "login": login, "email": email, "phone": phoneNum},
	}, nil
}

func (s *Service) ResetMemberPassword(ctx context.Context, companyID, membershipID, newPassword string) (map[string]any, error) {
	userID, role, err := s.getMembership(ctx, companyID, membershipID)
	if err != nil {
		return nil, err
	}
	if role == "OWNER" {
		return nil, ErrOwnerProtected
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 10)
	if err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, string(hash), userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) UpdateMemberPhone(ctx context.Context, companyID, membershipID, phoneRaw string) (map[string]any, error) {
	userID, role, err := s.getMembership(ctx, companyID, membershipID)
	if err != nil {
		return nil, err
	}
	if role == "OWNER" {
		return nil, ErrOwnerProtected
	}
	p := phone.NormalizeUzPhone(phoneRaw)
	if p == "" {
		return nil, errors.New("Telefon raqami noto'g'ri (masalan: +998901234567)")
	}
	var ownerID string
	err = s.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE phone = $1 AND id <> $2 LIMIT 1`, p, userID).Scan(&ownerID)
	if err == nil {
		return nil, errors.New("Bunday telefon raqami boshqa foydalanuvchida band")
	}
	_, err = s.pool.Exec(ctx, `UPDATE "User" SET phone = $1, "telegramChatId" = NULL, "telegramLinkedAt" = NULL WHERE id = $2`, p, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "phone": p}, nil
}

func (s *Service) RemoveMember(ctx context.Context, companyID, membershipID, actorUserID string) (map[string]any, error) {
	userID, role, err := s.getMembership(ctx, companyID, membershipID)
	if err != nil {
		return nil, err
	}
	if role == "OWNER" {
		return nil, ErrOwnerProtected
	}
	if userID == actorUserID {
		return nil, ErrSelfRemove
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM "CompanyUser" WHERE id = $1`, membershipID); err != nil {
		return nil, err
	}
	var remaining int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyUser" WHERE "userId" = $1`, userID).Scan(&remaining); err != nil {
		return nil, err
	}
	if remaining == 0 {
		_, err = tx.Exec(ctx, `UPDATE "User" SET status = 'inactive', "telegramChatId" = NULL, "telegramLinkedAt" = NULL WHERE id = $1`, userID)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) UpdatePassword(ctx context.Context, userID string, in UpdatePasswordInput) error {
	var hash string
	err := s.pool.QueryRow(ctx, `SELECT "passwordHash" FROM "User" WHERE id = $1`, userID).Scan(&hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("Foydalanuvchi topilmadi")
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.CurrentPassword)) != nil {
		return ErrBadPassword
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), 10)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, string(newHash), userID)
	return err
}

func (s *Service) WarehouseScope(ctx context.Context, companyID, userID string) (map[string]any, error) {
	wh, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"all":                wh.All,
		"warehouseIds":       wh.WarehouseIDs,
		"defaultWarehouseId": wh.DefaultWarehouseID,
		"role":               wh.Role,
	}, nil
}
