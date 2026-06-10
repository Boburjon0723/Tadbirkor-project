package payroll

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
)

var (
	staffRolesForLeave = map[string]bool{
		"WORKER": true, "FIELD_WORKER": true, "WAREHOUSE": true, "SALES": true, "ACCOUNTANT": true,
	}
	leaveApproverRoles = map[string]bool{"OWNER": true, "MANAGER": true}
)

type LeaveService struct {
	repo      *Repository
	companies *companies.Service
	notify    *notifications.Service
}

func NewLeaveService(repo *Repository, companiesSvc *companies.Service, notify *notifications.Service) *LeaveService {
	return &LeaveService{repo: repo, companies: companiesSvc, notify: notify}
}

func (s *LeaveService) assertPayroll(ctx context.Context, companyID string) error {
	return s.companies.AssertModuleEnabled(ctx, companyID, "PAYROLL")
}

func isApprover(role string) bool {
	return leaveApproverRoles[strings.ToUpper(strings.TrimSpace(role))]
}

func (s *LeaveService) GetSettings(ctx context.Context, companyID string) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	mode, err := s.repo.GetSettings(ctx, companyID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"workedDaysMode": mode}, nil
}

func (s *LeaveService) UpdateSettings(ctx context.Context, companyID, mode string) error {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return err
	}
	return s.repo.UpdateSettings(ctx, companyID, mode)
}

func (s *LeaveService) ListLeaveRequests(ctx context.Context, companyID, userID, status string, mine bool) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	member, err := s.repo.getMembership(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	var filterUser *string
	if mine || !isApprover(member.Role) {
		filterUser = &member.ID
	}
	st := strings.ToUpper(strings.TrimSpace(status))
	return s.repo.listLeaveRequests(ctx, companyID, filterUser, st)
}

func (s *LeaveService) CountPendingLeave(ctx context.Context, companyID, userID string) (map[string]int, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	member, err := s.repo.getMembership(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	if !isApprover(member.Role) {
		return map[string]int{"count": 0}, nil
	}
	count, err := s.repo.countPendingLeave(ctx, companyID)
	if err != nil {
		return nil, err
	}
	return map[string]int{"count": count}, nil
}

func (s *LeaveService) CreateLeaveRequest(ctx context.Context, companyID, userID string, input CreateLeaveRequestInput) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	member, err := s.repo.getMembership(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	if !staffRolesForLeave[strings.ToUpper(member.Role)] {
		return nil, errForbidden("Dam olish so'rovi faqat xodimlar uchun")
	}
	start, err := parseDateOnly(input.StartDate)
	if err != nil {
		return nil, errBadRequest(err.Error())
	}
	end := endDateFromStartAndDays(start, input.DaysCount)
	if countWeekdaysInclusive(start, end) < 1 {
		return nil, errBadRequest("Tanlangan oralig'da ish kuni yo'q (dam olish kunlari)")
	}
	overlap, err := s.repo.hasLeaveOverlap(ctx, member.ID, start, end)
	if err != nil {
		return nil, err
	}
	if overlap {
		return nil, errBadRequest("Bu sanalarda allaqachon dam olish mavjud")
	}
	var reason *string
	if strings.TrimSpace(input.Reason) != "" {
		r := strings.TrimSpace(input.Reason)
		reason = &r
	}
	statusPending := "PENDING"
	req, err := s.repo.createLeaveRequest(ctx, companyID, member.ID, start, end, input.DaysCount, reason, &statusPending, nil, nil)
	if err != nil {
		return nil, err
	}
	reqID, _ := req["id"].(string)
	empName, _ := req["employeeName"].(string)
	if empName == "" {
		empName, _ = req["fullName"].(string)
	}
	days, _ := req["daysCount"].(float64)
	startStr, _ := req["startDate"].(string)
	endStr, _ := req["endDate"].(string)
	msg := fmt.Sprintf("%s — %.0f kun (%s — %s).", empName, days, startStr, endStr)
	_ = s.notify.NotifyCompanyRoles(ctx, companyID, []string{"OWNER", "MANAGER"},
		"Dam olish so'rovi", msg, "WARNING", "PAYROLL", "payroll.leave.requested",
		&notifications.TelegramPayload{
			ModuleKey: "PAYROLL", EventKey: "payroll.leave.requested",
			TargetRoles: []string{"OWNER", "MANAGER"},
			Details: map[string]any{"leaveRequestId": reqID, "employeeName": empName, "daysCount": days},
			Actions: []notifications.TelegramAction{
				{Key: "LEAVE_APPROVE", Label: "✅ Tasdiqlash", TargetType: "EMPLOYEE_LEAVE_REQUEST", TargetID: reqID},
				{Key: "LEAVE_REJECT", Label: "❌ Rad etish", TargetType: "EMPLOYEE_LEAVE_REQUEST", TargetID: reqID},
			},
		})
	return req, nil
}


func (s *LeaveService) ApproveLeaveRequest(ctx context.Context, companyID, reviewerUserID, requestID string, reviewNote *string) (map[string]any, error) {
	return s.reviewLeave(ctx, companyID, reviewerUserID, requestID, "APPROVED", reviewNote, true)
}

func (s *LeaveService) RejectLeaveRequest(ctx context.Context, companyID, reviewerUserID, requestID string, reviewNote *string) (map[string]any, error) {
	return s.reviewLeave(ctx, companyID, reviewerUserID, requestID, "REJECTED", reviewNote, false)
}

func (s *LeaveService) reviewLeave(ctx context.Context, companyID, reviewerUserID, requestID, status string, reviewNote *string, recalc bool) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	reviewer, err := s.repo.getMembership(ctx, companyID, reviewerUserID)
	if err != nil {
		return nil, err
	}
	if !isApprover(reviewer.Role) {
		return nil, errForbidden("Faqat owner yoki menejer tasdiqlaydi")
	}
	existing, err := s.repo.getLeaveRequest(ctx, companyID, requestID)
	if err != nil {
		return nil, err
	}
	if existing["status"] != "PENDING" {
		return nil, errBadRequest("So'rov allaqachon ko'rib chiqilgan")
	}
	updated, err := s.repo.updateLeaveStatus(ctx, requestID, status, reviewerUserID, reviewNote)
	if err != nil {
		return nil, err
	}
	if recalc {
		start := existing["startDate"].(time.Time)
		end := existing["endDate"].(time.Time)
		companyUserID := existing["companyUserId"].(string)
		_ = s.recalculateWorkMonthsAfterLeave(ctx, companyID, companyUserID, start, end)
	}
	return updated, nil
}

