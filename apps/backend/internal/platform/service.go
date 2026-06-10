package platform

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

type Service struct {
	pool *pgxpool.Pool
	repo *Repository
	cache *cache.Cache
	hub  pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, repo *Repository, c *cache.Cache, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, repo: repo, cache: c, hub: hub}
}

func (s *Service) GetStats(ctx context.Context) (map[string]any, error) {
	return s.repo.GetStats(ctx)
}

func (s *Service) ListCompanies(ctx context.Context, search string, page, limit int) (map[string]any, error) {
	if page < 1 {
		page = 1
	}
	if limit < 10 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListCompanies(ctx, search, page, limit)
}

func (s *Service) UpdateCompanySubscription(ctx context.Context, companyID string, input UpdateCompanySubscriptionInput) (map[string]any, error) {
	company, trialEnds, err := s.repo.GetCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}

	sets := map[string]any{}
	if input.SubscriptionNote != nil {
		note := strings.TrimSpace(*input.SubscriptionNote)
		if note == "" {
			sets["subscriptionNote"] = nil
		} else {
			sets["subscriptionNote"] = note
		}
	}
	if input.ExtendTrialDays != nil && *input.ExtendTrialDays > 0 {
		base := time.Now()
		if trialEnds != nil && trialEnds.After(base) {
			base = *trialEnds
		}
		end := base.AddDate(0, 0, *input.ExtendTrialDays)
		sets["trialEndsAt"] = end
		sets["subscriptionStatus"] = "TRIAL"
	}
	if input.SubscriptionStatus != nil && *input.SubscriptionStatus != "" {
		sets["subscriptionStatus"] = *input.SubscriptionStatus
		if *input.SubscriptionStatus == "ACTIVE" {
			sets["subscriptionActivatedAt"] = time.Now()
		}
		if *input.SubscriptionStatus == "TRIAL" && (input.ExtendTrialDays == nil || *input.ExtendTrialDays == 0) {
			sets["trialEndsAt"] = computeTrialEndsAt()
		}
	}
	_ = company
	return s.repo.UpdateCompanySubscription(ctx, companyID, sets)
}

func (s *Service) BroadcastToUsers(ctx context.Context, input BroadcastNotificationInput) (map[string]any, error) {
	ntype := "INFO"
	if input.Type != nil && strings.TrimSpace(*input.Type) != "" {
		ntype = strings.TrimSpace(*input.Type)
	}
	userIDs, err := s.repo.ResolveBroadcastUserIDs(ctx, input.Target, input.CompanyIDs, input.UserIDs)
	if err != nil {
		return nil, err
	}
	if len(userIDs) == 0 {
		return map[string]any{"sent": 0, "message": "Foydalanuvchilar topilmadi"}, nil
	}
	if err := s.repo.InsertBroadcastNotifications(ctx, userIDs, input.Title, input.Message, ntype); err != nil {
		return nil, err
	}
	payload := map[string]any{"title": input.Title, "message": input.Message, "type": ntype}
	for _, uid := range userIDs {
		s.hub.EmitToUser(uid, "notification:new", payload)
	}
	return map[string]any{"sent": len(userIDs)}, nil
}

func (s *Service) RedisHealth(ctx context.Context) (map[string]any, error) {
	return map[string]any{
		"cache": s.cache.Diagnostics(),
		"ping":  s.cache.Ping(ctx),
	}, nil
}
