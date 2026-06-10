package payroll

import "math"

func computeWorkedDaysForSalaryCap(totalDays, workedDaysFromRecord, excessLeaveDays int, isManual bool, workedDaysMode string) int {
	total := totalDays
	if total < 0 {
		total = 0
	}
	leaveAdjusted := total - excessLeaveDays
	if leaveAdjusted < 0 {
		leaveAdjusted = 0
	}
	if workedDaysMode == "MANUAL" && isManual {
		w := workedDaysFromRecord
		if w < 0 {
			w = 0
		}
		if w > total {
			w = total
		}
		if w > leaveAdjusted {
			w = leaveAdjusted
		}
		return w
	}
	return leaveAdjusted
}

func computeEffectiveSalaryCap(baseSalary float64, totalDays, workedDays int) float64 {
	if baseSalary <= 0 || totalDays <= 0 {
		return baseSalary
	}
	worked := workedDays
	if worked < 0 {
		worked = 0
	}
	if worked > totalDays {
		worked = totalDays
	}
	return math.Max(0, math.Round((baseSalary/float64(totalDays))*float64(worked)))
}

func ComputeWorkedDaysForSalaryCapExported(totalDays, workedDaysFromRecord, excessLeaveDays int, isManual bool, workedDaysMode string) int {
	return computeWorkedDaysForSalaryCap(totalDays, workedDaysFromRecord, excessLeaveDays, isManual, workedDaysMode)
}

func ComputeEffectiveSalaryCapExported(baseSalary float64, totalDays, workedDays int) float64 {
	return computeEffectiveSalaryCap(baseSalary, totalDays, workedDays)
}

func computeFinalPayrollPayment(baseSalary float64, totalDays, workedDays int, bonus, penalties, advancesTotal float64) float64 {
	if totalDays <= 0 {
		return 0
	}
	worked := workedDays
	if worked < 0 {
		worked = 0
	}
	if worked > totalDays {
		worked = totalDays
	}
	proportional := (baseSalary / float64(totalDays)) * float64(worked)
	net := proportional + bonus - penalties - advancesTotal
	return math.Max(0, math.Round(net))
}
