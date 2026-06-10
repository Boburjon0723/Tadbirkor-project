package income

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

type IncomeFilter struct {
	CategoryID *string
	From       *time.Time
	To         *time.Time
	Search     *string
	Currency   *string
}

func (r *Repository) buildWhereClause(companyID string, filter IncomeFilter) (string, []any) {
	var conditions []string
	var args []any
	argID := 1

	conditions = append(conditions, fmt.Sprintf(`i."companyId" = $%d`, argID))
	args = append(args, companyID)
	argID++

	if filter.CategoryID != nil {
		conditions = append(conditions, fmt.Sprintf(`i."categoryId" = $%d`, argID))
		args = append(args, *filter.CategoryID)
		argID++
	}
	if filter.Currency != nil {
		conditions = append(conditions, fmt.Sprintf(`i.currency = $%d`, argID))
		args = append(args, *filter.Currency)
		argID++
	}
	if filter.From != nil {
		conditions = append(conditions, fmt.Sprintf(`i."incomeDate" >= $%d`, argID))
		args = append(args, *filter.From)
		argID++
	}
	if filter.To != nil {
		conditions = append(conditions, fmt.Sprintf(`i."incomeDate" <= $%d`, argID))
		args = append(args, *filter.To)
		argID++
	}
	if filter.Search != nil && strings.TrimSpace(*filter.Search) != "" {
		q := "%" + strings.TrimSpace(*filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf(`(i.description ILIKE $%d OR i.notes ILIKE $%d OR c.name ILIKE $%d)`, argID, argID, argID))
		args = append(args, q)
		argID++
	}

	return "WHERE " + strings.Join(conditions, " AND "), args
}

func (r *Repository) GetSummary(ctx context.Context, companyID string, filter IncomeFilter) (*IncomeSummaryResponse, error) {
	where, args := r.buildWhereClause(companyID, filter)

	query := fmt.Sprintf(`
		SELECT i.currency, i."categoryId", c.name, COALESCE(SUM(i.amount), 0) as amount, COUNT(i.id) as cnt
		FROM "Income" i
		JOIN "IncomeCategory" c ON i."categoryId" = c.id
		%s
		GROUP BY i.currency, i."categoryId", c.name
	`, where)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &IncomeSummaryResponse{
		Totals:     make(map[string]float64),
		ByCategory: []IncomeByCategory{},
	}

	byCatMap := make(map[string]*IncomeByCategory)

	for rows.Next() {
		var currency, catID, catName string
		var amount float64
		var count int
		if err := rows.Scan(&currency, &catID, &catName, &amount, &count); err != nil {
			return nil, err
		}

		summary.Totals[currency] += amount
		summary.TotalCount += count

		if _, exists := byCatMap[catID]; !exists {
			byCatMap[catID] = &IncomeByCategory{
				CategoryID: catID,
				Name:       catName,
				Amount:     make(map[string]float64),
				Count:      0,
			}
		}
		byCatMap[catID].Amount[currency] += amount
		byCatMap[catID].Count += count
	}

	for _, v := range byCatMap {
		summary.ByCategory = append(summary.ByCategory, *v)
	}

	// Sort by total amount descending (approximate by summing values across currencies)
	sort.Slice(summary.ByCategory, func(i, j int) bool {
		sumI := 0.0
		for _, a := range summary.ByCategory[i].Amount {
			sumI += a
		}
		sumJ := 0.0
		for _, a := range summary.ByCategory[j].Amount {
			sumJ += a
		}
		return sumI > sumJ
	})

	return summary, nil
}

func (r *Repository) FindAllIncomes(ctx context.Context, companyID string, filter IncomeFilter, page, limit int) ([]IncomeResponse, int, error) {
	where, args := r.buildWhereClause(companyID, filter)

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "Income" i
		JOIN "IncomeCategory" c ON i."categoryId" = c.id
		%s
	`, where)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if total == 0 {
		return []IncomeResponse{}, 0, nil
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT 
			i.id, i."companyId", i."categoryId", i.amount, i.currency, i."incomeDate", i.description, i.notes,
			i."createdById", i."createdAt", i."updatedAt",
			c.id, c.name,
			u.id, u."fullName", u.login
		FROM "Income" i
		JOIN "IncomeCategory" c ON i."categoryId" = c.id
		JOIN "User" u ON i."createdById" = u.id
		%s
		ORDER BY i."incomeDate" DESC, i."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, where, len(args)+1, len(args)+2)

	args = append(args, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []IncomeResponse
	for rows.Next() {
		var i IncomeResponse
		err := rows.Scan(
			&i.ID, &i.CompanyID, &i.CategoryID, &i.Amount, &i.Currency, &i.IncomeDate, &i.Description, &i.Notes,
			&i.CreatedByID, &i.CreatedAt, &i.UpdatedAt,
			&i.Category.ID, &i.Category.Name,
			&i.CreatedBy.ID, &i.CreatedBy.FullName, &i.CreatedBy.Login,
		)
		if err != nil {
			return nil, 0, err
		}
		result = append(result, i)
	}

	return result, total, nil
}
