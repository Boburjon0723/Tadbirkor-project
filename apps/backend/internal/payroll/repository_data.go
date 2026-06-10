package payroll

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func (r *Repository) markOnPayrollRoster(ctx context.Context, companyUserID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollProfile" ("companyUserId", "onPayrollRoster", "updatedAt")
		VALUES ($1, true, NOW())
		ON CONFLICT ("companyUserId") DO UPDATE SET "onPayrollRoster" = true, "updatedAt" = NOW()
	`, companyUserID)
	return err
}

func (r *Repository) listCompensations(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT ec.id, ec."companyUserId", ec."employeeName", ec."employeeRole",
		       ec."baseSalary"::float8, ec.currency, ec."effectiveFrom", ec."isActive"
		FROM "EmployeeCompensation" ec
		JOIN "CompanyUser" cu ON cu.id = ec."companyUserId"
		JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		WHERE ec."companyId" = $1 AND ec."isActive" = true AND epp."onPayrollRoster" = true
		ORDER BY ec."updatedAt" DESC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCompensationRows(rows)
}

func scanCompensationRows(rows pgx.Rows) ([]map[string]any, error) {
	out := []map[string]any{}
	for rows.Next() {
		var id, companyUserID, employeeName, employeeRole, currency string
		var baseSalary float64
		var effectiveFrom time.Time
		var isActive bool
		if err := rows.Scan(&id, &companyUserID, &employeeName, &employeeRole, &baseSalary, &currency, &effectiveFrom, &isActive); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "companyUserId": companyUserID, "employeeName": employeeName,
			"employeeRole": employeeRole, "baseSalary": baseSalary, "currency": currency,
			"effectiveFrom": dateOnlyString(effectiveFrom), "isActive": isActive,
		})
	}
	return out, rows.Err()
}

func (r *Repository) findActiveCompensation(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, "companyUserId", "employeeName", "employeeRole",
		       "baseSalary"::float8, currency, "effectiveFrom", "isActive"
		FROM "EmployeeCompensation"
		WHERE "companyId" = $1 AND "companyUserId" = $2 AND "isActive" = true
		ORDER BY "effectiveFrom" DESC LIMIT 1
	`, companyID, companyUserID)
	var id, cuid, employeeName, employeeRole, currency string
	var baseSalary float64
	var effectiveFrom time.Time
	var isActive bool
	err := row.Scan(&id, &cuid, &employeeName, &employeeRole, &baseSalary, &currency, &effectiveFrom, &isActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return map[string]any{
		"id": id, "companyUserId": cuid, "employeeName": employeeName,
		"employeeRole": employeeRole, "baseSalary": baseSalary, "currency": currency,
		"effectiveFrom": dateOnlyString(effectiveFrom), "isActive": isActive,
	}, nil
}

func (r *Repository) upsertCompensationRecord(ctx context.Context, companyID string, input UpsertCompensationInput, effectiveFrom time.Time) (map[string]any, error) {
	existing, err := r.findActiveCompensation(ctx, companyID, input.CompanyUserID)
	if err != nil {
		return nil, err
	}
	currency := "UZS"
	if input.Currency != nil && *input.Currency != "" {
		currency = *input.Currency
	}
	if existing != nil {
		id := existing["id"].(string)
		_, err = r.pool.Exec(ctx, `
			UPDATE "EmployeeCompensation"
			SET "employeeName" = $2, "employeeRole" = $3, "baseSalary" = $4,
			    currency = $5, "effectiveFrom" = $6::date, "updatedAt" = NOW()
			WHERE id = $1
		`, id, input.EmployeeName, input.EmployeeRole, input.BaseSalary, currency, effectiveFrom)
		if err != nil {
			return nil, err
		}
	} else {
		_, err = r.pool.Exec(ctx, `
			INSERT INTO "EmployeeCompensation" (
				id, "companyId", "companyUserId", "employeeName", "employeeRole",
				"baseSalary", currency, "effectiveFrom", "isActive", "createdAt", "updatedAt"
			) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::date, true, NOW(), NOW())
		`, companyID, input.CompanyUserID, input.EmployeeName, input.EmployeeRole, input.BaseSalary, currency, effectiveFrom)
		if err != nil {
			return nil, err
		}
	}
	if err := r.markOnPayrollRoster(ctx, input.CompanyUserID); err != nil {
		return nil, err
	}
	return r.findActiveCompensation(ctx, companyID, input.CompanyUserID)
}

