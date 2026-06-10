package expenses

import (
	"context"
	"errors"
	"strings"
)

var (
	PayrollExpenseCategoryNames = []string{"Xodimlar oyligi", "Xodimlar avansi"}
	DefaultCategories           = []string{"Ijara", "Transport", "Kommunal", "Ofis", "Reklama", "Xizmatlar", "Soliq", "Boshqa"}
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func normalizeCurrency(c *string) string {
	if c == nil {
		return "UZS"
	}
	s := strings.ToUpper(strings.TrimSpace(*c))
	if s == "USD" {
		return "USD"
	}
	return "UZS"
}

func (s *Service) ListCategories(ctx context.Context, companyID string, includeInactive bool) ([]ExpenseCategoryResponse, error) {
	err := s.repo.EnsureDefaultCategories(ctx, companyID, DefaultCategories, PayrollExpenseCategoryNames)
	if err != nil {
		return nil, err
	}
	return s.repo.ListCategories(ctx, companyID, includeInactive)
}

func (s *Service) CreateCategory(ctx context.Context, companyID string, input CreateCategoryInput) (*ExpenseCategoryResponse, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("Kategoriya nomi bo‘sh bo‘lmasligi kerak")
	}
	existing, err := s.repo.GetCategoryByName(ctx, companyID, name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("Bunday kategoriya allaqachon mavjud")
	}
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	return s.repo.CreateCategory(ctx, companyID, name, sortOrder)
}

func (s *Service) UpdateCategory(ctx context.Context, companyID string, id string, input UpdateCategoryInput) (*ExpenseCategoryResponse, error) {
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("Kategoriya nomi bo‘sh bo‘lmasligi kerak")
		}
		existing, err := s.repo.GetCategoryByName(ctx, companyID, name)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.ID != id {
			return nil, errors.New("Bunday kategoriya allaqachon mavjud")
		}
		input.Name = &name
	}
	cat, err := s.repo.UpdateCategory(ctx, companyID, id, input.Name, input.SortOrder, input.IsActive)
	if errors.Is(err, ErrNotFound) {
		return nil, errors.New("Kategoriya topilmadi")
	}
	return cat, err
}

func (s *Service) GetSummary(ctx context.Context, companyID string, filter ExpenseFilter) (*ExpenseSummaryResponse, error) {
	return s.repo.GetSummary(ctx, companyID, filter, PayrollExpenseCategoryNames)
}

func (s *Service) FindAll(ctx context.Context, companyID string, filter ExpenseFilter, page, limit int) (*ExpenseListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	items, total, err := s.repo.FindAllExpenses(ctx, companyID, filter, page, limit, PayrollExpenseCategoryNames)
	if err != nil {
		return nil, err
	}

	totalPages := total / limit
	if total%limit != 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	return &ExpenseListResponse{
		Items:      items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) FindOne(ctx context.Context, companyID, id string) (*ExpenseResponse, error) {
	e, err := s.repo.GetExpenseByID(ctx, companyID, id)
	if errors.Is(err, ErrNotFound) {
		return nil, errors.New("Xarajat topilmadi")
	}
	return e, err
}

func (s *Service) assertCategory(ctx context.Context, companyID, categoryID string) error {
	cat, err := s.repo.GetCategoryByID(ctx, companyID, categoryID)
	if err != nil || !cat.IsActive {
		return errors.New("Kategoriya topilmadi yoki faol emas")
	}
	return nil
}

func (s *Service) Create(ctx context.Context, companyID, userID string, input CreateExpenseInput) (*ExpenseResponse, error) {
	if err := s.assertCategory(ctx, companyID, input.CategoryID); err != nil {
		return nil, err
	}
	if input.Amount < 0.01 {
		return nil, errors.New("Miqdor noto‘g‘ri")
	}
	currency := normalizeCurrency(input.Currency)

	e, err := s.repo.CreateExpense(ctx, companyID, userID, input, currency)
	if err != nil {
		return nil, err
	}

	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID:  companyID,
		UserID:     userID,
		Action:     "expense.create",
		EntityType: "EXPENSE",
		EntityID:   e.ID,
		NewData:    map[string]any{"amount": input.Amount, "status": "PENDING"},
	})

	return e, nil
}

