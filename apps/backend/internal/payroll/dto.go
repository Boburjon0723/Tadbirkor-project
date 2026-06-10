package payroll

type UpdatePayrollSettingsInput struct {
	WorkedDaysMode string `json:"workedDaysMode"` // AUTO | MANUAL
}

type CreateLeaveRequestInput struct {
	DaysCount int    `json:"daysCount"`
	StartDate string `json:"startDate"`
	Reason    string `json:"reason"`
}

type CreateMemberLeaveInput struct {
	DaysCount int    `json:"daysCount"`
	StartDate string `json:"startDate"`
	Reason    string `json:"reason"`
}

type ReviewLeaveRequestInput struct {
	ReviewNote string `json:"reviewNote"`
}

type UpdateWorkMonthInput struct {
	TotalDays  *int `json:"totalDays,omitempty"`
	WorkedDays *int `json:"workedDays,omitempty"`
}

type UpsertPayrollProfileInput struct {
	MonthlyPaidLeaveQuota int `json:"monthlyPaidLeaveQuota"`
}

type UpsertCompensationInput struct {
	CompanyUserID string  `json:"companyUserId"`
	EmployeeName  string  `json:"employeeName"`
	EmployeeRole  string  `json:"employeeRole"`
	BaseSalary    float64 `json:"baseSalary"`
	Currency      *string `json:"currency,omitempty"`
	EffectiveFrom *string `json:"effectiveFrom,omitempty"`
}

type UpsertPayrollEmployeeInput struct {
	FirstName             *string `json:"firstName,omitempty"`
	LastName              *string `json:"lastName,omitempty"`
	Position              *string `json:"position,omitempty"`
	Department            *string `json:"department,omitempty"`
	Address               *string `json:"address,omitempty"`
	Email                 *string `json:"email,omitempty"`
	Notes                 *string `json:"notes,omitempty"`
	Phone                 *string `json:"phone,omitempty"`
	Role                  *string `json:"role,omitempty"`
	MonthlyPaidLeaveQuota *int    `json:"monthlyPaidLeaveQuota,omitempty"`
	LeftAt                *string `json:"leftAt,omitempty"`
	EmploymentStatus      *string `json:"employmentStatus,omitempty"`
}

type CreatePayrollOnlyMemberInput struct {
	FirstName             string  `json:"firstName"`
	LastName              string  `json:"lastName"`
	Position              string  `json:"position"`
	Department            string  `json:"department"`
	Role                  string  `json:"role"`
	Phone                 string  `json:"phone"`
	Address               *string `json:"address,omitempty"`
	Notes                 *string `json:"notes,omitempty"`
	BaseSalary            float64 `json:"baseSalary"`
	Currency              *string `json:"currency,omitempty"`
	MonthlyPaidLeaveQuota *int    `json:"monthlyPaidLeaveQuota,omitempty"`
}

type AddPayrollAdvanceInput struct {
	CompanyUserID string  `json:"companyUserId"`
	Year          int     `json:"year"`
	Month         int     `json:"month"`
	Amount        float64 `json:"amount"`
	Reason        string  `json:"reason"`
	AdvanceDate   *string `json:"advanceDate,omitempty"`
}

type AddPayrollBonusInput struct {
	CompanyUserID string  `json:"companyUserId"`
	Year          int     `json:"year"`
	Month         int     `json:"month"`
	Amount        float64 `json:"amount"`
	Reason        *string `json:"reason,omitempty"`
}

type UpsertPayrollSettlementInput struct {
	BaseSalary     float64 `json:"baseSalary"`
	TotalDays      int     `json:"totalDays"`
	WorkedDays     int     `json:"workedDays"`
	Bonus          *float64 `json:"bonus,omitempty"`
	Penalties      *float64 `json:"penalties,omitempty"`
	ConfirmPayment *bool   `json:"confirmPayment,omitempty"`
}

type MarkEmployeeLeftInput struct {
	LeftAt string `json:"leftAt"`
}