func (r *Repository) listRosterCandidates(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cu.id, cu.role, cu."createdAt",
		       u.id, u."fullName", u.login, u.phone, u.status,
		       w.id, w.name
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		LEFT JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		LEFT JOIN "Warehouse" w ON w.id = cu."warehouseId"
		WHERE cu."companyId" = $1 AND cu.role <> 'OWNER'
		  AND (epp."companyUserId" IS NULL OR epp."onPayrollRoster" = false)
		ORDER BY cu."createdAt" ASC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, role string
		var createdAt time.Time
		var userID, fullName, login, userStatus string
		var phone, wID, wName *string
		if err := rows.Scan(&id, &role, &createdAt, &userID, &fullName, &login, &phone, &userStatus, &wID, &wName); err != nil {
			return nil, err
		}
		item := map[string]any{
			"id": id, "role": role, "createdAt": createdAt,
			"user": map[string]any{"id": userID, "fullName": fullName, "login": login, "phone": phone, "status": userStatus},
		}
		if wID != nil {
			item["warehouse"] = map[string]any{"id": *wID, "name": *wName}
		} else {
			item["warehouse"] = nil
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) listEmployeeExtras(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cu.id, cu."createdAt",
		       epp."firstName", epp."lastName", epp.position, epp.department, epp.address,
		       epp.email, epp.notes, epp.phone, epp."monthlyPaidLeaveQuota", epp."leftAt", epp."employmentStatus"
		FROM "CompanyUser" cu
		JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		WHERE cu."companyId" = $1 AND cu.role <> 'OWNER' AND epp."onPayrollRoster" = true
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		item, err := scanProfileExtraRow(rows)
		if err != nil {
			return nil, err
		}
		if item != nil {
			out = append(out, item)
		}
	}
	return out, rows.Err()
}

func (r *Repository) getEmployeeExtra(ctx context.Context, companyID, companyUserID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT cu.id, cu."createdAt",
		       epp."firstName", epp."lastName", epp.position, epp.department, epp.address,
		       epp.email, epp.notes, epp.phone, epp."monthlyPaidLeaveQuota", epp."leftAt", epp."employmentStatus"
		FROM "CompanyUser" cu
		LEFT JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		WHERE cu.id = $1 AND cu."companyId" = $2
	`, companyUserID, companyID)
	item, err := scanProfileExtraRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return map[string]any{"companyUserId": companyUserID}, nil
		}
		return nil, err
	}
	if item == nil {
		return map[string]any{"companyUserId": companyUserID}, nil
	}
	return item, nil
}

func scanProfileExtraRow(row pgx.Row) (map[string]any, error) {
	var companyUserID string
	var createdAt time.Time
	var firstName, lastName, position, department, address, email, notes, phone, employmentStatus *string
	var quota int
	var leftAt *time.Time
	err := row.Scan(&companyUserID, &createdAt, &firstName, &lastName, &position, &department, &address,
		&email, &notes, &phone, &quota, &leftAt, &employmentStatus)
	if err != nil {
		return nil, err
	}
	if firstName == nil && lastName == nil && position == nil {
		return nil, nil
	}
	leftStr := any(nil)
	if leftAt != nil {
		leftStr = dateOnlyString(*leftAt)
	}
	status := "ACTIVE"
	if employmentStatus != nil && *employmentStatus != "" {
		status = *employmentStatus
	}
	return map[string]any{
		"companyUserId":         companyUserID,
		"firstName":             derefStr(firstName),
		"lastName":              derefStr(lastName),
		"position":              derefStr(position),
		"department":            derefStr(department),
		"address":               derefStr(address),
		"email":                 derefStr(email),
		"notes":                 derefStr(notes),
		"phone":                 derefStr(phone),
		"monthlyPaidLeaveQuota": quota,
		"leftAt":                leftStr,
		"employmentStatus":      status,
		"createdAt":             createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func derefStr(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

func (r *Repository) upsertEmployeeProfile(ctx context.Context, companyUserID string, input UpsertPayrollEmployeeInput) (map[string]any, error) {
	quota := 0
	if input.MonthlyPaidLeaveQuota != nil {
		quota = *input.MonthlyPaidLeaveQuota
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollProfile" (
			"companyUserId", "firstName", "lastName", position, department, address,
			email, notes, phone, "monthlyPaidLeaveQuota", "onPayrollRoster", "leftAt", "employmentStatus", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11::date, COALESCE($12, 'ACTIVE'), NOW())
		ON CONFLICT ("companyUserId") DO UPDATE SET
			"onPayrollRoster" = true,
			"firstName" = COALESCE($2, "EmployeePayrollProfile"."firstName"),
			"lastName" = COALESCE($3, "EmployeePayrollProfile"."lastName"),
			position = COALESCE($4, "EmployeePayrollProfile".position),
			department = COALESCE($5, "EmployeePayrollProfile".department),
			address = COALESCE($6, "EmployeePayrollProfile".address),
			email = COALESCE($7, "EmployeePayrollProfile".email),
			notes = COALESCE($8, "EmployeePayrollProfile".notes),
			phone = COALESCE($9, "EmployeePayrollProfile".phone),
			"monthlyPaidLeaveQuota" = COALESCE($10, "EmployeePayrollProfile"."monthlyPaidLeaveQuota"),
			"leftAt" = COALESCE($11::date, "EmployeePayrollProfile"."leftAt"),
			"employmentStatus" = COALESCE($12, "EmployeePayrollProfile"."employmentStatus"),
			"updatedAt" = NOW()
	`, companyUserID,
		trimPtr(input.FirstName), trimPtr(input.LastName), trimPtr(input.Position), trimPtr(input.Department),
		trimPtr(input.Address), trimPtr(input.Email), trimPtr(input.Notes), trimPtr(input.Phone),
		quota, input.LeftAt, input.EmploymentStatus)
	if err != nil {
		return nil, err
	}
	if input.Role != nil && *input.Role != "" {
		_, _ = r.pool.Exec(ctx, `UPDATE "CompanyUser" SET role = $2 WHERE id = $1`, companyUserID, *input.Role)
	}
	var createdAt time.Time
	_ = r.pool.QueryRow(ctx, `SELECT "createdAt" FROM "CompanyUser" WHERE id = $1`, companyUserID).Scan(&createdAt)
	row := r.pool.QueryRow(ctx, `
		SELECT cu.id, cu."createdAt",
		       epp."firstName", epp."lastName", epp.position, epp.department, epp.address,
		       epp.email, epp.notes, epp.phone, epp."monthlyPaidLeaveQuota", epp."leftAt", epp."employmentStatus"
		FROM "CompanyUser" cu
		JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		WHERE cu.id = $1
	`, companyUserID)
	item, err := scanProfileExtraRow(row)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	s := *v
	if s == "" {
		return nil
	}
	return &s
}

