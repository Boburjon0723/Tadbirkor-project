package categories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

var (
	ErrBadInput    = errors.New("Kategoriya uchun ombor tanlash majburiy")
	ErrWarehouseNF = errors.New("Tanlangan ombor topilmadi yoki faol emas")
)

func (s *Service) invalidate(ctx context.Context, companyID string) {
	s.cache.DelByPrefix(ctx, cache.CategoriesPrefix(companyID))
	s.cache.InvalidateProductsList(ctx, companyID)
}

func (s *Service) Create(ctx context.Context, companyID string, in CreateInput) (map[string]any, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, errors.New("Kategoriya nomi majburiy")
	}
	whID := ""
	if in.WarehouseID != nil {
		whID = strings.TrimSpace(*in.WarehouseID)
	}
	if whID == "" {
		return nil, ErrBadInput
	}
	var wh string
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
	`, whID, companyID).Scan(&wh)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrWarehouseNF
	}
	if err != nil {
		return nil, err
	}
	status := "ACTIVE"
	if in.Status != nil && *in.Status != "" {
		status = *in.Status
	}
	var id string
	err = s.pool.QueryRow(ctx, `
		INSERT INTO "ProductCategory" (id, "companyId", "warehouseId", name, "parentId", status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id
	`, companyID, whID, in.Name, in.ParentID, status).Scan(&id)
	if err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Update(ctx context.Context, id, companyID string, in UpdateInput) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	if in.WarehouseID != nil {
		var wh string
		err := s.pool.QueryRow(ctx, `
			SELECT id FROM "Warehouse" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'
		`, strings.TrimSpace(*in.WarehouseID), companyID).Scan(&wh)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWarehouseNF
		}
		if err != nil {
			return nil, err
		}
	}

	sets := []string{`"updatedAt" = NOW()`}
	args := []any{}
	n := 1
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf(`%s = $%d`, col, n))
		args = append(args, val)
		n++
	}
	if in.Name != nil {
		add("name", *in.Name)
	}
	if in.ParentID != nil {
		add(`"parentId"`, *in.ParentID)
	}
	if in.WarehouseID != nil {
		add(`"warehouseId"`, strings.TrimSpace(*in.WarehouseID))
	}
	if in.Status != nil {
		add("status", *in.Status)
	}
	args = append(args, id, companyID)
	_, err := s.pool.Exec(ctx, fmt.Sprintf(`UPDATE "ProductCategory" SET %s WHERE id = $%d AND "companyId" = $%d`, strings.Join(sets, ", "), n, n+1), args...)
	if err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Remove(ctx context.Context, id, companyID string) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	var productsCount, childrenCount int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "Product" WHERE "categoryId" = $1`, id).Scan(&productsCount)
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "ProductCategory" WHERE "parentId" = $1`, id).Scan(&childrenCount)

	if productsCount > 0 || childrenCount > 0 {
		_, err := s.pool.Exec(ctx, `UPDATE "ProductCategory" SET status = 'ARCHIVED', "updatedAt" = NOW() WHERE id = $1`, id)
		if err != nil {
			return nil, err
		}
		s.invalidate(ctx, companyID)
		cat, _ := s.FindOne(ctx, id, companyID)
		return map[string]any{
			"action": "archived", "message": "Kategoriyada mahsulot yoki bolalar bor — arxivlandi.", "category": cat,
		}, nil
	}

	_, err := s.pool.Exec(ctx, `DELETE FROM "ProductCategory" WHERE id = $1 AND "companyId" = $2`, id, companyID)
	if err != nil {
		return nil, err
	}
	s.invalidate(ctx, companyID)
	return map[string]any{"action": "deleted", "success": true}, nil
}
