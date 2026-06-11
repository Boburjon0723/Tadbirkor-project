package platform

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) ListUsers(ctx context.Context, search string, status string, page, limit int) (map[string]any, error) {
	where := []string{"TRUE"}
	args := []any{}
	n := 1
	if strings.TrimSpace(search) != "" {
		where = append(where, fmt.Sprintf(`(
			u."fullName" ILIKE $%d OR u.login ILIKE $%d OR COALESCE(u.email,'') ILIKE $%d OR COALESCE(u.phone,'') ILIKE $%d
		)`, n, n, n, n))
		args = append(args, "%"+strings.TrimSpace(search)+"%")
		n++
	}
	if strings.TrimSpace(status) != "" {
		where = append(where, fmt.Sprintf(`u.status = $%d`, n))
		args = append(args, strings.TrimSpace(status))
		n++
	}
	whereSQL := strings.Join(where, " AND ")
	skip := (page - 1) * limit

	var total int
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "User" u WHERE `+whereSQL, args...).Scan(&total)

	args = append(args, limit, skip)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT u.id, u."fullName", u.login, u.email, u.phone, u.status, u."createdAt",
		       (SELECT COUNT(*)::int FROM "CompanyUser" cu WHERE cu."userId" = u.id) AS company_count,
		       COALESCE((
		         SELECT string_agg(t.name, ', ')
		         FROM (
		           SELECT DISTINCT c.name
		           FROM "CompanyUser" cu JOIN "Company" c ON c.id = cu."companyId"
		           WHERE cu."userId" = u.id
		           LIMIT 3
		         ) t
		       ), '') AS companies_preview
		FROM "User" u
		WHERE %s
		ORDER BY u."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, n, n+1), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, fullName, login, statusVal string
		var email, phone *string
		var createdAt any
		var companyCount int
		var companiesPreview string
		if err := rows.Scan(&id, &fullName, &login, &email, &phone, &statusVal, &createdAt, &companyCount, &companiesPreview); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id": id, "fullName": fullName, "login": login, "email": email, "phone": phone,
			"status": statusVal, "createdAt": createdAt, "companyCount": companyCount,
			"companiesPreview": companiesPreview,
		})
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}, rows.Err()
}

func (r *Repository) UpdateUserStatus(ctx context.Context, userID, status string) (map[string]any, error) {
	if status != "active" && status != "inactive" {
		return nil, fmt.Errorf("status faqat active yoki inactive bo'lishi kerak")
	}
	var id, fullName, login, statusVal string
	err := r.pool.QueryRow(ctx, `
		UPDATE "User" SET status = $2, "updatedAt" = NOW()
		WHERE id = $1
		RETURNING id, "fullName", login, status
	`, userID, status).Scan(&id, &fullName, &login, &statusVal)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "fullName": fullName, "login": login, "status": statusVal}, nil
}

func (r *Repository) IsPlatformAdminUserID(ctx context.Context, userID string) (bool, error) {
	email, login, err := r.GetUserEmailLogin(ctx, userID)
	if err != nil {
		return false, err
	}
	return isPlatformAdminIdentity(email, login), nil
}