func (r *Repository) createPayrollOnlyMember(ctx context.Context, companyID string, input CreatePayrollOnlyMemberInput) (map[string]any, error) {
	fullName := fmt.Sprintf("%s %s", input.FirstName, input.LastName)
	loginSuffix := fmt.Sprintf("%d", time.Now().UnixNano())
	login := "pay." + loginSuffix[len(loginSuffix)-8:]
	passwordHash, _ := bcrypt.GenerateFromPassword([]byte(fmt.Sprintf("payroll-%s", loginSuffix)), 10)
	phone := input.Phone
	var taken bool
	_ = r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM "User" WHERE phone = $1)`, phone).Scan(&taken)
	if taken {
		phone = fmt.Sprintf("+99899%07d", time.Now().UnixNano()%8999999+1000000)
	}
	currency := "UZS"
	if input.Currency != nil && *input.Currency != "" {
		currency = *input.Currency
	}
	quota := 0
	if input.MonthlyPaidLeaveQuota != nil {
		quota = *input.MonthlyPaidLeaveQuota
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var userID, companyUserID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "User" (id, "fullName", login, "passwordHash", phone, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', NOW(), NOW())
		RETURNING id
	`, fullName, login, string(passwordHash), phone).Scan(&userID)
	if err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO "CompanyUser" (id, "companyId", "userId", role, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
		RETURNING id
	`, companyID, userID, input.Role).Scan(&companyUserID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "EmployeePayrollProfile" (
			"companyUserId", "firstName", "lastName", position, department, address, notes, phone,
			"monthlyPaidLeaveQuota", "onPayrollRoster", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
	`, companyUserID, input.FirstName, input.LastName, input.Position, input.Department,
		input.Address, input.Notes, input.Phone, quota)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "EmployeeCompensation" (
			id, "companyId", "companyUserId", "employeeName", "employeeRole",
			"baseSalary", currency, "effectiveFrom", "isActive", "createdAt", "updatedAt"
		) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()::date, true, NOW(), NOW())
	`, companyID, companyUserID, fullName, input.Role, input.BaseSalary, currency)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"companyUserId": companyUserID}, nil
}

func (r *Repository) listAdvances(ctx context.Context, companyID, companyUserID string, year, month int) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, "companyUserId", year, month, amount::float8, "advanceDate", reason
		FROM "EmployeePayrollAdvance"
		WHERE "companyId" = $1 AND "companyUserId" = $2 AND year = $3 AND month = $4
		ORDER BY "advanceDate" DESC
	`, companyID, companyUserID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, cuid, reason string
		var y, m int
		var amount float64
		var advanceDate time.Time
		if err := rows.Scan(&id, &cuid, &y, &m, &amount, &advanceDate, &reason); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "companyUserId": cuid, "year": y, "month": m,
			"amount": amount, "advanceDate": dateOnlyString(advanceDate), "reason": reason,
		})
	}
	return out, rows.Err()
}

