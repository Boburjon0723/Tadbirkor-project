package payroll

import (
	"context"
	"time"
)

// AssertPayrollModule — telegram bot uchun payroll modulini tekshirish.
func (s *LeaveService) AssertPayrollModule(ctx context.Context, companyID string) error {
	return s.assertPayroll(ctx, companyID)
}

// CreateLeaveFromBot — bot orqali tez dam olish so'rovi.
func (s *LeaveService) CreateLeaveFromBot(ctx context.Context, companyID, userID string, daysCount, startOffsetDays int, reason string) (map[string]any, error) {
	start := addDaysUTC(toDateOnlyUTC(time.Now().UTC()), startOffsetDays)
	return s.CreateLeaveRequest(ctx, companyID, userID, CreateLeaveRequestInput{
		DaysCount: daysCount,
		StartDate: start.Format("2006-01-02"),
		Reason:    reason,
	})
}

func toDateOnlyUTC(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// GetWorkMonthForBot — ish haqi boti uchun ish kunlari + sozlamalar.
func (s *LeaveService) GetWorkMonthForBot(ctx context.Context, companyID, companyUserID string, year, month int) (map[string]any, error) {
	wm, err := s.GetWorkMonth(ctx, companyID, companyUserID, year, month)
	if err != nil {
		return nil, err
	}
	mode, _ := s.repo.GetSettings(ctx, companyID)
	if mode == "" {
		mode = "AUTO"
	}
	wm["workedDaysMode"] = mode
	return wm, nil
}

// GetRosterMember — oylik ro'yxatidagi xodim.
func (s *LeaveService) GetRosterMember(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	members, err := s.ListCompanyMembers(ctx, companyID)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		if id, _ := m["id"].(string); id == companyUserID {
			return m, nil
		}
	}
	return nil, ErrNotFound
}

// GetActiveCompensation — faol oylik maoshi.
func (s *DataService) GetActiveCompensation(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	comp, err := s.repo.findActiveCompensation(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if comp == nil {
		return nil, ErrNotFound
	}
	return comp, nil
}

// SumAdvances — oy bo'yicha avanslar yig'indisi.
func (s *DataService) SumAdvances(ctx context.Context, companyID, companyUserID string, year, month int) (float64, error) {
	advances, err := s.ListAdvances(ctx, companyID, companyUserID, year, month)
	if err != nil {
		return 0, err
	}
	total := 0.0
	for _, a := range advances {
		if v, ok := a["amount"].(float64); ok {
			total += v
		}
	}
	return total, nil
}
