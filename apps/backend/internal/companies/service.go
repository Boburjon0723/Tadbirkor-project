package companies

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

type Service struct {
	pool        *pgxpool.Pool
	cache       *cache.Cache
	ttl         time.Duration
	botUsername string

	catalogMu     sync.Mutex
	catalogSynced bool
}

func NewService(pool *pgxpool.Pool, c *cache.Cache, botUsername string) *Service {
	return &Service{pool: pool, cache: c, ttl: 5 * time.Minute, botUsername: botUsername}
}

func (s *Service) featuresKey(companyID string) string {
	return cache.CompanyFeaturesKey(companyID)
}

func (s *Service) EnsureModuleCatalog(ctx context.Context) error {
	s.catalogMu.Lock()
	if s.catalogSynced {
		s.catalogMu.Unlock()
		return nil
	}
	s.catalogMu.Unlock()

	if err := syncSystemModuleCatalog(ctx, s.pool); err != nil {
		return err
	}

	s.catalogMu.Lock()
	s.catalogSynced = true
	s.catalogMu.Unlock()
	return nil
}

func (s *Service) SyncModuleCatalog(ctx context.Context) error {
	if err := syncSystemModuleCatalog(ctx, s.pool); err != nil {
		return err
	}
	s.catalogMu.Lock()
	s.catalogSynced = true
	s.catalogMu.Unlock()
	return nil
}

func (s *Service) InitModules(ctx context.Context) (map[string]any, error) {
	if err := s.SyncModuleCatalog(ctx); err != nil {
		return nil, err
	}
	return map[string]any{
		"success": true,
		"count":   len(systemModuleCatalog),
	}, nil
}

func (s *Service) GetFeatureConfig(ctx context.Context, companyID string) (map[string]any, error) {
	if err := s.EnsureModuleCatalog(ctx); err != nil {
		return nil, err
	}
	key := s.featuresKey(companyID)
	var cached map[string]any
	if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
		return cached, nil
	}
	if err := s.ensureCompanyFeatureDefaults(ctx, companyID); err != nil {
		return nil, err
	}
	data, err := s.loadFeatureConfig(ctx, companyID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetJSON(ctx, key, data, s.ttl)
	return data, nil
}

func (s *Service) loadFeatureConfig(ctx context.Context, companyID string) (map[string]any, error) {
	var configCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyFeature" WHERE "companyId" = $1`, companyID).Scan(&configCount); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT f.key, m.key
		FROM "CompanyFeature" cf
		JOIN "Feature" f ON f.id = cf."featureId"
		LEFT JOIN "Module" m ON m.id = f."moduleId"
		WHERE cf."companyId" = $1 AND cf.enabled = true
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	features := []string{}
	modules := map[string]struct{}{}
	for rows.Next() {
		var fk string
		var mk *string
		if err := rows.Scan(&fk, &mk); err != nil {
			return nil, err
		}
		features = append(features, fk)
		if mk != nil && *mk != "" {
			modules[*mk] = struct{}{}
		}
	}
	enabledModules := make([]string, 0, len(modules))
	for m := range modules {
		enabledModules = append(enabledModules, m)
	}
	return map[string]any{
		"hasFeatureConfig": configCount > 0,
		"enabledFeatures":  features,
		"enabledModules":   enabledModules,
	}, nil
}

func (s *Service) GetPosSettings(ctx context.Context, companyID string) (map[string]any, error) {
	if err := s.assertModuleEnabled(ctx, companyID, "POS"); err != nil {
		return nil, err
	}
	var credit bool
	var maxPct *float64
	var receiptJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT "posCreditEnabled", "posMaxDiscountPercent", "posReceiptSettings"
		FROM "Company" WHERE id = $1
	`, companyID).Scan(&credit, &maxPct, &receiptJSON)
	if err != nil {
		return nil, err
	}
	max := 15.0
	if maxPct != nil {
		max = *maxPct
	}
	var receipt any = nil
	if len(receiptJSON) > 0 {
		_ = json.Unmarshal(receiptJSON, &receipt)
	}
	return map[string]any{
		"posCreditEnabled":      credit,
		"posMaxDiscountPercent": max,
		"posReceiptSettings":    receipt,
	}, nil
}

func (s *Service) assertModuleEnabled(ctx context.Context, companyID, moduleKey string) error {
	cfg, err := s.GetFeatureConfig(ctx, companyID)
	if err != nil {
		return err
	}
	if cfg["hasFeatureConfig"] != true {
		return nil
	}
	for _, m := range modulesFromConfig(cfg) {
		if m == moduleKey {
			return nil
		}
	}
	return errors.New(moduleKey + " moduli kompaniyada o'chirilgan")
}

func (s *Service) IsModuleEnabled(ctx context.Context, companyID, moduleKey string) (bool, error) {
	cfg, err := s.GetFeatureConfig(ctx, companyID)
	if err != nil {
		return false, err
	}
	if cfg["hasFeatureConfig"] != true {
		return true, nil
	}
	for _, m := range modulesFromConfig(cfg) {
		if m == moduleKey {
			return true, nil
		}
	}
	return false, nil
}

func (s *Service) AssertModuleEnabled(ctx context.Context, companyID, moduleKey string) error {
	return s.assertModuleEnabled(ctx, companyID, moduleKey)
}

func modulesFromConfig(cfg map[string]any) []string {
	raw, ok := cfg["enabledModules"]
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

func (s *Service) ResolveCompanyID(ctx context.Context, userID, companyID string) (string, error) {
	if companyID != "" {
		return companyID, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT "companyId" FROM "CompanyUser" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("kompaniya topilmadi")
	}
	return id, err
}
