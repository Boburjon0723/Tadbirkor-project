package payroll

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetSettings(ctx context.Context, companyID string) (string, error) {
	var mode string
	err := r.pool.QueryRow(ctx, `SELECT "workedDaysMode" FROM "PayrollCompanySettings" WHERE "companyId" = $1`, companyID).Scan(&mode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "AUTO", nil
		}
		return "", err
	}
	return mode, nil
}

func (r *Repository) UpdateSettings(ctx context.Context, companyID, mode string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "PayrollCompanySettings" ("companyId", "workedDaysMode", "updatedAt")
		VALUES ($1, $2, NOW())
		ON CONFLICT ("companyId") DO UPDATE SET "workedDaysMode" = EXCLUDED."workedDaysMode", "updatedAt" = NOW()
	`, companyID, mode)
	return err
}

func (r *Repository) UpsertPayrollProfile(ctx context.Context, companyUserID string, quota int) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollProfile" ("companyUserId", "monthlyPaidLeaveQuota", "updatedAt")
		VALUES ($1, $2, NOW())
		ON CONFLICT ("companyUserId") DO UPDATE SET "monthlyPaidLeaveQuota" = EXCLUDED."monthlyPaidLeaveQuota", "updatedAt" = NOW()
	`, companyUserID, quota)
	return err
}

func (r *Repository) GetWorkMonth(ctx context.Context, companyID, companyUserID string, year, month int) (map[string]any, error) {
	var total, worked int
	var isManual bool
	err := r.pool.QueryRow(ctx, `
		SELECT "totalDays", "workedDays", "isManual" 
		FROM "EmployeeWorkMonth" 
		WHERE "companyId" = $1 AND "companyUserId" = $2 AND "year" = $3 AND "month" = $4
	`, companyID, companyUserID, year, month).Scan(&total, &worked, &isManual)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return map[string]any{
		"totalDays":  total,
		"workedDays": worked,
		"isManual":   isManual,
	}, nil
}

func (r *Repository) UpsertWorkMonth(ctx context.Context, companyID, companyUserID string, year, month, totalDays, workedDays int, isManual bool) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeeWorkMonth" ("id", "companyId", "companyUserId", "year", "month", "totalDays", "workedDays", "isManual", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT ("companyUserId", "year", "month") DO UPDATE SET
			"totalDays" = EXCLUDED."totalDays",
			"workedDays" = EXCLUDED."workedDays",
			"isManual" = EXCLUDED."isManual",
			"updatedAt" = NOW()
	`, companyID, companyUserID, year, month, totalDays, workedDays, isManual)
	return err
}

func (r *Repository) AddAdvance(ctx context.Context, companyID string, input AddPayrollAdvanceInput) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollAdvance" ("id", "companyId", "companyUserId", "year", "month", "amount", "reason", "advanceDate", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, COALESCE($7::date, NOW()), NOW())
	`, companyID, input.CompanyUserID, input.Year, input.Month, input.Amount, input.Reason, input.AdvanceDate)
	return err
}

func (r *Repository) UpsertSettlement(ctx context.Context, companyID, companyUserID string, year, month int, input UpsertPayrollSettlementInput) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollSettlement" ("id", "companyId", "companyUserId", "year", "month", "baseSalary", "totalDays", "workedDays", "bonus", "penalties", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9, 0), NOW())
		ON CONFLICT ("companyUserId", "year", "month") DO UPDATE SET
			"baseSalary" = EXCLUDED."baseSalary",
			"totalDays" = EXCLUDED."totalDays",
			"workedDays" = EXCLUDED."workedDays",
			"bonus" = EXCLUDED."bonus",
			"penalties" = EXCLUDED."penalties",
			"updatedAt" = NOW()
	`, companyID, companyUserID, year, month, input.BaseSalary, input.TotalDays, input.WorkedDays, input.Bonus, input.Penalties)
	if err != nil {
		return err
	}
	
	if input.ConfirmPayment != nil && *input.ConfirmPayment {
		_, err = r.pool.Exec(ctx, `
			UPDATE "EmployeePayrollSettlement" SET "paymentConfirmedAt" = NOW()
			WHERE "companyUserId" = $1 AND "year" = $2 AND "month" = $3 AND "paymentConfirmedAt" IS NULL
		`, companyUserID, year, month)
		return err
	}
	return nil
}

func (r *Repository) MarkEmployeeLeft(ctx context.Context, companyUserID, leftAt string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE "EmployeePayrollProfile" SET "leftAt" = $1::date, "employmentStatus" = 'LEFT', "updatedAt" = NOW()
		WHERE "companyUserId" = $2
	`, leftAt, companyUserID)
	return err
}
