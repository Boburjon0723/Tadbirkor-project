package workflows

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

var ErrNotFound = errors.New("not found")

func (r *Repository) FindAll(ctx context.Context, companyID string) ([]WorkflowDefinitionResponse, error) {
	query := `
		SELECT id, "companyId", "eventKey", name, enabled, "createdAt", "updatedAt"
		FROM "WorkflowDefinition"
		WHERE "companyId" = $1
		ORDER BY "createdAt" DESC
	`
	rows, err := r.pool.Query(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var defs []WorkflowDefinitionResponse
	var defIDs []string

	for rows.Next() {
		var w WorkflowDefinitionResponse
		if err := rows.Scan(&w.ID, &w.CompanyID, &w.EventKey, &w.Name, &w.Enabled, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		w.Steps = []WorkflowStepResponse{}
		defs = append(defs, w)
		defIDs = append(defIDs, w.ID)
	}

	if len(defIDs) > 0 {
		stepsQuery := `
			SELECT id, "workflowDefinitionId", "stepKey", role, "orderIndex", required, "createdAt", "updatedAt"
			FROM "WorkflowStep"
			WHERE "workflowDefinitionId" = ANY($1)
			ORDER BY "orderIndex" ASC
		`
		sRows, err := r.pool.Query(ctx, stepsQuery, defIDs)
		if err != nil {
			return nil, err
		}
		defer sRows.Close()

		stepMap := make(map[string][]WorkflowStepResponse)
		for sRows.Next() {
			var s WorkflowStepResponse
			if err := sRows.Scan(&s.ID, &s.WorkflowDefinitionID, &s.StepKey, &s.Role, &s.OrderIndex, &s.Required, &s.CreatedAt, &s.UpdatedAt); err != nil {
				return nil, err
			}
			stepMap[s.WorkflowDefinitionID] = append(stepMap[s.WorkflowDefinitionID], s)
		}

		for i := range defs {
			if steps, ok := stepMap[defs[i].ID]; ok {
				defs[i].Steps = steps
			}
		}
	}

	return defs, nil
}

func (r *Repository) CreateDefinition(ctx context.Context, companyID string, input CreateWorkflowDefinitionInput) (*WorkflowDefinitionResponse, error) {
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}

	query := `
		INSERT INTO "WorkflowDefinition" (
			id, "companyId", "eventKey", name, enabled, "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()
		)
		RETURNING id, "companyId", "eventKey", name, enabled, "createdAt", "updatedAt"
	`
	var w WorkflowDefinitionResponse
	err := r.pool.QueryRow(ctx, query, companyID, input.EventKey, input.Name, enabled).Scan(
		&w.ID, &w.CompanyID, &w.EventKey, &w.Name, &w.Enabled, &w.CreatedAt, &w.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	w.Steps = []WorkflowStepResponse{}
	return &w, nil
}

func (r *Repository) AddStep(ctx context.Context, companyID, workflowID string, input CreateWorkflowStepInput) (*WorkflowStepResponse, error) {
	checkQuery := `SELECT id FROM "WorkflowDefinition" WHERE id = $1 AND "companyId" = $2`
	var tmp string
	err := r.pool.QueryRow(ctx, checkQuery, workflowID, companyID).Scan(&tmp)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	required := true
	if input.Required != nil {
		required = *input.Required
	}

	query := `
		INSERT INTO "WorkflowStep" (
			id, "workflowDefinitionId", "stepKey", role, "orderIndex", required, "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()
		)
		RETURNING id, "workflowDefinitionId", "stepKey", role, "orderIndex", required, "createdAt", "updatedAt"
	`
	var s WorkflowStepResponse
	err = r.pool.QueryRow(ctx, query, workflowID, input.StepKey, input.Role, input.OrderIndex, required).Scan(
		&s.ID, &s.WorkflowDefinitionID, &s.StepKey, &s.Role, &s.OrderIndex, &s.Required, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) GetActiveWorkflows(ctx context.Context, companyID, eventKey string) ([]WorkflowDefinitionResponse, error) {
	query := `
		SELECT id, "companyId", "eventKey", name, enabled, "createdAt", "updatedAt"
		FROM "WorkflowDefinition"
		WHERE "companyId" = $1 AND "eventKey" = $2 AND enabled = true
		ORDER BY "createdAt" DESC
	`
	rows, err := r.pool.Query(ctx, query, companyID, eventKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var defs []WorkflowDefinitionResponse
	var defIDs []string

	for rows.Next() {
		var w WorkflowDefinitionResponse
		if err := rows.Scan(&w.ID, &w.CompanyID, &w.EventKey, &w.Name, &w.Enabled, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		w.Steps = []WorkflowStepResponse{}
		defs = append(defs, w)
		defIDs = append(defIDs, w.ID)
	}

	if len(defIDs) > 0 {
		stepsQuery := `
			SELECT id, "workflowDefinitionId", "stepKey", role, "orderIndex", required, "createdAt", "updatedAt"
			FROM "WorkflowStep"
			WHERE "workflowDefinitionId" = ANY($1)
			ORDER BY "orderIndex" ASC
		`
		sRows, err := r.pool.Query(ctx, stepsQuery, defIDs)
		if err != nil {
			return nil, err
		}
		defer sRows.Close()

		stepMap := make(map[string][]WorkflowStepResponse)
		for sRows.Next() {
			var s WorkflowStepResponse
			if err := sRows.Scan(&s.ID, &s.WorkflowDefinitionID, &s.StepKey, &s.Role, &s.OrderIndex, &s.Required, &s.CreatedAt, &s.UpdatedAt); err != nil {
				return nil, err
			}
			stepMap[s.WorkflowDefinitionID] = append(stepMap[s.WorkflowDefinitionID], s)
		}

		for i := range defs {
			if steps, ok := stepMap[defs[i].ID]; ok {
				defs[i].Steps = steps
			}
		}
	}

	return defs, nil
}

func (r *Repository) GetFirstUserByRole(ctx context.Context, companyID, role string) (*string, error) {
	query := `SELECT "userId" FROM "CompanyUser" WHERE "companyId" = $1 AND role = $2 ORDER BY "createdAt" ASC LIMIT 1`
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

func (r *Repository) CreateTask(ctx context.Context, companyID, creatorID, sourceType, sourceID, title, description, assignedRole string, assigneeID *string, priority string) error {
	query := `
		INSERT INTO "Task" (
			id, "companyId", "sourceType", "sourceId", title, description,
			"assignedRole", status, priority, "creatorId", "assigneeId", "createdAt", "updatedAt"
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'TODO', $7, $8, $9, NOW(), NOW()
		)
	`
	var sID *string
	if sourceID != "" {
		sID = &sourceID
	}

	_, err := r.pool.Exec(ctx, query,
		companyID, sourceType, sID, title, description, assignedRole, priority, creatorID, assigneeID,
	)
	return err
}
