package workflows

import (
	"context"
	"errors"
	"fmt"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) FindAll(ctx context.Context, companyID string) ([]WorkflowDefinitionResponse, error) {
	return s.repo.FindAll(ctx, companyID)
}

func (s *Service) CreateDefinition(ctx context.Context, companyID string, input CreateWorkflowDefinitionInput) (*WorkflowDefinitionResponse, error) {
	if input.EventKey == "" || input.Name == "" {
		return nil, errors.New("eventKey va name bo‘sh bo‘lmasligi kerak")
	}
	return s.repo.CreateDefinition(ctx, companyID, input)
}

func (s *Service) AddStep(ctx context.Context, companyID, workflowID string, input CreateWorkflowStepInput) (*WorkflowStepResponse, error) {
	if input.StepKey == "" || input.Role == "" {
		return nil, errors.New("stepKey va role bo‘sh bo‘lmasligi kerak")
	}
	res, err := s.repo.AddStep(ctx, companyID, workflowID, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("Workflow topilmadi")
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) ExecuteEvent(ctx context.Context, companyID, eventKey string, input ExecuteWorkflowEventInput, actorUserID string) (map[string]int, error) {
	workflows, err := s.repo.GetActiveWorkflows(ctx, companyID, eventKey)
	if err != nil {
		return nil, err
	}

	if len(workflows) == 0 {
		return map[string]int{"created": 0}, nil
	}

	created := 0
	for _, wf := range workflows {
		for _, step := range wf.Steps {
			assigneeID, err := s.repo.GetFirstUserByRole(ctx, companyID, step.Role)
			if err != nil {
				return nil, err
			}

			sourceType := eventKey
			if input.SourceType != nil && *input.SourceType != "" {
				sourceType = *input.SourceType
			}

			sID := ""
			if input.SourceID != nil {
				sID = *input.SourceID
			}

			priority := "MEDIUM"
			if step.Required {
				priority = "HIGH"
			}

			description := fmt.Sprintf("Workflow: %s / %s", wf.Name, step.StepKey)

			err = s.repo.CreateTask(
				ctx,
				companyID,
				actorUserID,
				sourceType,
				sID,
				step.StepKey,
				description,
				step.Role,
				assigneeID,
				priority,
			)
			if err != nil {
				return nil, err
			}
			created++
		}
	}

	return map[string]int{"created": created}, nil
}
