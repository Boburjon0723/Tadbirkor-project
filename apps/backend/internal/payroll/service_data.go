package payroll

import (
	"context"
	"strings"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/companies"
)

type DataService struct {
	repo      *Repository
	leave     *LeaveService
	companies *companies.Service
}

func NewDataService(repo *Repository, leave *LeaveService, companiesSvc *companies.Service) *DataService {
	return &DataService{repo: repo, leave: leave, companies: companiesSvc}
}

func (s *DataService) assertPayroll(ctx context.Context, companyID string) error {
	return s.companies.AssertModuleEnabled(ctx, companyID, "PAYROLL")
}

func (s *DataService) assertManager(ctx context.Context, companyID, actorUserID string) error {
	member, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return err
	}
	if !isApprover(member.Role) {
		return errForbidden("Faqat owner yoki menejer tahrirlaydi")
	}
	return nil
}

func (s *DataService) UpsertCompensation(ctx context.Context, companyID, actorUserID string, input UpsertCompensationInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, input.CompanyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	effectiveFrom := time.Now().UTC()
	if input.EffectiveFrom != nil && *input.EffectiveFrom != "" {
		t, err := parseDateOnly(*input.EffectiveFrom)
		if err != nil {
			return nil, errBadRequest(err.Error())
		}
		effectiveFrom = t
	}
	return s.repo.upsertCompensationRecord(ctx, companyID, input, effectiveFrom)
}

func (s *DataService) ListCompensations(ctx context.Context, companyID string) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.listCompensations(ctx, companyID)
}

func (s *DataService) ListEmployeeExtras(ctx context.Context, companyID string) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.listEmployeeExtras(ctx, companyID)
}

func (s *DataService) GetEmployeeExtra(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.getEmployeeExtra(ctx, companyID, companyUserID)
}

func (s *DataService) UpsertEmployeeExtra(ctx context.Context, companyID, actorUserID, companyUserID string, input UpsertPayrollEmployeeInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	return s.repo.upsertEmployeeProfile(ctx, companyUserID, input)
}

func (s *DataService) ListRosterCandidates(ctx context.Context, companyID string) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	return s.repo.listRosterCandidates(ctx, companyID)
}

func (s *DataService) AddMemberToPayrollRoster(ctx context.Context, companyID, actorUserID, companyUserID string) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	member, err := s.repo.getMembership(ctx, companyID, actorUserID)
	if err != nil {
		return nil, err
	}
	_ = member
	target, err := s.repo.getMembershipByCompanyUserID(ctx, companyID, companyUserID)
	if err != nil {
		return nil, ErrNotFound
	}
	if err := s.repo.markOnPayrollRoster(ctx, companyUserID); err != nil {
		return nil, err
	}
	return map[string]any{"companyUserId": companyUserID, "fullName": target.UserFullName}, nil
}

func (s *DataService) CreatePayrollOnlyMember(ctx context.Context, companyID, actorUserID string, input CreatePayrollOnlyMemberInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	return s.repo.createPayrollOnlyMember(ctx, companyID, input)
}

func (s *DataService) MarkEmployeeLeft(ctx context.Context, companyID, actorUserID, companyUserID string, input MarkEmployeeLeftInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	if err := s.repo.MarkEmployeeLeft(ctx, companyUserID, input.LeftAt); err != nil {
		return nil, err
	}
	return map[string]any{"companyUserId": companyUserID, "leftAt": input.LeftAt}, nil
}

func (s *DataService) ListAdvances(ctx context.Context, companyID, companyUserID string, year, month int) ([]map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	return s.repo.listAdvances(ctx, companyID, companyUserID, year, month)
}

func (s *DataService) AddAdvance(ctx context.Context, companyID, actorUserID string, input AddPayrollAdvanceInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, input.CompanyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	if err := s.repo.AddAdvance(ctx, companyID, input); err != nil {
		return nil, err
	}
	paymentCompleted, _ := s.syncPaymentIfAdvancesCoverSalary(ctx, companyID, input.CompanyUserID, input.Year, input.Month)
	advances, _ := s.repo.listAdvances(ctx, companyID, input.CompanyUserID, input.Year, input.Month)
	var last map[string]any
	if len(advances) > 0 {
		last = advances[0]
	}
	if last == nil {
		last = map[string]any{"paymentCompleted": paymentCompleted}
	} else {
		last["paymentCompleted"] = paymentCompleted
	}
	return last, nil
}

