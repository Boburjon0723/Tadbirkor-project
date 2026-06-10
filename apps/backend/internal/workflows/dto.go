package workflows

import "time"

type CreateWorkflowDefinitionInput struct {
	EventKey string  `json:"eventKey"`
	Name     string  `json:"name"`
	Enabled  *bool   `json:"enabled,omitempty"`
}

type CreateWorkflowStepInput struct {
	StepKey    string  `json:"stepKey"`
	Role       string  `json:"role"`
	OrderIndex int     `json:"orderIndex"`
	Required   *bool   `json:"required,omitempty"`
}

type ExecuteWorkflowEventInput struct {
	Context    map[string]any `json:"context,omitempty"`
	SourceID   *string        `json:"sourceId,omitempty"`
	SourceType *string        `json:"sourceType,omitempty"`
}

type WorkflowStepResponse struct {
	ID                   string    `json:"id"`
	WorkflowDefinitionID string    `json:"workflowDefinitionId"`
	StepKey              string    `json:"stepKey"`
	Role                 string    `json:"role"`
	OrderIndex           int       `json:"orderIndex"`
	Required             bool      `json:"required"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type WorkflowDefinitionResponse struct {
	ID        string                 `json:"id"`
	CompanyID string                 `json:"companyId"`
	EventKey  string                 `json:"eventKey"`
	Name      string                 `json:"name"`
	Enabled   bool                   `json:"enabled"`
	CreatedAt time.Time              `json:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt"`
	Steps     []WorkflowStepResponse `json:"steps"`
}
