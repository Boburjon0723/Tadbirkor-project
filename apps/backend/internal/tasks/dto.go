package tasks

import "time"

type CreateTaskInput struct {
	Title        string  `json:"title"`
	Description  *string `json:"description,omitempty"`
	SourceType   *string `json:"sourceType,omitempty"`
	SourceID     *string `json:"sourceId,omitempty"`
	AssignedRole *string `json:"assignedRole,omitempty"`
	AssigneeID   *string `json:"assigneeId,omitempty"`
	Priority     *string `json:"priority,omitempty"`
	DueDate      *string `json:"dueDate,omitempty"`
}

type UpdateTaskStatusInput struct {
	Status string `json:"status"`
}

type AssignTaskInput struct {
	AssigneeID *string `json:"assigneeId,omitempty"`
	Role       *string `json:"role,omitempty"`
}

type UserBrief struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Login    string `json:"login"`
}

type TaskResponse struct {
	ID           string     `json:"id"`
	CompanyID    string     `json:"companyId"`
	SourceType   *string    `json:"sourceType,omitempty"`
	SourceID     *string    `json:"sourceId,omitempty"`
	Title        string     `json:"title"`
	Description  *string    `json:"description,omitempty"`
	AssignedRole *string    `json:"assignedRole,omitempty"`
	Status       string     `json:"status"`
	Priority     string     `json:"priority"`
	DueDate      *time.Time `json:"dueDate,omitempty"`
	CreatorID    string     `json:"creatorId"`
	AssigneeID   *string    `json:"assigneeId,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	Creator      *UserBrief `json:"creator,omitempty"`
	Assignee     *UserBrief `json:"assignee,omitempty"`
}
