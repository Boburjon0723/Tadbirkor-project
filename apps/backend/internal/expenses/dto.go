package expenses

import (
	"time"
)

type CreateCategoryInput struct {
	Name      string `json:"name"`
	SortOrder *int   `json:"sortOrder,omitempty"`
}

type UpdateCategoryInput struct {
	Name      *string  `json:"name,omitempty"`
	SortOrder *int     `json:"sortOrder,omitempty"`
	IsActive  *bool    `json:"isActive,omitempty"`
}

type ExpenseCategoryResponse struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"companyId"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sortOrder"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateExpenseInput struct {
	CategoryID  string  `json:"categoryId"`
	Amount      float64 `json:"amount"`
	Currency    *string `json:"currency,omitempty"`
	ExpenseDate string  `json:"expenseDate"`
	Description *string `json:"description,omitempty"`
	Notes       *string `json:"notes,omitempty"`
}

type UpdateExpenseInput struct {
	CategoryID  *string  `json:"categoryId,omitempty"`
	Amount      *float64 `json:"amount,omitempty"`
	Currency    *string  `json:"currency,omitempty"`
	ExpenseDate *string  `json:"expenseDate,omitempty"`
	Description *string  `json:"description,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
}

type RejectExpenseInput struct {
	Reason string `json:"reason"`
}

type UserBrief struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Login    string `json:"login"`
}

type CategoryBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ExpenseResponse struct {
	ID           string         `json:"id"`
	CompanyID    string         `json:"companyId"`
	CategoryID   string         `json:"categoryId"`
	Amount       float64        `json:"amount"`
	Currency     string         `json:"currency"`
	ExpenseDate  time.Time      `json:"expenseDate"`
	Description  *string        `json:"description"`
	Notes        *string        `json:"notes"`
	Status       string         `json:"status"`
	RejectReason *string        `json:"rejectReason"`
	CreatedByID  string         `json:"createdById"`
	ApprovedByID *string        `json:"approvedById"`
	ApprovedAt   *time.Time     `json:"approvedAt"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	Category     CategoryBrief  `json:"category"`
	CreatedBy    UserBrief      `json:"createdBy"`
	ApprovedBy   *UserBrief     `json:"approvedBy"`
}

type ExpenseSummaryResponse struct {
	Pending  map[string]float64 `json:"pending"`
	Approved map[string]float64 `json:"approved"`
	Rejected map[string]float64 `json:"rejected"`
	Counts   ExpenseCounts      `json:"counts"`
}

type ExpenseCounts struct {
	Pending  int `json:"pending"`
	Approved int `json:"approved"`
	Rejected int `json:"rejected"`
}

type ExpenseListResponse struct {
	Items      []ExpenseResponse `json:"items"`
	Total      int               `json:"total"`
	Page       int               `json:"page"`
	Limit      int               `json:"limit"`
	TotalPages int               `json:"totalPages"`
}
