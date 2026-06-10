package expenses

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) GetExpenseByID(ctx context.Context, companyID, id string) (*ExpenseResponse, error) {
	query := `
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
		WHERE e."companyId" = $1 AND e.id = $2
	`
	var e ExpenseResponse
	var aID, aName, aLogin *string
	err := r.pool.QueryRow(ctx, query, companyID, id).Scan(
		&e.ID, &e.CompanyID, &e.CategoryID, &e.Amount, &e.Currency, &e.ExpenseDate, &e.Description, &e.Notes,
		&e.Status, &e.RejectReason, &e.CreatedByID, &e.ApprovedByID, &e.ApprovedAt, &e.CreatedAt, &e.UpdatedAt,
		&e.Category.ID, &e.Category.Name,
		&e.CreatedBy.ID, &e.CreatedBy.FullName, &e.CreatedBy.Login,
		&aID, &aName, &aLogin,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if aID != nil {
		e.ApprovedBy = &UserBrief{
			ID:       *aID,
			FullName: *aName,
			Login:    *aLogin,
		}
	}
	return &e, nil
}

func (r *Repository) CreateExpense(ctx context.Context, companyID, userID string, input CreateExpenseInput, currency string) (*ExpenseResponse, error) {
	query := `
		INSERT INTO "Expense" (
			id, "companyId", "categoryId", amount, currency, "expenseDate", description, notes, status, "createdById", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, NOW(), NOW()
		)
		RETURNING id
	`
	var id string
	err := r.pool.QueryRow(ctx, query, companyID, input.CategoryID, input.Amount, currency, input.ExpenseDate, input.Description, input.Notes, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.GetExpenseByID(ctx, companyID, id)
}

func (r *Repository) UpdateExpense(ctx context.Context, companyID, id string, input UpdateExpenseInput, currency *string) (*ExpenseResponse, error) {
	var sets []string
	var args []any
	argID := 1

	args = append(args, id, companyID)
	argID = 3

	if input.CategoryID != nil {
		sets = append(sets, fmt.Sprintf(`"categoryId" = $%d`, argID))
		args = append(args, *input.CategoryID)
		argID++
	}
	if input.Amount != nil {
		sets = append(sets, fmt.Sprintf(`amount = $%d`, argID))
		args = append(args, *input.Amount)
		argID++
	}
	if currency != nil {
		sets = append(sets, fmt.Sprintf(`currency = $%d`, argID))
		args = append(args, *currency)
		argID++
	}
	if input.ExpenseDate != nil {
		sets = append(sets, fmt.Sprintf(`"expenseDate" = $%d`, argID))
		args = append(args, *input.ExpenseDate)
		argID++
	}
	if input.Description != nil {
		sets = append(sets, fmt.Sprintf(`description = $%d`, argID))
		args = append(args, *input.Description)
		argID++
	}
	if input.Notes != nil {
		sets = append(sets, fmt.Sprintf(`notes = $%d`, argID))
		args = append(args, *input.Notes)
		argID++
	}

	sets = append(sets, `"updatedAt" = NOW()`)

	query := fmt.Sprintf(`
		UPDATE "Expense"
		SET %s
		WHERE id = $1 AND "companyId" = $2 AND status = 'PENDING'
		RETURNING id
	`, strings.Join(sets, ", "))

	var retID string
	err := r.pool.QueryRow(ctx, query, args...).Scan(&retID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.GetExpenseByID(ctx, companyID, retID)
}

func (r *Repository) UpdateExpenseStatus(ctx context.Context, companyID, id, userID, status string, rejectReason *string) (*ExpenseResponse, error) {
	query := `
		UPDATE "Expense"
		SET status = $1, "rejectReason" = $2, "approvedById" = $3, "approvedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $4 AND "companyId" = $5 AND status = 'PENDING'
		RETURNING id
	`
	var retID string
	err := r.pool.QueryRow(ctx, query, status, rejectReason, userID, id, companyID).Scan(&retID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.GetExpenseByID(ctx, companyID, retID)
}
