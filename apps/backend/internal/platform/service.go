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
	pool  *pgxpool.Pool
	repo  *Repository
	cache *cache.Cache
	hub   pkgrealtime.Hub
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

func (s *Service) ListUsers(ctx context.Context, search, status string, page, limit int) (map[string]any, error) {
	if page < 1 {
		page = 1
	}
	if limit < 10 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListUsers(ctx, search, status, page, limit)
}

func (s *Service) UpdateUserStatus(ctx context.Context, actorUserID, targetUserID string, input UpdateUserStatusInput) (map[string]any, error) {
	if input.Status == nil || strings.TrimSpace(*input.Status) == "" {
		return nil, errForbidden("status majburiy")
	}
	status := strings.TrimSpace(*input.Status)
	if actorUserID == targetUserID && status == "inactive" {
		return nil, errForbidden("O'zingizni bloklay olmaysiz")
	}
	isAdmin, err := s.repo.IsPlatformAdminUserID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}
	if isAdmin {
		return nil, errForbidden("Platforma administratorini bloklash mumkin emas")
	}
	return s.repo.UpdateUserStatus(ctx, targetUserID, status)
}

func (s *Service) UpdateCompanySubscription(ctx context.Context, companyID string, input UpdateCompanySubscriptionInput) (map[string]any, error) {
	company, trialEnds, err := s.repo.GetCompany(ctx, companyID)
	if err != nil {
		return nil, err
	}

	if input.ScheduleAt != nil && strings.TrimSpace(*input.ScheduleAt) != "" {
		runAt, err := time.Parse(time.RFC3339, strings.TrimSpace(*input.ScheduleAt))
		if err != nil {
			return nil, errForbidden("scheduleAt noto'g'ri format (ISO 8601)")
		}
		if !runAt.After(time.Now()) {
			return nil, errForbidden("Reja vaqti kelajakda bo'lishi kerak")
		}
		payload := map[string]any{"companyId": companyID}
		if input.SubscriptionStatus != nil {
			payload["subscriptionStatus"] = *input.SubscriptionStatus
		}
		if input.SubscriptionNote != nil {
			payload["subscriptionNote"] = *input.SubscriptionNote
		}
		if input.ExtendTrialDays != nil {
			payload["extendTrialDays"] = *input.ExtendTrialDays
		}
		if input.TrialEndsAt != nil {
			payload["trialEndsAt"] = *input.TrialEndsAt
		}
		return s.repo.InsertScheduledJob(ctx, "subscription", runAt, payload, "")
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
	if input.TrialEndsAt != nil && strings.TrimSpace(*input.TrialEndsAt) != "" {
		end, err := time.Parse(time.RFC3339, strings.TrimSpace(*input.TrialEndsAt))
		if err != nil {
			end, err = time.Parse("2006-01-02", strings.TrimSpace(*input.TrialEndsAt))
		}
		if err != nil {
			return nil, errForbidden("trialEndsAt noto'g'ri sana")
		}
		sets["trialEndsAt"] = end
		sets["subscriptionStatus"] = "TRIAL"
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
		if *input.SubscriptionStatus == "TRIAL" && (input.ExtendTrialDays == nil || *input.ExtendTrialDays == 0) && input.TrialEndsAt == nil {
			sets["trialEndsAt"] = computeTrialEndsAt()
		}
	}
	if input.CompanyStatus != nil && strings.TrimSpace(*input.CompanyStatus) != "" {
		st := strings.TrimSpace(*input.CompanyStatus)
		if st != "active" && st != "suspended" {
			return nil, errForbidden("companyStatus faqat active yoki suspended")
		}
		sets["status"] = st
	}
	_ = company
	return s.repo.UpdateCompanySubscription(ctx, companyID, sets)
}

func (s *Service) BroadcastToUsers(ctx context.Context, input BroadcastNotificationInput) (map[string]any, error) {
	if input.ScheduledAt != nil && strings.TrimSpace(*input.ScheduledAt) != "" {
		runAt, err := time.Parse(time.RFC3339, strings.TrimSpace(*input.ScheduledAt))
		if err != nil {
			return nil, errForbidden("scheduledAt noto'g'ri format (ISO 8601)")
		}
		if !runAt.After(time.Now()) {
			return nil, errForbidden("Reja vaqti kelajakda bo'lishi kerak")
		}
		ntype := "INFO"
		if input.Type != nil && strings.TrimSpace(*input.Type) != "" {
			ntype = strings.TrimSpace(*input.Type)
		}
		payload := map[string]any{
			"title": input.Title, "message": input.Message, "type": ntype,
			"target": input.Target, "companyIds": input.CompanyIDs, "userIds": input.UserIDs,
		}
		job, err := s.repo.InsertScheduledJob(ctx, "broadcast", runAt, payload, "")
		if err != nil {
			return nil, err
		}
		return map[string]any{"scheduled": true, "job": job}, nil
	}

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

func (s *Service) ListScheduledJobs(ctx context.Context, status string, page, limit int) (map[string]any, error) {
	if page < 1 {
		page = 1
	}
	if limit < 10 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListScheduledJobs(ctx, status, page, limit)
}

func (s *Service) CancelScheduledJob(ctx context.Context, jobID string) error {
	return s.repo.CancelScheduledJob(ctx, jobID)
}

func (s *Service) RedisHealth(ctx context.Context) (map[string]any, error) {
	return map[string]any{
		"cache": s.cache.Diagnostics(),
		"ping":  s.cache.Ping(ctx),
	}, nil
}