func (s *LeaveService) ListMemberLeaveRequests(ctx context.Context, companyID, actorUserID, companyUserID string, year, month *int) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	actor, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return nil, err
	}
	if !isApprover(actor.Role) && actor.ID != companyUserID {
		return nil, errForbidden("Ruxsat yo'q")
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	return s.repo.listMemberLeaveRequests(ctx, companyID, companyUserID, year, month)
}

func (s *LeaveService) RecordLeaveForMember(ctx context.Context, companyID, actorUserID, companyUserID string, input CreateMemberLeaveInput) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	actor, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return nil, err
	}
	if !isApprover(actor.Role) {
		return nil, errForbidden("Faqat owner yoki menejer dam olish yozadi")
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	start, err := parseDateOnly(input.StartDate)
	if err != nil {
		return nil, errBadRequest(err.Error())
	}
	end := endDateFromStartAndDays(start, input.DaysCount)
	if countWeekdaysInclusive(start, end) < 1 {
		return nil, errBadRequest("Tanlangan oralig'da dam olish kuni yo'q")
	}
	overlap, err := s.repo.hasLeaveOverlap(ctx, companyUserID, start, end)
	if err != nil {
		return nil, err
	}
	if overlap {
		return nil, errBadRequest("Bu sanalarda allaqachon dam olish mavjud")
	}
	var reason *string
	if strings.TrimSpace(input.Reason) != "" {
		r := strings.TrimSpace(input.Reason)
		reason = &r
	}
	note := "Platformada qo'lda kiritildi"
	statusApproved := "APPROVED"
	created, err := s.repo.createLeaveRequest(ctx, companyID, companyUserID, start, end, input.DaysCount, reason, &statusApproved, &actorUserID, &note)
	if err != nil {
		return nil, err
	}
	_ = s.recalculateWorkMonthsAfterLeave(ctx, companyID, companyUserID, start, end)
	return created, nil
}

func (s *LeaveService) ListApprovedLeaveDays(ctx context.Context, companyID, companyUserID string, year, month int) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	return s.repo.listApprovedLeavesForMonth(ctx, companyID, companyUserID, year, month)
}

func (s *LeaveService) ListCompanyMembers(ctx context.Context, companyID string) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.listCompanyMembers(ctx, companyID)
}

