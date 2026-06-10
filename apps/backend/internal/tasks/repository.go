package tasks

import (
	"context"
	"errors"
	"time"

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

const selectTaskQuery = `
	SELECT 
		t.id, t."companyId", t."sourceType", t."sourceId", t.title, t.description, 
		t."assignedRole", t.status, t.priority, t."dueDate", t."creatorId", t."assigneeId", 
		t."createdAt", t."updatedAt",
		c.id, c."fullName", c.login,
		a.id, a."fullName", a.login
	FROM "Task" t
	LEFT JOIN "User" c ON t."creatorId" = c.id
	LEFT JOIN "User" a ON t."assigneeId" = a.id
`

func scanTask(row pgx.Row) (*TaskResponse, error) {
	var t TaskResponse
	var cID, cFullName, cLogin *string
	var aID, aFullName, aLogin *string

	err := row.Scan(
		&t.ID, &t.CompanyID, &t.SourceType, &t.SourceID, &t.Title, &t.Description,
		&t.AssignedRole, &t.Status, &t.Priority, &t.DueDate, &t.CreatorID, &t.AssigneeID,
		&t.CreatedAt, &t.UpdatedAt,
		&cID, &cFullName, &cLogin,
		&aID, &aFullName, &aLogin,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if cID != nil {
		t.Creator = &UserBrief{ID: *cID, FullName: *cFullName, Login: *cLogin}
	}
	if aID != nil {
		t.Assignee = &UserBrief{ID: *aID, FullName: *aFullName, Login: *aLogin}
	}

	return &t, nil
}

func (r *Repository) FindAll(ctx context.Context, companyID string) ([]TaskResponse, error) {
	query := selectTaskQuery + ` WHERE t."companyId" = $1 ORDER BY t."createdAt" DESC`
	rows, err := r.pool.Query(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []TaskResponse
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		res = append(res, *t)
	}
	return res, nil
}

func (r *Repository) FindMy(ctx context.Context, companyID, userID string) ([]TaskResponse, error) {
	query := selectTaskQuery + ` WHERE t."companyId" = $1 AND t."assigneeId" = $2 ORDER BY t."createdAt" DESC`
	rows, err := r.pool.Query(ctx, query, companyID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []TaskResponse
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		res = append(res, *t)
	}
	return res, nil
}

func (r *Repository) FindByID(ctx context.Context, companyID, id string) (*TaskResponse, error) {
	query := selectTaskQuery + ` WHERE t."companyId" = $1 AND t.id = $2`
	return scanTask(r.pool.QueryRow(ctx, query, companyID, id))
}

func (r *Repository) Create(ctx context.Context, companyID, creatorID string, input CreateTaskInput) (*TaskResponse, error) {
	query := `
		INSERT INTO "Task" (
			id, "companyId", "sourceType", "sourceId", title, description,
			"assignedRole", status, priority, "creatorId", "assigneeId", "dueDate",
			"createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
		) RETURNING id
	`
	status := "TODO"
	priority := "MEDIUM"
	if input.Priority != nil {
		priority = *input.Priority
	}

	var dueDate *time.Time
	if input.DueDate != nil {
		if t, err := time.Parse(time.RFC3339, *input.DueDate); err == nil {
			dueDate = &t
		}
	}

	var id string
	err := r.pool.QueryRow(ctx, query,
		companyID, input.SourceType, input.SourceID, input.Title, input.Description,
		input.AssignedRole, status, priority, creatorID, input.AssigneeID, dueDate,
	).Scan(&id)

	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, companyID, id)
}

func (r *Repository) UpdateStatus(ctx context.Context, companyID, id, status string) (*TaskResponse, error) {
	query := `
		UPDATE "Task" 
		SET status = $1, "updatedAt" = NOW() 
		WHERE id = $2 AND "companyId" = $3
		RETURNING id
	`
	var retID string
	err := r.pool.QueryRow(ctx, query, status, id, companyID).Scan(&retID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.FindByID(ctx, companyID, id)
}

func (r *Repository) Assign(ctx context.Context, companyID, id string, assigneeID, role *string) (*TaskResponse, error) {
	query := `
		UPDATE "Task" 
		SET "assigneeId" = $1, "assignedRole" = $2, "updatedAt" = NOW() 
		WHERE id = $3 AND "companyId" = $4
		RETURNING id
	`
	var retID string
	err := r.pool.QueryRow(ctx, query, assigneeID, role, id, companyID).Scan(&retID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.FindByID(ctx, companyID, id)
}

func (r *Repository) GetUserByRole(ctx context.Context, companyID, role string) (*string, error) {
	query := `SELECT "userId" FROM "CompanyUser" WHERE "companyId" = $1 AND role = $2 LIMIT 1`
	var id string
	err := r.pool.QueryRow(ctx, query, companyID, role).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}

func (r *Repository) GetUserRole(ctx context.Context, companyID, userID string) (*string, error) {
	query := `SELECT role FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2`
	var role string
	err := r.pool.QueryRow(ctx, query, companyID, userID).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &role, nil
}
