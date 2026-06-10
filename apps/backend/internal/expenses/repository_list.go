package expenses

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type ExpenseFilter struct {
	Status     *string
	CategoryID *string
	From       *time.Time
	To         *time.Time
	Search     *string
	Currency   *string
}

func (r *Repository) buildWhereClause(companyID string, filter ExpenseFilter, payrollCategories []string) (string, []any) {
	var conditions []string
	var args []any
	argID := 1

	conditions = append(conditions, fmt.Sprintf(`e."companyId" = $%d`, argID))
	args = append(args, companyID)
	argID++

	if len(payrollCategories) > 0 {
		var placeholders []string
		for _, cat := range payrollCategories {
			placeholders = append(placeholders, fmt.Sprintf("$%d", argID))
			args = append(args, cat)
			argID++
		}
		conditions = append(conditions, fmt.Sprintf(`c.name NOT IN (%s)`, strings.Join(placeholders, ", ")))
	}

	if filter.Status != nil {
		conditions = append(conditions, fmt.Sprintf(`e.status = $%d`, argID))
		args = append(args, strings.ToUpper(*filter.Status))
		argID++
	}
	if filter.CategoryID != nil {
		conditions = append(conditions, fmt.Sprintf(`e."categoryId" = $%d`, argID))
		args = append(args, *filter.CategoryID)
		argID++
	}
	if filter.Currency != nil {
		conditions = append(conditions, fmt.Sprintf(`e.currency = $%d`, argID))
		args = append(args, *filter.Currency)
		argID++
	}
	if filter.From != nil {
		conditions = append(conditions, fmt.Sprintf(`e."expenseDate" >= $%d`, argID))
		args = append(args, *filter.From)
		argID++
	}
	if filter.To != nil {
		conditions = append(conditions, fmt.Sprintf(`e."expenseDate" <= $%d`, argID))
		args = append(args, *filter.To)
		argID++
	}
	if filter.Search != nil && strings.TrimSpace(*filter.Search) != "" {
		q := "%" + strings.TrimSpace(*filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf(`(e.description ILIKE $%d OR e.notes ILIKE $%d OR c.name ILIKE $%d)`, argID, argID, argID))
		args = append(args, q)
		argID++
	}

	return "WHERE " + strings.Join(conditions, " AND "), args
}

func (r *Repository) GetSummary(ctx context.Context, companyID string, filter ExpenseFilter, payrollCategories []string) (*ExpenseSummaryResponse, error) {
	where, args := r.buildWhereClause(companyID, filter, payrollCategories)

	query := fmt.Sprintf(`
		SELECT e.status, e.currency, COALESCE(SUM(e.amount), 0) as amount, COUNT(e.id) as cnt
		FROM "Expense" e
		JOIN "ExpenseCategory" c ON e."categoryId" = c.id
		%s
		GROUP BY e.status, e.currency
	`, where)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &ExpenseSummaryResponse{
		Pending:  make(map[string]float64),
		Approved: make(map[string]float64),
		Rejected: make(map[string]float64),
		Counts:   ExpenseCounts{},
	}

	for rows.Next() {
		var status, currency string
		var amount float64
		var count int
		if err := rows.Scan(&status, &currency, &amount, &count); err != nil {
			return nil, err
		}
		if status == "PENDING" {
			summary.Pending[currency] += amount
			summary.Counts.Pending += count
		} else if status == "APPROVED" {
			summary.Approved[currency] += amount
			summary.Counts.Approved += count
		} else if status == "REJECTED" {
			summary.Rejected[currency] += amount
			summary.Counts.Rejected += count
		}
	}

	return summary, nil
}

func (r *Repository) FindAllExpenses(ctx context.Context, companyID string, filter ExpenseFilter, page, limit int, payrollCategories []string) ([]ExpenseResponse, int, error) {
	where, args := r.buildWhereClause(companyID, filter, payrollCategories)

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "Expense" e
		JOIN "ExpenseCategory" c ON e."categoryId" = c.id
		%s
	`, where)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if total == 0 {
		return []ExpenseResponse{}, 0, nil
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT 
			e.id, e."companyId", e."categoryId", e.amount, e.currency, e."expenseDate", e.description, e.notes,
			e.status, e."rejectReason", e."createdById", e."approvedById", e."approvedAt", e."createdAt", e."updatedAt",
			c.id, c.name,
			u1.id, u1."fullName", u1.login,
			u2.id, u2."fullName", u2.login
		FROM "Expense" e
		JOIN "ExpenseCategory" c ON e."categoryId" = c.id
		JOIN "User" u1 ON e."createdById" = u1.id
		LEFT JOIN "User" u2 ON e."approvedById" = u2.id
		%s
		ORDER BY e."expenseDate" DESC, e."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, len(args)+1, len(args)+2)

	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []ExpenseResponse
	for rows.Next() {
		var e ExpenseResponse
		var aID, aName, aLogin *string
		err := rows.Scan(
			&e.ID, &e.CompanyID, &e.CategoryID, &e.Amount, &e.Currency, &e.ExpenseDate, &e.Description, &e.Notes,
			&e.Status, &e.RejectReason, &e.CreatedByID, &e.ApprovedByID, &e.ApprovedAt, &e.CreatedAt, &e.UpdatedAt,
			&e.Category.ID, &e.Category.Name,
			&e.CreatedBy.ID, &e.CreatedBy.FullName, &e.CreatedBy.Login,
			&aID, &aName, &aLogin,
		)
		if err != nil {
			return nil, 0, err
		}
		if aID != nil {
			e.ApprovedBy = &UserBrief{
				ID:       *aID,
				FullName: *aName,
				Login:    *aLogin,
			}
		}
		result = append(result, e)
	}

	return result, total, nil
}
