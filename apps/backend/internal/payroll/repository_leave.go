package payroll

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

type membershipRow struct {
	ID           string
	UserID       string
	Role         string
	UserFullName string
	UserLogin    string
}

func (r *Repository) getMembershipByCompanyUserID(ctx context.Context, companyID, companyUserID string) (*membershipRow, error) {
	var m membershipRow
	err := r.pool.QueryRow(ctx, `
		SELECT cu.id, cu."userId", cu.role, u."fullName", u.login
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1 AND cu.id = $2
	`, companyID, companyUserID).Scan(&m.ID, &m.UserID, &m.Role, &m.UserFullName, &m.UserLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) getMembership(ctx context.Context, companyID, userID string) (*membershipRow, error) {
	var m membershipRow
	err := r.pool.QueryRow(ctx, `
		SELECT cu.id, cu."userId", cu.role, u."fullName", u.login
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1 AND cu."userId" = $2
	`, companyID, userID).Scan(&m.ID, &m.UserID, &m.Role, &m.UserFullName, &m.UserLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errForbidden("Kompaniya a'zosi emas")
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) companyUserExists(ctx context.Context, companyID, companyUserID string) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM "CompanyUser" WHERE id = $1 AND "companyId" = $2)
	`, companyUserID, companyID).Scan(&ok)
	return ok, err
}

func (r *Repository) hasLeaveOverlap(ctx context.Context, companyUserID string, start, end time.Time) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "EmployeeLeaveRequest"
			WHERE "companyUserId" = $1
			  AND status IN ('PENDING', 'APPROVED')
			  AND "startDate" <= $2::date
			  AND "endDate" >= $3::date
		)
	`, companyUserID, end, start).Scan(&ok)
	return ok, err
}

func (r *Repository) scanLeaveRequest(row pgx.Row) (map[string]any, error) {
	var id, companyID, companyUserID, status string
	var startDate, endDate time.Time
	var daysCount int
	var reason, reviewNote, reviewedBy *string
	var requestedAt time.Time
	var reviewedAt *time.Time
	var userFullName, userLogin string
	err := row.Scan(
		&id, &companyID, &companyUserID, &startDate, &endDate, &daysCount,
		&reason, &status, &requestedAt, &reviewedAt, &reviewedBy, &reviewNote,
		&userFullName, &userLogin,
	)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": id, "companyId": companyID, "companyUserId": companyUserID,
		"startDate": startDate, "endDate": endDate, "daysCount": daysCount,
		"reason": reason, "status": status, "requestedAt": requestedAt,
		"reviewedAt": reviewedAt, "reviewedByUserId": reviewedBy, "reviewNote": reviewNote,
		"companyUser": map[string]any{
			"user": map[string]any{"fullName": userFullName, "login": userLogin},
		},
	}, nil
}

const leaveSelectSQL = `
	SELECT lr.id, lr."companyId", lr."companyUserId", lr."startDate", lr."endDate", lr."daysCount",
	       lr.reason, lr.status, lr."requestedAt", lr."reviewedAt", lr."reviewedByUserId", lr."reviewNote",
	       u."fullName", u.login
	FROM "EmployeeLeaveRequest" lr
	JOIN "CompanyUser" cu ON cu.id = lr."companyUserId"
	JOIN "User" u ON u.id = cu."userId"
`