func (s *Service) Update(ctx context.Context, companyID, userID, id string, input UpdateExpenseInput, canManage bool) (*ExpenseResponse, error) {
	e, err := s.repo.GetExpenseByID(ctx, companyID, id)
	if err != nil {
		return nil, errors.New("Xarajat topilmadi")
	}
	if e.Status != "PENDING" {
		return nil, errors.New("Faqat kutilayotgan xarajatni tahrirlash mumkin")
	}
	if !canManage && e.CreatedByID != userID {
		return nil, errors.New("Faqat o‘z xarajatingizni tahrirlashingiz mumkin")
	}

	if input.CategoryID != nil {
		if err := s.assertCategory(ctx, companyID, *input.CategoryID); err != nil {
			return nil, err
		}
	}
	var cur *string
	if input.Currency != nil {
		c := normalizeCurrency(input.Currency)
		cur = &c
	}

	updated, err := s.repo.UpdateExpense(ctx, companyID, id, input, cur)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) Approve(ctx context.Context, companyID, userID, id string) (*ExpenseResponse, error) {
	e, err := s.repo.GetExpenseByID(ctx, companyID, id)
	if err != nil {
		return nil, errors.New("Xarajat topilmadi")
	}
	if e.Status != "PENDING" {
		return nil, errors.New("Faqat kutilayotgan xarajat tasdiqlanadi")
	}

	updated, err := s.repo.UpdateExpenseStatus(ctx, companyID, id, userID, "APPROVED", nil)
	if err != nil {
		return nil, err
	}

	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID:  companyID,
		UserID:     userID,
		Action:     "expense.approve",
		EntityType: "EXPENSE",
		EntityID:   e.ID,
		NewData:    map[string]any{"status": "APPROVED"},
	})

	return updated, nil
}

func (s *Service) Reject(ctx context.Context, companyID, userID, id string, input RejectExpenseInput) (*ExpenseResponse, error) {
	e, err := s.repo.GetExpenseByID(ctx, companyID, id)
	if err != nil {
		return nil, errors.New("Xarajat topilmadi")
	}
	if e.Status != "PENDING" {
		return nil, errors.New("Faqat kutilayotgan xarajat rad etiladi")
	}

	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("Rad etish sababi majburiy")
	}

	updated, err := s.repo.UpdateExpenseStatus(ctx, companyID, id, userID, "REJECTED", &reason)
	if err != nil {
		return nil, err
	}

	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID:  companyID,
		UserID:     userID,
		Action:     "expense.reject",
		EntityType: "EXPENSE",
		EntityID:   e.ID,
		NewData:    map[string]any{"status": "REJECTED", "reason": reason},
	})

	return updated, nil
}

func (s *Service) Remove(ctx context.Context, companyID, userID, id string, canManage bool) error {
	e, err := s.repo.GetExpenseByID(ctx, companyID, id)
	if err != nil {
		return errors.New("Xarajat topilmadi")
	}
	if e.Status != "PENDING" {
		return errors.New("Faqat kutilayotgan xarajatni o‘chirish mumkin")
	}
	if !canManage && e.CreatedByID != userID {
		return errors.New("Faqat o‘z xarajatingizni o‘chirishingiz mumkin")
	}

	err = s.repo.DeleteExpense(ctx, companyID, id)
	if err != nil {
		return err
	}

	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID:  companyID,
		UserID:     userID,
		Action:     "expense.delete",
		EntityType: "EXPENSE",
		EntityID:   e.ID,
		OldData:    map[string]any{"amount": e.Amount},
	})

	return nil
}