func (r *Repository) getSettlement(ctx context.Context, companyUserID string, year, month int) (map[string]any, bool, error) {
	var baseSalary, bonus, penalties float64
	var totalDays, workedDays int
	var paymentConfirmedAt *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT "baseSalary"::float8, "totalDays", "workedDays", bonus::float8, penalties::float8, "paymentConfirmedAt"
		FROM "EmployeePayrollSettlement"
		WHERE "companyUserId" = $1 AND year = $2 AND month = $3
	`, companyUserID, year, month).Scan(&baseSalary, &totalDays, &workedDays, &bonus, &penalties, &paymentConfirmedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}
	confirmed := any(nil)
	if paymentConfirmedAt != nil {
		confirmed = paymentConfirmedAt.UTC().Format(time.RFC3339)
	}
	return map[string]any{
		"baseSalary": baseSalary, "totalDays": totalDays, "workedDays": workedDays,
		"bonus": bonus, "penalties": penalties, "paymentConfirmedAt": confirmed,
	}, true, nil
}

func (r *Repository) addBonusToSettlement(ctx context.Context, companyID, companyUserID string, year, month int, baseSalary float64, totalDays, workedDays int, amount float64) (float64, error) {
	var currentBonus float64
	var confirmed *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(bonus, 0)::float8, "paymentConfirmedAt"
		FROM "EmployeePayrollSettlement"
		WHERE "companyUserId" = $1 AND year = $2 AND month = $3
	`, companyUserID, year, month).Scan(&currentBonus, &confirmed)
	newBonus := amount
	if err == nil {
		newBonus = currentBonus + amount
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollSettlement" (
			id, "companyId", "companyUserId", year, month, "baseSalary", "totalDays", "workedDays",
			bonus, penalties, "paymentConfirmedAt", "updatedAt"
		) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW())
		ON CONFLICT ("companyUserId", year, month) DO UPDATE SET
			"baseSalary" = EXCLUDED."baseSalary",
			"totalDays" = EXCLUDED."totalDays",
			"workedDays" = EXCLUDED."workedDays",
			bonus = EXCLUDED.bonus,
			"updatedAt" = NOW()
	`, companyID, companyUserID, year, month, baseSalary, totalDays, workedDays, newBonus, confirmed)
	return newBonus, err
}

func (r *Repository) confirmSettlementPayment(ctx context.Context, companyUserID string, year, month int, baseSalary float64, totalDays, workedDays int, bonus, penalties float64) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO "EmployeePayrollSettlement" (
			id, "companyId", "companyUserId", year, month, "baseSalary", "totalDays", "workedDays",
			bonus, penalties, "paymentConfirmedAt", "updatedAt"
		)
		SELECT gen_random_uuid(), cu."companyId", $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
		FROM "CompanyUser" cu WHERE cu.id = $1
		ON CONFLICT ("companyUserId", year, month) DO UPDATE SET
			"baseSalary" = EXCLUDED."baseSalary",
			"totalDays" = EXCLUDED."totalDays",
			"workedDays" = EXCLUDED."workedDays",
			bonus = EXCLUDED.bonus,
			penalties = EXCLUDED.penalties,
			"paymentConfirmedAt" = NOW(),
			"updatedAt" = NOW()
	`, companyUserID, year, month, baseSalary, totalDays, workedDays, bonus, penalties)
	return err
}

func (r *Repository) rosterCompanyUserIDs(ctx context.Context, companyID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cu.id
		FROM "CompanyUser" cu
		JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		WHERE cu."companyId" = $1 AND cu.role <> 'OWNER' AND epp."onPayrollRoster" = true
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
