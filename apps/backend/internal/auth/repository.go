package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}

type UserRow struct {
	ID           string
	FullName     string
	Login        string
	Email        *string
	Phone        *string
	PasswordHash *string
	Status       string
	TelegramChat *string
	TelegramAt   *time.Time
}

type MembershipRow struct {
	CompanyID string
	Role      string
}

type CompanyUserRow struct {
	Role             string
	WarehouseID      *string
	GrantPermissions []string
	DenyPermissions  []string
	WarehouseName    *string
	WarehouseStatus  *string
}

type CompanyRow struct {
	ID                         string
	Name                       string
	Tin                        *string
	Status                     string
	Address                    *string
	BusinessType               *string
	StorefrontURL              *string
	StorefrontToken            *string
	TelegramChatID             *string
	TelegramEnabled            bool
	TelegramLinkedAt           *time.Time
	TrialEndsAt                *time.Time
	SubscriptionStatus         string
	SubscriptionNote           *string
	SubscriptionActivatedAt    *time.Time
	CreatedAt                  time.Time
	PosCreditEnabled           bool
	PosMaxDiscountPercent      *float64
	InventoryVarianceTolerance *float64
}

func (r *Repository) FindUserByLogin(ctx context.Context, login string) (*UserRow, []MembershipRow, error) {
	user, err := r.findUser(ctx, `SELECT id, "fullName", login, email, phone, "passwordHash", status, "telegramChatId", "telegramLinkedAt" FROM "User" WHERE login = $1`, login)
	if err != nil || user == nil {
		return nil, nil, err
	}
	memberships, err := r.listMemberships(ctx, user.ID)
	return user, memberships, err
}

func (r *Repository) FindUserByID(ctx context.Context, userID string) (*UserRow, error) {
	return r.findUser(ctx, `SELECT id, "fullName", login, email, phone, "passwordHash", status, "telegramChatId", "telegramLinkedAt" FROM "User" WHERE id = $1`, userID)
}

func (r *Repository) findUser(ctx context.Context, q string, arg string) (*UserRow, error) {
	row := r.pool.QueryRow(ctx, q, arg)
	var u UserRow
	err := row.Scan(&u.ID, &u.FullName, &u.Login, &u.Email, &u.Phone, &u.PasswordHash, &u.Status, &u.TelegramChat, &u.TelegramAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) listMemberships(ctx context.Context, userID string) ([]MembershipRow, error) {
	rows, err := r.pool.Query(ctx, `SELECT "companyId", role FROM "CompanyUser" WHERE "userId" = $1 ORDER BY "createdAt" ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MembershipRow
	for rows.Next() {
		var m MembershipRow
		if err := rows.Scan(&m.CompanyID, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) ResolveCompanyID(ctx context.Context, userID, companyID string) (string, error) {
	if companyID != "" {
		return companyID, nil
	}
	var id string
	err := r.pool.QueryRow(ctx, `SELECT "companyId" FROM "CompanyUser" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`, userID).Scan(&id)
	return id, err
}

func (r *Repository) LoadCompanyUser(ctx context.Context, userID, companyID string) (*CompanyUserRow, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT cu.role, cu."warehouseId", cu."grantPermissions", cu."denyPermissions",
		       w.name, w.status
		FROM "CompanyUser" cu
		LEFT JOIN "Warehouse" w ON w.id = cu."warehouseId"
		WHERE cu."userId" = $1 AND cu."companyId" = $2
		LIMIT 1
	`, userID, companyID)
	var cu CompanyUserRow
	err := row.Scan(&cu.Role, &cu.WarehouseID, &cu.GrantPermissions, &cu.DenyPermissions, &cu.WarehouseName, &cu.WarehouseStatus)
	if err != nil {
		return nil, err
	}
	return &cu, nil
}

func (r *Repository) LoadCompany(ctx context.Context, companyID string) (*CompanyRow, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, name, tin, status, address, "businessType", "storefrontUrl", "storefrontToken",
		       "telegramChatId", "telegramEnabled", "telegramLinkedAt", "trialEndsAt",
		       "subscriptionStatus", "subscriptionNote", "subscriptionActivatedAt", "createdAt",
		       "posCreditEnabled", "posMaxDiscountPercent", "inventoryVarianceTolerancePct"
		FROM "Company" WHERE id = $1
	`, companyID)
	var c CompanyRow
	err := row.Scan(
		&c.ID, &c.Name, &c.Tin, &c.Status, &c.Address, &c.BusinessType,
		&c.StorefrontURL, &c.StorefrontToken, &c.TelegramChatID, &c.TelegramEnabled,
		&c.TelegramLinkedAt, &c.TrialEndsAt, &c.SubscriptionStatus, &c.SubscriptionNote,
		&c.SubscriptionActivatedAt, &c.CreatedAt, &c.PosCreditEnabled,
		&c.PosMaxDiscountPercent, &c.InventoryVarianceTolerance,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) UpdateSubscriptionExpired(ctx context.Context, companyID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE "Company" SET "subscriptionStatus" = 'EXPIRED' WHERE id = $1`, companyID)
	return err
}

func (r *Repository) LoginExists(ctx context.Context, login string) (bool, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE login = $1`, login).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (r *Repository) EmailExists(ctx context.Context, email string) (bool, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE email = $1`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (r *Repository) PhoneExists(ctx context.Context, phone string) (bool, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE phone = $1`, phone).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

type RegisterOwnerParams struct {
	CompanyID    string
	CompanyName  string
	Tin          *string
	Phone        string
	TrialEndsAt  time.Time
	UserID       string
	FullName     string
	Login        string
	PasswordHash string
	Email        *string
	WarehouseID  string
}

func (r *Repository) RegisterOwner(ctx context.Context, in RegisterOwnerParams) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "Company" (id, name, tin, phone, status, "trialEndsAt", "subscriptionStatus", "trialStartedAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, 'onboarding', $5, 'TRIAL', NOW(), NOW(), NOW())
	`, in.CompanyID, in.CompanyName, in.Tin, in.Phone, in.TrialEndsAt)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO "Warehouse" (id, "companyId", name, address, status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'Asosiy Ombor', 'Toshkent', 'ACTIVE', NOW(), NOW())
	`, in.WarehouseID, in.CompanyID)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO "User" (id, "fullName", login, "passwordHash", email, phone, status, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
	`, in.UserID, in.FullName, in.Login, in.PasswordHash, in.Email, in.Phone)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO "CompanyUser" (id, "companyId", "userId", role, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'OWNER', NOW())
	`, in.CompanyID, in.UserID)
	return err
}

func (r *Repository) CreatePasswordResetIntent(ctx context.Context, code string, loginHint *string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "TelegramBotIntent" (id, code, intent, login, "expiresAt", "createdAt")
		VALUES (gen_random_uuid()::text, $1, 'PASSWORD_RESET', $2, $3, NOW())
	`, code, loginHint, expiresAt)
	return err
}