func (s *DataService) AddBonus(ctx context.Context, companyID, actorUserID string, input AddPayrollBonusInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, input.CompanyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	comp, err := s.repo.findActiveCompensation(ctx, companyID, input.CompanyUserID)
	if err != nil || comp == nil {
		return nil, errBadRequest("Avval oylik maosh belgilang")
	}
	baseSalary := comp["baseSalary"].(float64)
	if baseSalary <= 0 {
		return nil, errBadRequest("Avval oylik maosh belgilang")
	}
	wm, err := s.leave.GetWorkMonth(ctx, companyID, input.CompanyUserID, input.Year, input.Month)
	if err != nil {
		return nil, err
	}
	totalDays := wm["totalDays"].(int)
	workedDays := wm["workedDays"].(int)
	newBonus, err := s.repo.addBonusToSettlement(ctx, companyID, input.CompanyUserID, input.Year, input.Month, baseSalary, totalDays, workedDays, input.Amount)
	if err != nil {
		return nil, err
	}
	reason := any(nil)
	if input.Reason != nil {
		reason = strings.TrimSpace(*input.Reason)
	}
	return map[string]any{
		"companyUserId": input.CompanyUserID,
		"year":          input.Year,
		"month":         input.Month,
		"amountAdded":   input.Amount,
		"bonusTotal":    newBonus,
		"reason":        reason,
	}, nil
}

func (s *DataService) GetSettlement(ctx context.Context, companyID, companyUserID string, year, month int, defaultBase float64) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	row, found, err := s.repo.getSettlement(ctx, companyUserID, year, month)
	if err != nil {
		return nil, err
	}
	if found {
		row["companyUserId"] = companyUserID
		row["year"] = year
		row["month"] = month
		return row, nil
	}
	total := countWeekdaysInMonth(year, month)
	worked := total - 1
	if worked < 1 {
		worked = 1
	}
	return map[string]any{
		"companyUserId": companyUserID, "year": year, "month": month,
		"baseSalary": defaultBase, "totalDays": total, "workedDays": worked,
		"bonus": 0.0, "penalties": 0.0, "paymentConfirmedAt": nil,
	}, nil
}

func (s *DataService) UpsertSettlement(ctx context.Context, companyID, actorUserID, companyUserID string, year, month int, input UpsertPayrollSettlementInput) (map[string]any, error) {
	if err := s.assertManager(ctx, companyID, actorUserID); err != nil {
		return nil, err
	}
	ok, err := s.repo.companyUserExists(ctx, companyID, companyUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	year, month = defaultYearMonth(year, month)
	if err := s.repo.UpsertSettlement(ctx, companyID, companyUserID, year, month, input); err != nil {
		return nil, err
	}
	advances, _ := s.repo.listAdvances(ctx, companyID, companyUserID, year, month)
	advTotal := 0.0
	for _, a := range advances {
		advTotal += a["amount"].(float64)
	}
	bonus := 0.0
	if input.Bonus != nil {
		bonus = *input.Bonus
	}
	penalties := 0.0
	if input.Penalties != nil {
		penalties = *input.Penalties
	}
	finalAmount := computeFinalPayrollPayment(input.BaseSalary, input.TotalDays, input.WorkedDays, bonus, penalties, advTotal)
	row, _, _ := s.repo.getSettlement(ctx, companyUserID, year, month)
	calc := map[string]any{
		"companyUserId": companyUserID, "year": year, "month": month,
		"baseSalary": input.BaseSalary, "totalDays": input.TotalDays, "workedDays": input.WorkedDays,
		"bonus": bonus, "penalties": penalties,
	}
	if row != nil {
		calc["paymentConfirmedAt"] = row["paymentConfirmedAt"]
	}
	return map[string]any{
		"calculation":   calc,
		"finalAmount":   finalAmount,
		"advancesTotal": advTotal,
	}, nil
}

func (s *DataService) GetMonthStats(ctx context.Context, companyID string, year, month int, companyUserIDs []string) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	if len(companyUserIDs) == 0 {
		var err error
		companyUserIDs, err = s.repo.rosterCompanyUserIDs(ctx, companyID)
		if err != nil {
			return nil, err
		}
	}
	idSet := map[string]bool{}
	for _, id := range companyUserIDs {
		idSet[id] = true
	}

	compensations, _ := s.repo.listCompensations(ctx, companyID)
	totalBaseUZS, totalBaseUSD := 0.0, 0.0
	compByUser := map[string]map[string]any{}
	for _, c := range compensations {
		id := c["companyUserId"].(string)
		if !idSet[id] {
			continue
		}
		compByUser[id] = c
		amt := c["baseSalary"].(float64)
		if c["currency"] == "USD" {
			totalBaseUSD += amt
		} else {
			totalBaseUZS += amt
		}
	}

	advancesByUser := map[string]float64{}
	for _, id := range companyUserIDs {
		advancesByUser[id] = 0
	}
	totalAdvances := 0.0
	for _, id := range companyUserIDs {
		rows, _ := s.repo.listAdvances(ctx, companyID, id, year, month)
		for _, a := range rows {
			amt := a["amount"].(float64)
			advancesByUser[id] += amt
			totalAdvances += amt
		}
	}

	paymentConfirmedByUser := map[string]bool{}
	paidAmountByUser := map[string]float64{}
	bonusByUser := map[string]float64{}
	leaveDaysByUser := map[string]int{}
	for _, id := range companyUserIDs {
		paymentConfirmedByUser[id] = false
		paidAmountByUser[id] = 0
		bonusByUser[id] = 0
		leaveDaysByUser[id] = 0
	}

	totalPaid, totalBonus, paidCount := 0.0, 0.0, 0
	for _, id := range companyUserIDs {
		settlement, found, _ := s.repo.getSettlement(ctx, id, year, month)
		if found {
			bonusByUser[id] = settlement["bonus"].(float64)
			totalBonus += settlement["bonus"].(float64)
			if settlement["paymentConfirmedAt"] != nil {
				paymentConfirmedByUser[id] = true
				paidCount++
				paidAmountByUser[id] = advancesByUser[id]
				totalPaid += advancesByUser[id]
			}
		}
		leaves, _ := s.repo.listApprovedLeavesForMonth(ctx, companyID, id, year, month)
		for _, l := range leaves {
			start := l["startDate"].(time.Time)
			end := l["endDate"].(time.Time)
			leaveDaysByUser[id] += countLeaveWeekdaysInMonth(start, end, year, month)
		}
	}

	totalOpen := 0.0
	for _, id := range companyUserIDs {
		if paymentConfirmedByUser[id] {
			continue
		}
		totalOpen += advancesByUser[id]
	}

	return map[string]any{
		"totalBaseSalaryUZS":            totalBaseUZS,
		"totalBaseSalaryUSD":            totalBaseUSD,
		"totalAdvancesUZS":              totalAdvances,
		"totalOpenAdvancesUZS":          totalOpen,
		"totalPaidUZS":                  totalPaid,
		"totalBonusUZS":                 totalBonus,
		"totalPaidIncludingBonusUZS":    totalPaid + totalBonus,
		"paidEmployeeCount":             paidCount,
		"advancesByUser":                advancesByUser,
		"leaveDaysByUser":               leaveDaysByUser,
		"paidAmountByUser":              paidAmountByUser,
		"paymentConfirmedByUser":        paymentConfirmedByUser,
		"bonusByUser":                   bonusByUser,
	}, nil
}

