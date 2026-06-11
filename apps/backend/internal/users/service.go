package users

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

func (s *Service) invalidateUserMe(ctx context.Context, userID, companyID string) {
	if s.cache != nil {
		s.cache.InvalidateAuthMe(ctx, userID, companyID)
	}
}

func (s *Service) invalidateUserMeAllCompanies(ctx context.Context, userID string) {
	if s.cache == nil {
		return
	}
	rows, err := s.pool.Query(ctx, `SELECT "companyId" FROM "CompanyUser" WHERE "userId" = $1`, userID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var companyID string
		if err := rows.Scan(&companyID); err == nil {
			s.cache.InvalidateAuthMe(ctx, userID, companyID)
		}
	}
}

func (s *Service) FindByCompany(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cu.id, cu.role, cu."warehouseId", cu."grantPermissions", cu."denyPermissions",
		       u.id, u."fullName", u.login, u.email, u.phone, u.status
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1
		ORDER BY cu."createdAt" ASC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var membershipID, role, userID, fullName, login, status string
		var warehouseID, email, phone *string
		var grant, deny []string
		if err := rows.Scan(&membershipID, &role, &warehouseID, &grant, &deny, &userID, &fullName, &login, &email, &phone, &status); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"companyUserId": membershipID, "role": role, "warehouseId": warehouseID,
			"grantPermissions": grant, "denyPermissions": deny,
			"user": map[string]any{
				"id": userID, "fullName": fullName, "login": login, "email": email, "phone": phone, "status": status,
			},
		})
	}
	return out, rows.Err()
}
