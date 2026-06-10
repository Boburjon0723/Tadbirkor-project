package companies

import (
	"context"
)

// ensureCompanyFeatureDefaults — eski kompaniyalar uchun yangi bo‘limlarni default yoqish (Nest bilan mos).
func (s *Service) ensureCompanyFeatureDefaults(ctx context.Context, companyID string) error {
	if err := s.ensureCompanyWarehouseSectionDefaults(ctx, companyID); err != nil {
		return err
	}
	return s.ensureCompanyGoodsReceiptsDefaults(ctx, companyID)
}

func (s *Service) ensureCompanyWarehouseSectionDefaults(ctx context.Context, companyID string) error {
	var configCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyFeature" WHERE "companyId" = $1`, companyID).Scan(&configCount); err != nil {
		return err
	}
	if configCount == 0 {
		return nil
	}

	var hasWarehouse bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM "CompanyFeature" cf
			JOIN "Feature" f ON f.id = cf."featureId"
			JOIN "Module" m ON m.id = f."moduleId"
			WHERE cf."companyId" = $1 AND cf.enabled = true AND m.key = 'WAREHOUSE'
		)
	`, companyID).Scan(&hasWarehouse)
	if err != nil {
		return err
	}
	if !hasWarehouse {
		return nil
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id FROM "Feature" WHERE key = ANY($1)
	`, warehouseSectionKeys)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var featureID string
		if err := rows.Scan(&featureID); err != nil {
			return err
		}
		_, err = s.pool.Exec(ctx, `
			INSERT INTO "CompanyFeature" (id, "companyId", "featureId", enabled, "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, true, NOW(), NOW())
			ON CONFLICT ("companyId", "featureId") DO NOTHING
		`, companyID, featureID)
		if err != nil {
			return err
		}
	}
	return rows.Err()
}

func (s *Service) ensureCompanyGoodsReceiptsDefaults(ctx context.Context, companyID string) error {
	var configCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyFeature" WHERE "companyId" = $1`, companyID).Scan(&configCount); err != nil {
		return err
	}
	if configCount == 0 {
		return nil
	}

	var hasGoodsConfig bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM "CompanyFeature" cf
			JOIN "Feature" f ON f.id = cf."featureId"
			WHERE cf."companyId" = $1 AND f.key IN ('GOODS_RECEIPTS_MAIN', 'PARTIAL_RECEIPT')
		)
	`, companyID).Scan(&hasGoodsConfig)
	if err != nil {
		return err
	}
	if hasGoodsConfig {
		return nil
	}

	var hasLegacy bool
	err = s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM "CompanyFeature" cf
			JOIN "Feature" f ON f.id = cf."featureId"
			LEFT JOIN "Module" m ON m.id = f."moduleId"
			WHERE cf."companyId" = $1 AND cf.enabled = true AND (
				f.key IN ('B2B_ORDERS', 'PARTIAL_RECEIPT', 'B2B_MAIN', 'WAREHOUSE_BASIC')
				OR m.key = 'B2B'
			)
		)
	`, companyID).Scan(&hasLegacy)
	if err != nil {
		return err
	}
	if !hasLegacy {
		return nil
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO "CompanyFeature" (id, "companyId", "featureId", enabled, "createdAt", "updatedAt")
		SELECT gen_random_uuid()::text, $1, f.id, true, NOW(), NOW()
		FROM "Feature" f
		WHERE f.key IN ('GOODS_RECEIPTS_MAIN', 'PARTIAL_RECEIPT')
		ON CONFLICT ("companyId", "featureId") DO NOTHING
	`, companyID)
	return err
}
