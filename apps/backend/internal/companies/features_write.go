package companies

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

var ErrFeatureNotFound = errors.New("Bo'lim (feature) topilmadi")
var ErrModuleNotFound = errors.New("Modul topilmadi")
var ErrBundleNotFound = errors.New("Ombor guruhi topilmadi")
var ErrFeatureKeyRequired = errors.New("moduleKey yoki featureKey kerak")
var ErrModuleNoFeatures = errors.New("Ushbu modulga feature biriktirilmagan")

var warehouseSectionKeys = []string{
	"WAREHOUSE_BASIC", "STOCK_ADJUSTMENT", "WAREHOUSE_PICKING",
	"WAREHOUSE_ATP", "WAREHOUSE_INVENTORY_COUNT", "WAREHOUSE_INTAKE",
}

type warehouseBundle struct {
	id               string
	featureKeys      []string
	requiresBundleIds []string
}

var warehouseBundles = []warehouseBundle{
	{id: "core", featureKeys: []string{"WAREHOUSE_BASIC", "STOCK_ADJUSTMENT", "WAREHOUSE_INTAKE"}},
	{id: "b2b_outbound", featureKeys: []string{"WAREHOUSE_PICKING", "WAREHOUSE_ATP"}, requiresBundleIds: []string{"core"}},
	{id: "inventory_count", featureKeys: []string{"WAREHOUSE_INVENTORY_COUNT"}, requiresBundleIds: []string{"core"}},
}

const warehouseBundleAllID = "all"

type UpdateFeatureInput struct {
	ModuleKey  string `json:"moduleKey"`
	FeatureKey string `json:"featureKey"`
	BundleID   string `json:"bundleId"`
	Enabled    bool   `json:"enabled"`
}

func (s *Service) IsFeatureEnabled(ctx context.Context, companyID, featureKey string) (bool, error) {
	cfg, err := s.GetFeatureConfig(ctx, companyID)
	if err != nil {
		return false, err
	}
	if cfg["hasFeatureConfig"] != true {
		return true, nil
	}
	upper := strings.ToUpper(featureKey)
	for _, f := range featuresFromConfig(cfg) {
		if strings.ToUpper(f) == upper {
			return true, nil
		}
	}
	return false, nil
}

func (s *Service) AssertFeatureEnabled(ctx context.Context, companyID, featureKey string) error {
	ok, err := s.IsFeatureEnabled(ctx, companyID, featureKey)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New(featureKey + " bo'limi o'chirilgan. Sozlamalar → Modullar → Ombor bo'limlaridan yoqing.")
	}
	return nil
}

func featuresFromConfig(cfg map[string]any) []string {
	raw, ok := cfg["enabledFeatures"]
	if !ok {
		return nil
	}
	switch v := raw.(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func (s *Service) UpdateFeatureConfig(ctx context.Context, companyID string, in UpdateFeatureInput) (map[string]any, error) {
	if err := s.EnsureModuleCatalog(ctx); err != nil {
		return nil, err
	}
	bundleID := strings.TrimSpace(in.BundleID)
	featureKey := strings.TrimSpace(in.FeatureKey)
	moduleKey := strings.TrimSpace(in.ModuleKey)

	if bundleID != "" {
		return s.UpdateWarehouseBundle(ctx, companyID, bundleID, in.Enabled)
	}
	if featureKey != "" {
		key := strings.ToUpper(featureKey)
		var fid string
		err := s.pool.QueryRow(ctx, `SELECT id FROM "Feature" WHERE key = $1`, key).Scan(&fid)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFeatureNotFound
		}
		if err != nil {
			return nil, err
		}
		return s.upsertCompanyFeatures(ctx, companyID, []featureUpdate{{key: key, enabled: in.Enabled}})
	}
	if moduleKey == "" {
		return nil, ErrFeatureKeyRequired
	}
	mod := strings.ToUpper(moduleKey)
	var moduleID string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "Module" WHERE key = $1`, mod).Scan(&moduleID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrModuleNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `SELECT id FROM "Feature" WHERE "moduleId" = $1`, moduleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var featureIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		featureIDs = append(featureIDs, id)
	}
	if len(featureIDs) == 0 {
		return nil, ErrModuleNoFeatures
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, fid := range featureIDs {
		_, err = tx.Exec(ctx, `
			INSERT INTO "CompanyFeature" (id, "companyId", "featureId", enabled, "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
			ON CONFLICT ("companyId", "featureId") DO UPDATE SET enabled = $3, "updatedAt" = NOW()
		`, companyID, fid, in.Enabled)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.cache.Del(ctx, s.featuresKey(companyID))
	return s.GetFeatureConfig(ctx, companyID)
}

func (s *Service) UpdateWarehouseBundle(ctx context.Context, companyID, bundleID string, enabled bool) (map[string]any, error) {
	if err := s.EnsureModuleCatalog(ctx); err != nil {
		return nil, err
	}
	if bundleID == warehouseBundleAllID {
		updates := make([]featureUpdate, 0, len(warehouseSectionKeys))
		for _, k := range warehouseSectionKeys {
			updates = append(updates, featureUpdate{key: k, enabled: enabled})
		}
		return s.upsertCompanyFeatures(ctx, companyID, updates)
	}
	var bundle *warehouseBundle
	for i := range warehouseBundles {
		if warehouseBundles[i].id == bundleID {
			bundle = &warehouseBundles[i]
			break
		}
	}
	if bundle == nil {
		return nil, ErrBundleNotFound
	}
	updates := []featureUpdate{}
	if enabled {
		for _, reqID := range bundle.requiresBundleIds {
			for _, b := range warehouseBundles {
				if b.id == reqID {
					for _, k := range b.featureKeys {
						updates = append(updates, featureUpdate{key: k, enabled: true})
					}
				}
			}
		}
		for _, k := range bundle.featureKeys {
			updates = append(updates, featureUpdate{key: k, enabled: true})
		}
	} else {
		for _, k := range bundle.featureKeys {
			updates = append(updates, featureUpdate{key: k, enabled: false})
		}
		for _, other := range warehouseBundles {
			for _, req := range other.requiresBundleIds {
				if req == bundleID {
					for _, k := range other.featureKeys {
						updates = append(updates, featureUpdate{key: k, enabled: false})
					}
				}
			}
		}
	}
	return s.upsertCompanyFeatures(ctx, companyID, updates)
}

type featureUpdate struct {
	key     string
	enabled bool
}

func (s *Service) upsertCompanyFeatures(ctx context.Context, companyID string, updates []featureUpdate) (map[string]any, error) {
	deduped := map[string]bool{}
	for _, u := range updates {
		deduped[strings.ToUpper(u.key)] = u.enabled
	}
	for key, enabled := range deduped {
		var fid string
		err := s.pool.QueryRow(ctx, `SELECT id FROM "Feature" WHERE key = $1`, key).Scan(&fid)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, err
		}
		_, err = s.pool.Exec(ctx, `
			INSERT INTO "CompanyFeature" (id, "companyId", "featureId", enabled, "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
			ON CONFLICT ("companyId", "featureId") DO UPDATE SET enabled = $3, "updatedAt" = NOW()
		`, companyID, fid, enabled)
		if err != nil {
			return nil, err
		}
	}
	s.cache.Del(ctx, s.featuresKey(companyID))
	return s.GetFeatureConfig(ctx, companyID)
}
