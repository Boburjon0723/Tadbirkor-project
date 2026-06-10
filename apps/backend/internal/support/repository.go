package support

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) FindUserBrief(ctx context.Context, userID string) (*UserBrief, error) {
	row := r.pool.QueryRow(ctx, `SELECT id, "fullName", email, phone FROM "User" WHERE id = $1`, userID)
	var u UserBrief
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.Phone)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindCompanyBrief(ctx context.Context, companyID string) (*CompanyBrief, error) {
	row := r.pool.QueryRow(ctx, `SELECT id, name FROM "Company" WHERE id = $1`, companyID)
	var c CompanyBrief
	err := row.Scan(&c.ID, &c.Name)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

type AuditLogParams struct {
	ID         string
	CompanyID  string
	UserID     string
	Action     string
	EntityType string
	EntityID   string
	NewData    any
}

func (r *Repository) CreateAuditLog(ctx context.Context, p AuditLogParams) error {
	var newDataBytes []byte
	if p.NewData != nil {
		b, err := json.Marshal(p.NewData)
		if err == nil {
			newDataBytes = b
		}
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`, p.ID, p.CompanyID, p.UserID, p.Action, p.EntityType, p.EntityID, string(newDataBytes))

	return err
}