func (s *DataService) syncPaymentIfAdvancesCoverSalary(ctx context.Context, companyID, companyUserID string, year, month int) (bool, error) {
	comp, err := s.repo.findActiveCompensation(ctx, companyID, companyUserID)
	if err != nil || comp == nil {
		return false, err
	}
	baseSalary := comp["baseSalary"].(float64)
	if baseSalary <= 0 {
		return false, nil
	}
	wm, err := s.leave.GetWorkMonth(ctx, companyID, companyUserID, year, month)
	if err != nil {
		return false, err
	}
	cap := computeEffectiveSalaryCap(baseSalary, wm["totalDays"].(int), wm["workedDays"].(int))
	if cap <= 0 {
		return false, nil
	}
	advances, _ := s.repo.listAdvances(ctx, companyID, companyUserID, year, month)
	total := 0.0
	for _, a := range advances {
		total += a["amount"].(float64)
	}
	if total < cap {
		return false, nil
	}
	bonus := 0.0
	penalties := 0.0
	if row, found, _ := s.repo.getSettlement(ctx, companyUserID, year, month); found {
		bonus = row["bonus"].(float64)
		penalties = row["penalties"].(float64)
	}
	err = s.repo.confirmSettlementPayment(ctx, companyUserID, year, month, baseSalary, wm["totalDays"].(int), wm["workedDays"].(int), bonus, penalties)
	return err == nil, err
}

func (s *DataService) GetMonthlyCostSummary(ctx context.Context, companyID string, year, month int) (map[string]any, error) {
	if err := s.assertPayroll(ctx, companyID); err != nil {
		return nil, err
	}
	year, month = defaultYearMonth(year, month)
	ids, err := s.repo.rosterCompanyUserIDs(ctx, companyID)
	if err != nil {
		return nil, err
	}
	stats, err := s.GetMonthStats(ctx, companyID, year, month, ids)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"rosterCount":           len(ids),
		"advancesUZS":           stats["totalAdvancesUZS"],
		"bonusUZS":              stats["totalBonusUZS"],
		"openAdvancesUZS":       stats["totalOpenAdvancesUZS"],
		"paidIncludingBonusUZS": stats["totalPaidIncludingBonusUZS"],
		"accruedSalaryUZS":      stats["totalPaidIncludingBonusUZS"],
		"cashOutUZS":            stats["totalAdvancesUZS"].(float64) + stats["totalBonusUZS"].(float64),
	}, nil
}