func (s *LeaveService) GetPayrollProfile(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.getPayrollProfile(ctx, companyUserID)
}

func (s *LeaveService) UpsertPayrollProfile(ctx context.Context, companyID, actorUserID, companyUserID string, quota int) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	actor, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return nil, err
	}
	if !isApprover(actor.Role) {
		return nil, errForbidden("Faqat owner yoki menejer tahrirlaydi")
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	if err := s.repo.UpsertPayrollProfile(ctx, companyUserID, quota); err != nil {
		return nil, err
	}
	return s.repo.getPayrollProfile(ctx, companyUserID)
}

func (s *LeaveService) GetWorkMonth(ctx context.Context, companyID, companyUserID string, year, month int) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	settings, _ := s.repo.GetSettings(ctx, companyID)
	row, err := s.repo.GetWorkMonth(ctx, companyID, companyUserID, year, month)
	if err == ErrNotFound && settings != "MANUAL" {
		_ = s.syncWorkMonthAuto(ctx, companyID, companyUserID, year, month)
		row, err = s.repo.GetWorkMonth(ctx, companyID, companyUserID, year, month)
	}
	if err == ErrNotFound {
		total := countWeekdaysInMonth(year, month)
		return map[string]any{
			"companyUserId": companyUserID, "year": year, "month": month,
			"totalDays": total, "workedDays": total, "isManual": false, "source": "default",
		}, nil
	}
	if err != nil {
		return nil, err
	}
	source := "auto"
	if row["isManual"].(bool) {
		source = "manual"
	}
	row["companyUserId"] = companyUserID
	row["year"] = year
	row["month"] = month
	row["source"] = source
	return row, nil
}

func (s *LeaveService) UpdateWorkMonthManual(ctx context.Context, companyID, actorUserID, companyUserID string, year, month int, input UpdateWorkMonthInput) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	actor, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return nil, err
	}
	if !isApprover(actor.Role) {
		return nil, errForbidden("Faqat owner yoki menejer tahrirlaydi")
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	year, month = defaultYearMonth(year, month)
	totalDays := countWeekdaysInMonth(year, month)
	if input.TotalDays != nil {
		totalDays = *input.TotalDays
	}
	workedDays := totalDays
	if input.WorkedDays != nil {
		workedDays = *input.WorkedDays
	} else {
		wm, err := s.GetWorkMonth(ctx, companyID, companyUserID, year, month)
		if err == nil {
			workedDays = wm["workedDays"].(int)
		}
	}
	if workedDays > totalDays {
		return nil, errBadRequest("Ishlangan kun umumiy kundan ko'p bo'lmasin")
	}
	if err := s.repo.UpsertWorkMonth(ctx, companyID, companyUserID, year, month, totalDays, workedDays, true); err != nil {
		return nil, err
	}
	return s.repo.GetWorkMonth(ctx, companyID, companyUserID, year, month)
}

func (s *LeaveService) recalculateWorkMonthsAfterLeave(ctx context.Context, companyID, companyUserID string, start, end time.Time) error {
	mode, _ := s.repo.GetSettings(ctx, companyID)
	if mode == "MANUAL" {
		return nil
	}
	for _, m := range monthsTouchedByRange(start, end) {
		_ = s.syncWorkMonthAuto(ctx, companyID, companyUserID, m.Year, m.Month)
	}
	return nil
}

func (s *LeaveService) syncWorkMonthAuto(ctx context.Context, companyID, companyUserID string, year, month int) error {
	isManual, err := s.repo.getWorkMonthManualFlag(ctx, companyUserID, year, month)
	if err != nil || isManual {
		return err
	}
	totalDays := countWeekdaysInMonth(year, month)
	leaves, err := s.repo.listApprovedLeavesOverlapping(ctx, companyID, companyUserID, year, month)
	if err != nil {
		return err
	}
	leaveDays := 0
	for _, l := range leaves {
		leaveDays += countLeaveWeekdaysInMonth(l.Start, l.End, year, month)
	}
	quota, _ := s.repo.getPaidLeaveQuota(ctx, companyUserID)
	salaryDeduct := leaveDays - quota
	if salaryDeduct < 0 {
		salaryDeduct = 0
	}
	workedDays := totalDays - salaryDeduct
	if workedDays < 0 {
		workedDays = 0
	}
	return s.repo.UpsertWorkMonth(ctx, companyID, companyUserID, year, month, totalDays, workedDays, false)
}
