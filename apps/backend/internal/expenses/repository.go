package expenses

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

var ErrNotFound = errors.New("not found")
var ErrDuplicate = errors.New("duplicate")

func (r *Repository) ListCategories(ctx context.Context, companyID string, includeInactive bool) ([]ExpenseCategoryResponse, error) {
	query := `
		SELECT id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt"
		FROM "ExpenseCategory"
		WHERE "companyId" = $1
	`
	if !includeInactive {
		query += ` AND "isActive" = true`
	}
	query += ` ORDER BY "sortOrder" ASC, name ASC`

	rows, err := r.pool.Query(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ExpenseCategoryResponse
	for rows.Next() {
		var cat ExpenseCategoryResponse
		err := rows.Scan(&cat.ID, &cat.CompanyID, &cat.Name, &cat.SortOrder, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt)
		if err != nil {
			return nil, err
		}
		result = append(result, cat)
	}
	return result, nil
}

func (r *Repository) EnsureDefaultCategories(ctx context.Context, companyID string, defaults []string, payrollCategories []string) error {
	for i, name := range defaults {
		_, err := r.pool.Exec(ctx, `
			INSERT INTO "ExpenseCategory" (id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt")
			VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
			ON CONFLICT ("companyId", name) DO NOTHING
		`, companyID, name, i)
		if err != nil {
			return err
		}
	}

	for _, name := range payrollCategories {
		_, err := r.pool.Exec(ctx, `
			UPDATE "ExpenseCategory" SET "isActive" = false
			WHERE "companyId" = $1 AND name = $2
		`, companyID, name)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) GetCategoryByName(ctx context.Context, companyID, name string) (*ExpenseCategoryResponse, error) {
	query := `
		SELECT id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt"
		FROM "ExpenseCategory"
		WHERE "companyId" = $1 AND LOWER(name) = LOWER($2)
	`
	var cat ExpenseCategoryResponse
	err := r.pool.QueryRow(ctx, query, companyID, name).Scan(&cat.ID, &cat.CompanyID, &cat.Name, &cat.SortOrder, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &cat, nil
}

func (r *Repository) GetCategoryByID(ctx context.Context, companyID, id string) (*ExpenseCategoryResponse, error) {
	query := `
		SELECT id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt"
		FROM "ExpenseCategory"
		WHERE "companyId" = $1 AND id = $2
	`
	var cat ExpenseCategoryResponse
	err := r.pool.QueryRow(ctx, query, companyID, id).Scan(&cat.ID, &cat.CompanyID, &cat.Name, &cat.SortOrder, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &cat, nil
}

func (r *Repository) CreateCategory(ctx context.Context, companyID string, name string, sortOrder int) (*ExpenseCategoryResponse, error) {
	query := `
		INSERT INTO "ExpenseCategory" (id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
		RETURNING id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt"
	`
	var cat ExpenseCategoryResponse
	err := r.pool.QueryRow(ctx, query, companyID, name, sortOrder).Scan(&cat.ID, &cat.CompanyID, &cat.Name, &cat.SortOrder, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") {
			return nil, ErrDuplicate
		}
		return nil, err
	}
	return &cat, nil
}

func (r *Repository) UpdateCategory(ctx context.Context, companyID string, id string, name *string, sortOrder *int, isActive *bool) (*ExpenseCategoryResponse, error) {
	var sets []string
	var args []any
	argID := 1

	args = append(args, id, companyID)
	argID = 3

	if name != nil {
		sets = append(sets, fmt.Sprintf(`name = $%d`, argID))
		args = append(args, *name)
		argID++
	}
	if sortOrder != nil {
		sets = append(sets, fmt.Sprintf(`"sortOrder" = $%d`, argID))
		args = append(args, *sortOrder)
		argID++
	}
	if isActive != nil {
		sets = append(sets, fmt.Sprintf(`"isActive" = $%d`, argID))
		args = append(args, *isActive)
		argID++
	}

	sets = append(sets, `"updatedAt" = NOW()`)

	query := fmt.Sprintf(`
		UPDATE "ExpenseCategory"
		SET %s
		WHERE id = $1 AND "companyId" = $2
		RETURNING id, "companyId", name, "sortOrder", "isActive", "createdAt", "updatedAt"
	`, strings.Join(sets, ", "))

	var cat ExpenseCategoryResponse
	err := r.pool.QueryRow(ctx, query, args...).Scan(&cat.ID, &cat.CompanyID, &cat.Name, &cat.SortOrder, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		if strings.Contains(err.Error(), "unique constraint") {
			return nil, ErrDuplicate
		}
		return nil, err
	}
	return &cat, nil
}

func (r *Repository) DeleteExpense(ctx context.Context, companyID, expenseID string) error {
	res, err := r.pool.Exec(ctx, `DELETE FROM "Expense" WHERE id = $1 AND "companyId" = $2`, expenseID, companyID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) CreateAuditLog(ctx context.Context, log AuditLogParams) error {
	var newDataBytes []byte
	if log.NewData != nil {
		b, err := json.Marshal(log.NewData)
		if err == nil {
			newDataBytes = b
		}
	}

	var oldDataBytes []byte
	if log.OldData != nil {
		b, err := json.Marshal(log.OldData)
		if err == nil {
			oldDataBytes = b
		}
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "companyId", "userId", action, "entityType", "entityId", "newData", "oldData", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
	`, log.CompanyID, log.UserID, log.Action, log.EntityType, log.EntityID, string(newDataBytes), string(oldDataBytes))

	return err
}

type AuditLogParams struct {
	CompanyID  string
	UserID     string
	Action     string
	EntityType string
	EntityID   string
	NewData    any
	OldData    any
}