func (r *Repository) listLeaveRequests(ctx context.Context, companyID string, companyUserID *string, status string) ([]map[string]any, error) {
	q := leaveSelectSQL + ` WHERE lr."companyId" = $1`
	args := []any{companyID}
	n := 2
	if status != "" {
		q += ` AND lr.status = $` + strconv.Itoa(n)
		args = append(args, status)
		n++
	}
	if companyUserID != nil {
		q += ` AND lr."companyUserId" = $` + strconv.Itoa(n)
		args = append(args, *companyUserID)
		n++
	}
	q += ` ORDER BY lr."requestedAt" DESC LIMIT 100`

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		item, err := r.scanLeaveRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) listMemberLeaveRequests(ctx context.Context, companyID, companyUserID string, year, month *int) ([]map[string]any, error) {
	q := leaveSelectSQL + ` WHERE lr."companyId" = $1 AND lr."companyUserId" = $2`
	args := []any{companyID, companyUserID}
	if year != nil && month != nil {
		monthStart := time.Date(*year, time.Month(*month), 1, 0, 0, 0, 0, time.UTC)
		monthEnd := time.Date(*year, time.Month(*month+1), 0, 0, 0, 0, 0, time.UTC)
		q += ` AND lr."startDate" <= $3::date AND lr."endDate" >= $4::date`
		args = append(args, monthEnd, monthStart)
	}
	q += ` ORDER BY lr."startDate" DESC, lr."requestedAt" DESC LIMIT 50`
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		item, err := r.scanLeaveRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) countPendingLeave(ctx context.Context, companyID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "EmployeeLeaveRequest"
		WHERE "companyId" = $1 AND status = 'PENDING'
	`, companyID).Scan(&count)
	return count, err
}

func (r *Repository) createLeaveRequest(ctx context.Context, companyID, companyUserID string, start, end time.Time, daysCount int, reason, status, reviewedBy, reviewNote *string) (map[string]any, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO "EmployeeLeaveRequest" (
			id, "companyId", "companyUserId", "startDate", "endDate", "daysCount",
			reason, status, "requestedAt", "reviewedAt", "reviewedByUserId", "reviewNote"
		) VALUES (
			gen_random_uuid(), $1, $2, $3::date, $4::date, $5,
			$6, $7, NOW(),
			CASE WHEN $7 = 'APPROVED' THEN NOW() ELSE NULL END,
			$8, $9
		) RETURNING id
	`, companyID, companyUserID, start, end, daysCount, reason, status, reviewedBy, reviewNote).Scan(&id)
	if err != nil {
		return nil, err
	}
	row := r.pool.QueryRow(ctx, leaveSelectSQL+` WHERE lr.id = $1`, id)
	return r.scanLeaveRequest(row)
}

func (r *Repository) getLeaveRequest(ctx context.Context, companyID, requestID string) (map[string]any, error) {
	row := r.pool.QueryRow(ctx, leaveSelectSQL+` WHERE lr.id = $1 AND lr."companyId" = $2`, requestID, companyID)
	item, err := r.scanLeaveRequest(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return item, nil
}

func (r *Repository) updateLeaveStatus(ctx context.Context, requestID, status, reviewedBy string, reviewNote *string) (map[string]any, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		UPDATE "EmployeeLeaveRequest"
		SET status = $2, "reviewedAt" = NOW(), "reviewedByUserId" = $3, "reviewNote" = $4
		WHERE id = $1
		RETURNING id
	`, requestID, status, reviewedBy, reviewNote).Scan(&id)
	if err != nil {
		return nil, err
	}
	row := r.pool.QueryRow(ctx, leaveSelectSQL+` WHERE lr.id = $1`, id)
	return r.scanLeaveRequest(row)
}

func (r *Repository) listApprovedLeavesForMonth(ctx context.Context, companyID, companyUserID string, year, month int) ([]map[string]any, error) {
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	rows, err := r.pool.Query(ctx, `
		SELECT id, "companyId", "companyUserId", "startDate", "endDate", "daysCount",
		       reason, status, "requestedAt", "reviewedAt", "reviewedByUserId", "reviewNote"
		FROM "EmployeeLeaveRequest"
		WHERE "companyId" = $1 AND "companyUserId" = $2 AND status = 'APPROVED'
		  AND "startDate" <= $3::date AND "endDate" >= $4::date
		ORDER BY "startDate" ASC
	`, companyID, companyUserID, monthEnd, monthStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, cid, cuid, status string
		var start, end time.Time
		var days int
		var reason, reviewNote, reviewedBy *string
		var requestedAt time.Time
		var reviewedAt *time.Time
		if err := rows.Scan(&id, &cid, &cuid, &start, &end, &days, &reason, &status, &requestedAt, &reviewedAt, &reviewedBy, &reviewNote); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "companyId": cid, "companyUserId": cuid,
			"startDate": start, "endDate": end, "daysCount": days,
			"reason": reason, "status": status, "requestedAt": requestedAt,
			"reviewedAt": reviewedAt, "reviewedByUserId": reviewedBy, "reviewNote": reviewNote,
		})
	}
	return out, rows.Err()
}

func (r *Repository) listApprovedLeavesOverlapping(ctx context.Context, companyID, companyUserID string, year, month int) ([]struct {
	Start, End time.Time
}, error) {
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	rows, err := r.pool.Query(ctx, `
		SELECT "startDate", "endDate" FROM "EmployeeLeaveRequest"
		WHERE "companyUserId" = $1 AND "companyId" = $2 AND status = 'APPROVED'
		  AND "startDate" <= $3::date AND "endDate" >= $4::date
	`, companyUserID, companyID, monthEnd, monthStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []struct{ Start, End time.Time }{}
	for rows.Next() {
		var s, e time.Time
		if err := rows.Scan(&s, &e); err != nil {
			return nil, err
		}
		out = append(out, struct{ Start, End time.Time }{s, e})
	}
	return out, rows.Err()
}

func (r *Repository) getWorkMonthManualFlag(ctx context.Context, companyUserID string, year, month int) (bool, error) {
	var isManual bool
	err := r.pool.QueryRow(ctx, `
		SELECT "isManual" FROM "EmployeeWorkMonth"
		WHERE "companyUserId" = $1 AND year = $2 AND month = $3
	`, companyUserID, year, month).Scan(&isManual)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return isManual, nil
}

func (r *Repository) getPaidLeaveQuota(ctx context.Context, companyUserID string) (int, error) {
	var quota int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE("monthlyPaidLeaveQuota", 0) FROM "EmployeePayrollProfile" WHERE "companyUserId" = $1
	`, companyUserID).Scan(&quota)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return quota, nil
}

