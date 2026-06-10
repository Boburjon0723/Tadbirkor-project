package income

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

type IncomeCategoryResponse struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"companyId"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sortOrder"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateIncomeInput struct {
	CategoryID  string  `json:"categoryId"`
	Amount      float64 `json:"amount"`
	Currency    *string `json:"currency,omitempty"`
	IncomeDate  string  `json:"incomeDate"`
	Description *string `json:"description,omitempty"`
	Notes       *string `json:"notes,omitempty"`
}

type UpdateIncomeInput struct {
	CategoryID  *string  `json:"categoryId,omitempty"`
	Amount      *float64 `json:"amount,omitempty"`
	Currency    *string  `json:"currency,omitempty"`
	IncomeDate  *string  `json:"incomeDate,omitempty"`
	Description *string  `json:"description,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
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

type IncomeResponse struct {
	ID          string        `json:"id"`
	CompanyID   string        `json:"companyId"`
	CategoryID  string        `json:"categoryId"`
	Amount      float64       `json:"amount"`
	Currency    string        `json:"currency"`
	IncomeDate  time.Time     `json:"incomeDate"`
	Description *string       `json:"description"`
	Notes       *string       `json:"notes"`
	CreatedByID string        `json:"createdById"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
	Category    CategoryBrief `json:"category"`
	CreatedBy   UserBrief     `json:"createdBy"`
}

type IncomeSummaryResponse struct {
	Totals     map[string]float64 `json:"totals"`
	ByCategory []IncomeByCategory `json:"byCategory"`
	TotalCount int                `json:"totalCount"`
}

type IncomeByCategory struct {
	CategoryID string             `json:"categoryId"`
	Name       string             `json:"name"`
	Amount     map[string]float64 `json:"amount"`
	Count      int                `json:"count"`
}

type IncomeListResponse struct {
	Items      []IncomeResponse `json:"items"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
	TotalPages int              `json:"totalPages"`
}
