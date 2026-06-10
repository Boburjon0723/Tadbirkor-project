package income

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) GetIncomeByID(ctx context.Context, companyID, id string) (*IncomeResponse, error) {
	query := `
		SELECT 
			i.id, i."companyId", i."categoryId", i.amount, i.currency, i."incomeDate", i.description, i.notes,
			i."createdById", i."createdAt", i."updatedAt",
			c.id, c.name,
			u.id, u."fullName", u.login
		FROM "Income" i
		JOIN "IncomeCategory" c ON i."categoryId" = c.id
		JOIN "User" u ON i."createdById" = u.id
		WHERE i."companyId" = $1 AND i.id = $2
	`
	var i IncomeResponse
	err := r.pool.QueryRow(ctx, query, companyID, id).Scan(
		&i.ID, &i.CompanyID, &i.CategoryID, &i.Amount, &i.Currency, &i.IncomeDate, &i.Description, &i.Notes,
		&i.CreatedByID, &i.CreatedAt, &i.UpdatedAt,
		&i.Category.ID, &i.Category.Name,
		&i.CreatedBy.ID, &i.CreatedBy.FullName, &i.CreatedBy.Login,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &i, nil
}

func (r *Repository) CreateIncome(ctx context.Context, companyID, userID string, input CreateIncomeInput, currency string) (*IncomeResponse, error) {
	query := `
		INSERT INTO "Income" (
			id, "companyId", "categoryId", amount, currency, "incomeDate", description, notes, "createdById", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
		)
		RETURNING id
	`
	var id string
	err := r.pool.QueryRow(ctx, query, companyID, input.CategoryID, input.Amount, currency, input.IncomeDate, input.Description, input.Notes, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.GetIncomeByID(ctx, companyID, id)
}

func (r *Repository) UpdateIncome(ctx context.Context, companyID, id string, input UpdateIncomeInput, currency *string) (*IncomeResponse, error) {
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
	if input.IncomeDate != nil {
		sets = append(sets, fmt.Sprintf(`"incomeDate" = $%d`, argID))
		args = append(args, *input.IncomeDate)
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
		UPDATE "Income"
		SET %s
		WHERE id = $1 AND "companyId" = $2
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
	return r.GetIncomeByID(ctx, companyID, retID)
}

func (r *Repository) DeleteIncome(ctx context.Context, companyID, id string) error {
	res, err := r.pool.Exec(ctx, `DELETE FROM "Income" WHERE id = $1 AND "companyId" = $2`, id, companyID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
