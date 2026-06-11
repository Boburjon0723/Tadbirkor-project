package platform

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

func (r *Repository) GetStats(ctx context.Context) (map[string]any, error) {
	var total, active, trial, expired int
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Company"`).Scan(&total)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Company" WHERE "subscriptionStatus" = 'ACTIVE'`).Scan(&active)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Company" WHERE "subscriptionStatus" = 'TRIAL'`).Scan(&trial)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Company" WHERE "subscriptionStatus" = 'EXPIRED'`).Scan(&expired)
	return map[string]any{"total": total, "active": active, "trial": trial, "expired": expired}, nil
}

func (r *Repository) ListCompanies(ctx context.Context, search string, page, limit int) (map[string]any, error) {
	where := "TRUE"
	args := []any{}
	if strings.TrimSpace(search) != "" {
		where = `(c.name ILIKE $1 OR COALESCE(c.tin,'') ILIKE $1 OR COALESCE(c.phone,'') ILIKE $1)`
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}
	skip := (page - 1) * limit
	args = append(args, limit, skip)
	n := len(args)

	var total int
	countQ := `SELECT COUNT(*)::int FROM "Company" c WHERE ` + where
	_ = r.pool.QueryRow(ctx, countQ, args[:len(args)-2]...).Scan(&total)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT c.id, c.name, c.tin, c.phone, c.status, c."trialStartedAt", c."trialEndsAt",
		       c."subscriptionStatus", c."subscriptionNote", c."subscriptionActivatedAt", c."createdAt",
		       (SELECT COUNT(*)::int FROM "CompanyUser" cu WHERE cu."companyId" = c.id) AS user_count
		FROM "Company" c
		WHERE %s
		ORDER BY c."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, n-1, n), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, name, status, subStatus string
		var tin, phone, subNote *string
		var trialStarted, trialEnds, subActivated, createdAt *time.Time
		var userCount int
		if err := rows.Scan(&id, &name, &tin, &phone, &status, &trialStarted, &trialEnds,
			&subStatus, &subNote, &subActivated, &createdAt, &userCount); err != nil {
			return nil, err
		}
		access := resolveSubscriptionAccess(companySubRow{SubscriptionStatus: subStatus, TrialEndsAt: trialEnds})
		items = append(items, map[string]any{
			"id": id, "name": name, "tin": tin, "phone": phone, "status": status,
			"trialStartedAt": trialStarted, "trialEndsAt": trialEnds,
			"subscriptionStatus": subStatus, "subscriptionNote": subNote,
			"subscriptionActivatedAt": subActivated, "createdAt": createdAt,
			"userCount": userCount, "access": access,
		})
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total, "trialDaysDefault": trialDays(),
	}, rows.Err()
}

func (r *Repository) GetCompany(ctx context.Context, companyID string) (*companySubRow, *time.Time, error) {
	var subStatus string
	var trialEnds *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT "subscriptionStatus", "trialEndsAt" FROM "Company" WHERE id = $1
	`, companyID).Scan(&subStatus, &trialEnds)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	row := &companySubRow{SubscriptionStatus: subStatus, TrialEndsAt: trialEnds}
	return row, trialEnds, nil
}

func (r *Repository) UpdateCompanySubscription(ctx context.Context, companyID string, sets map[string]any) (map[string]any, error) {
	if len(sets) == 0 {
		return r.getCompanyBrief(ctx, companyID)
	}
	parts := []string{}
	args := []any{}
	n := 1
	for k, v := range sets {
		parts = append(parts, fmt.Sprintf(`"%s" = $%d`, k, n))
		args = append(args, v)
		n++
	}
	args = append(args, companyID)
	q := fmt.Sprintf(`UPDATE "Company" SET %s WHERE id = $%d`, strings.Join(parts, ", "), n)
	if _, err := r.pool.Exec(ctx, q, args...); err != nil {
		return nil, err
	}
	return r.getCompanyBrief(ctx, companyID)
}

func (r *Repository) getCompanyBrief(ctx context.Context, companyID string) (map[string]any, error) {
	var id, name string
	var tin *string
	var trialEnds *time.Time
	var subStatus string
	var subNote *string
	var subActivated *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, tin, "trialEndsAt", "subscriptionStatus", "subscriptionNote", "subscriptionActivatedAt"
		FROM "Company" WHERE id = $1
	`, companyID).Scan(&id, &name, &tin, &trialEnds, &subStatus, &subNote, &subActivated)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "name": name, "tin": tin, "trialEndsAt": trialEnds,
		"subscriptionStatus": subStatus, "subscriptionNote": subNote,
		"subscriptionActivatedAt": subActivated,
		"access": resolveSubscriptionAccess(companySubRow{SubscriptionStatus: subStatus, TrialEndsAt: trialEnds}),
	}, nil
}

func (r *Repository) ResolveBroadcastUserIDs(ctx context.Context, target string, companyIDs, userIDs []string) ([]string, error) {
	switch target {
	case "all":
		rows, err := r.pool.Query(ctx, `SELECT id FROM "User" WHERE status = 'active'`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			out = append(out, id)
		}
		return out, rows.Err()
	case "owners":
		rows, err := r.pool.Query(ctx, `
			SELECT DISTINCT "userId" FROM "CompanyUser" WHERE role = 'OWNER'
		`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			out = append(out, id)
		}
		return out, rows.Err()
	case "company":
		if len(companyIDs) == 0 {
			return nil, nil
		}
		rows, err := r.pool.Query(ctx, `
			SELECT DISTINCT "userId" FROM "CompanyUser" WHERE "companyId" = ANY($1)
		`, companyIDs)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			out = append(out, id)
		}
		return out, rows.Err()
	case "user":
		return userIDs, nil
	default:
		return nil, nil
	}
}

func (r *Repository) InsertBroadcastNotifications(ctx context.Context, userIDs []string, title, message, ntype string) error {
	for _, uid := range userIDs {
		_, err := r.pool.Exec(ctx, `
			INSERT INTO "Notification" (id, "userId", title, message, type, "moduleKey", "eventKey", "isRead", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, 'platform', 'admin_broadcast', false, NOW())
		`, uid, title, message, ntype)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetUserEmailLogin(ctx context.Context, userID string) (email, login string, err error) {
	err = r.pool.QueryRow(ctx, `SELECT COALESCE(email,''), COALESCE(login,'') FROM "User" WHERE id = $1`, userID).Scan(&email, &login)
	return email, login, err
}
