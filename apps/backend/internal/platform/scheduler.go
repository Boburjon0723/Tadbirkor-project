package platform

import (
	"context"
	"log"
	"time"
)

func (s *Service) StartScheduler(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.runDueJobs(ctx)
			}
		}
	}()
}

func (s *Service) runDueJobs(ctx context.Context) {
	jobs, err := s.repo.ClaimDueJobs(ctx, 25)
	if err != nil {
		log.Printf("platform scheduler: %v", err)
		return
	}
	for _, job := range jobs {
		var runErr error
		switch job.Kind {
		case "broadcast":
			runErr = s.executeBroadcastJob(ctx, job.Payload)
		case "subscription":
			runErr = s.executeSubscriptionJob(ctx, job.Payload)
		default:
			runErr = s.repo.MarkJobFailed(ctx, job.ID, "noma'lum job turi: "+job.Kind)
			continue
		}
		if runErr != nil {
			_ = s.repo.MarkJobFailed(ctx, job.ID, runErr.Error())
			log.Printf("platform job %s failed: %v", job.ID, runErr)
			continue
		}
		_ = s.repo.MarkJobDone(ctx, job.ID)
	}
}

func (s *Service) executeBroadcastJob(ctx context.Context, payload map[string]any) error {
	input := BroadcastNotificationInput{
		Title:   strVal(payload["title"]),
		Message: strVal(payload["message"]),
		Target:  strVal(payload["target"]),
	}
	if t := strVal(payload["type"]); t != "" {
		input.Type = &t
	}
	input.CompanyIDs = strSlice(payload["companyIds"])
	input.UserIDs = strSlice(payload["userIds"])
	_, err := s.BroadcastToUsers(ctx, input)
	return err
}

func (s *Service) executeSubscriptionJob(ctx context.Context, payload map[string]any) error {
	companyID := strVal(payload["companyId"])
	if companyID == "" {
		return errForbidden("companyId majburiy")
	}
	input := UpdateCompanySubscriptionInput{}
	if st := strVal(payload["subscriptionStatus"]); st != "" {
		input.SubscriptionStatus = &st
	}
	if note, ok := payload["subscriptionNote"].(string); ok {
		input.SubscriptionNote = &note
	}
	if days, ok := payload["extendTrialDays"].(float64); ok && days > 0 {
		d := int(days)
		input.ExtendTrialDays = &d
	}
	if te := strVal(payload["trialEndsAt"]); te != "" {
		input.TrialEndsAt = &te
	}
	_, err := s.UpdateCompanySubscription(ctx, companyID, input)
	return err
}

func strVal(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func strSlice(v any) []string {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out
}