func (r *Repository) listCompanyMembers(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cu.id, cu.role, cu."createdAt", cu."warehouseId",
		       u.id, u."fullName", u.login, u.email, u.phone, u."telegramChatId", u."telegramLinkedAt",
		       w.id, w.name, w.status
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		JOIN "EmployeePayrollProfile" epp ON epp."companyUserId" = cu.id
		LEFT JOIN "Warehouse" w ON w.id = cu."warehouseId"
		WHERE cu."companyId" = $1 AND cu.role <> 'OWNER' AND epp."onPayrollRoster" = true
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
		var warehouseID, wID, wName, wStatus *string
		var userID, fullName, login string
		var email, phone, telegramChatID *string
		var telegramLinkedAt *time.Time
		if err := rows.Scan(&id, &role, &createdAt, &warehouseID,
			&userID, &fullName, &login, &email, &phone, &telegramChatID, &telegramLinkedAt,
			&wID, &wName, &wStatus); err != nil {
			return nil, err
		}
		item := map[string]any{
			"id": id, "role": role, "createdAt": createdAt,
			"user": map[string]any{
				"id": userID, "fullName": fullName, "login": login,
				"email": email, "phone": phone,
				"telegramChatId": telegramChatID, "telegramLinkedAt": telegramLinkedAt,
			},
		}
		if wID != nil {
			item["warehouse"] = map[string]any{"id": *wID, "name": *wName, "status": *wStatus}
		} else {
			item["warehouse"] = nil
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) getPayrollProfile(ctx context.Context, companyUserID string) (map[string]any, error) {
	var quota int
	var firstName, lastName, position, department, address, email, notes, phone, employmentStatus *string
	var leftAt *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT "monthlyPaidLeaveQuota", "firstName", "lastName", position, department,
		       address, email, notes, phone, "leftAt", "employmentStatus"
		FROM "EmployeePayrollProfile" WHERE "companyUserId" = $1
	`, companyUserID).Scan(&quota, &firstName, &lastName, &position, &department, &address, &email, &notes, &phone, &leftAt, &employmentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return map[string]any{"monthlyPaidLeaveQuota": 0}, nil
		}
		return nil, err
	}
	leftStr := any(nil)
	if leftAt != nil {
		leftStr = dateOnlyString(*leftAt)
	}
	return map[string]any{
		"monthlyPaidLeaveQuota": quota,
		"firstName":             firstName,
		"lastName":              lastName,
		"position":              position,
		"department":            department,
		"address":               address,
		"email":                 email,
		"notes":                 notes,
		"phone":                 phone,
		"leftAt":                leftStr,
		"employmentStatus":      employmentStatus,
	}, nil
}
