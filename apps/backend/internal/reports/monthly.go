package reports

import (
	"context"
	"time"

	"github.com/tadbirkor/axis-erp/backend/internal/expenses"
	"github.com/tadbirkor/axis-erp/backend/internal/income"
)

func monthDateRange(year, month int) (string, string) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, -1)
	return start.Format("2006-01-02"), end.Format("2006-01-02")
}

func addFromCurrencyMap(target *currencyBucket, source map[string]float64) {
	for k, v := range source {
		bucketAdd(target, k, v)
	}
}

func (s *Service) GetMonthlyOverview(
	ctx context.Context,
	companyID string,
	query MonthlyOverviewQueryInput,
) (map[string]any, error) {
	now := time.Now().UTC()
	year := query.Year
	if year <= 0 {
		year = now.Year()
	}
	month := query.Month
	if month <= 0 || month > 12 {
		month = int(now.Month())
	}
	from, to := monthDateRange(year, month)

	posOn, err := s.companies.IsModuleEnabled(ctx, companyID, "POS")
	if err != nil {
		return nil, err
	}
	incomeOn, err := s.companies.IsModuleEnabled(ctx, companyID, "INCOME")
	if err != nil {
		return nil, err
	}
	expensesOn, err := s.companies.IsModuleEnabled(ctx, companyID, "EXPENSES")
	if err != nil {
		return nil, err
	}
	payrollOn, err := s.companies.IsModuleEnabled(ctx, companyID, "PAYROLL")
	if err != nil {
		return nil, err
	}

	modules := map[string]bool{
		"pos":      posOn,
		"income":   incomeOn,
		"expenses": expensesOn,
		"payroll":  payrollOn,
	}

	var posSummary map[string]any
	if posOn {
		posSummary, err = s.GetPosSummary(ctx, companyID, "", ReportQueryInput{
			DateFrom: &from,
			DateTo:   &to,
		})
		if err != nil {
			return nil, err
		}
	}

	var incomeSummary *income.IncomeSummaryResponse
	if incomeOn {
		fromDate := parseDateForFilter(&from, false)
		toDate := parseDateForFilter(&to, true)
		incomeSummary, err = s.income.GetSummary(ctx, companyID, income.IncomeFilter{
			From: fromDate,
			To:   toDate,
		})
		if err != nil {
			return nil, err
		}
	}

	var expensesSummary *expenses.ExpenseSummaryResponse
	if expensesOn {
		fromDate := parseDateForFilter(&from, false)
		toDate := parseDateForFilter(&to, true)
		expensesSummary, err = s.expenses.GetSummary(ctx, companyID, expenses.ExpenseFilter{
			From: fromDate,
			To:   toDate,
		})
		if err != nil {
			return nil, err
		}
	}

	var payrollSummary map[string]any
	if payrollOn {
		payrollSummary, err = s.payroll.GetMonthlyCostSummary(ctx, companyID, year, month)
		if err != nil {
			return nil, err
		}
	}

	cashIn := newBucket()
	cashOut := newBucket()

	if posSummary != nil {
		if cashSales, ok := posSummary["cashSales"].(currencyBucket); ok {
			cashIn.UZS += cashSales.UZS
			cashIn.USD += cashSales.USD
		} else if cashSales, ok := posSummary["cashSales"].(map[string]any); ok {
			cashIn.UZS += anyToFloat(cashSales["UZS"])
			cashIn.USD += anyToFloat(cashSales["USD"])
		}
		if cardSales, ok := posSummary["cardSales"].(currencyBucket); ok {
			cashIn.UZS += cardSales.UZS
			cashIn.USD += cardSales.USD
		} else if cardSales, ok := posSummary["cardSales"].(map[string]any); ok {
			cashIn.UZS += anyToFloat(cardSales["UZS"])
			cashIn.USD += anyToFloat(cardSales["USD"])
		}
	}
	if incomeSummary != nil {
		addFromCurrencyMap(&cashIn, incomeSummary.Totals)
	}
	if expensesSummary != nil {
		addFromCurrencyMap(&cashOut, expensesSummary.Approved)
	}
	if payrollSummary != nil {
		cashOut.UZS += anyToFloat(payrollSummary["cashOutUZS"])
	}

	netProfitUZS := round2(cashIn.UZS - cashOut.UZS)
	netProfitUSD := round2(cashIn.USD - cashOut.USD)
	status := "NEUTRAL"
	if netProfitUZS > 0 {
		status = "PROFIT"
	}
	if netProfitUZS < 0 {
		status = "LOSS"
	}

	warnings := []string{}
	if posSummary != nil && incomeSummary != nil {
		warnings = append(warnings, "POS savdo va Kirimlar daftarini bir xil summani ikki marta kiritmaslik kerak.")
	}

	return map[string]any{
		"period": map[string]any{
			"from":  from,
			"to":    to,
			"year":  year,
			"month": month,
		},
		"modules": modules,
		"mode":    "CASH_FLOW",
		"revenue": map[string]any{
			"pos":    posSummary,
			"income": incomeSummary,
		},
		"costs": map[string]any{
			"expenses": expensesSummary,
			"payroll":  payrollSummary,
		},
		"result": map[string]any{
			"cashIn":  roundedBucket(cashIn),
			"cashOut": roundedBucket(cashOut),
			"netProfit": map[string]any{
				"UZS": netProfitUZS,
				"USD": netProfitUSD,
			},
			"status": status,
		},
		"warnings": warnings,
	}, nil
}

func anyToFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}
