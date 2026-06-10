package income

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"
)

var DefaultCategories = []string{
	"Savdo", "POS savdo", "B2B savdo", "Qarz qaytimi", "Xizmat haqi", "Investitsiya", "Boshqa",
}

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
	if strings.ToUpper(strings.TrimSpace(*c)) == "USD" {
		return "USD"
	}
	return "UZS"
}

func parseIncomeDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, errors.New("Sana noto'g'ri")
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", strings.Split(s, "T")[0]); err == nil {
		return t, nil
	}
	return time.Time{}, errors.New("Sana noto'g'ri")
}

func endOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999000000, t.Location())
}

func (s *Service) ListCategories(ctx context.Context, companyID string) ([]IncomeCategoryResponse, error) {
	if err := s.repo.EnsureDefaultCategories(ctx, companyID, DefaultCategories); err != nil {
		return nil, err
	}
	return s.repo.ListCategories(ctx, companyID, false)
}

func (s *Service) CreateCategory(ctx context.Context, companyID string, input CreateCategoryInput) (*IncomeCategoryResponse, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("Kategoriya nomi bo'sh bo'lmasligi kerak")
	}
	existing, err := s.repo.GetCategoryByName(ctx, companyID, name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("Bunday kategoriya allaqachon mavjud")
	}
	sort := 0
	if input.SortOrder != nil {
		sort = *input.SortOrder
	}
	return s.repo.CreateCategory(ctx, companyID, name, sort)
}

func (s *Service) UpdateCategory(ctx context.Context, companyID, id string, input UpdateCategoryInput) (*IncomeCategoryResponse, error) {
	if _, err := s.repo.GetCategoryByID(ctx, companyID, id); err != nil {
		return nil, errors.New("Kategoriya topilmadi")
	}
	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		dup, err := s.repo.GetCategoryByName(ctx, companyID, strings.TrimSpace(*input.Name))
		if err != nil {
			return nil, err
		}
		if dup != nil && dup.ID != id {
			return nil, errors.New("Bunday kategoriya allaqachon mavjud")
		}
	}
	return s.repo.UpdateCategory(ctx, companyID, id, input.Name, input.SortOrder, input.IsActive)
}

func (s *Service) FindAll(ctx context.Context, companyID string, q map[string]string) (*IncomeListResponse, error) {
	page, _ := strconv.Atoi(q["page"])
	if page <= 0 {
		page = 1
	}
	limit, _ := strconv.Atoi(q["limit"])
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	filter := IncomeFilter{}
	if cat := strings.TrimSpace(q["categoryId"]); cat != "" {
		filter.CategoryID = &cat
	}
	if from := strings.TrimSpace(q["from"]); from != "" {
		if t, err := time.Parse("2006-01-02", strings.Split(from, "T")[0]); err == nil {
			filter.From = &t
		}
	}
	if to := strings.TrimSpace(q["to"]); to != "" {
		if t, err := time.Parse("2006-01-02", strings.Split(to, "T")[0]); err == nil {
			end := endOfDay(t)
			filter.To = &end
		}
	}
	if search := strings.TrimSpace(q["search"]); search != "" {
		filter.Search = &search
	}

	items, total, err := s.repo.FindAllIncomes(ctx, companyID, filter, page, limit)
	if err != nil {
		return nil, err
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	return &IncomeListResponse{
		Items: items, Total: total, Page: page, Limit: limit, TotalPages: totalPages,
	}, nil
}

func (s *Service) GetSummary(ctx context.Context, companyID string, filter IncomeFilter) (*IncomeSummaryResponse, error) {
	return s.repo.GetSummary(ctx, companyID, filter)
}

func (s *Service) FindOne(ctx context.Context, companyID, id string) (*IncomeResponse, error) {
	inc, err := s.repo.GetIncomeByID(ctx, companyID, id)
	if errors.Is(err, ErrNotFound) {
		return nil, errors.New("Kirim topilmadi")
	}
	return inc, err
}

func (s *Service) assertCategory(ctx context.Context, companyID, categoryID string) error {
	cat, err := s.repo.GetCategoryByID(ctx, companyID, categoryID)
	if err != nil || !cat.IsActive {
		return errors.New("Kategoriya topilmadi yoki faol emas")
	}
	return nil
}

func (s *Service) Create(ctx context.Context, companyID, userID string, input CreateIncomeInput) (*IncomeResponse, error) {
	if err := s.assertCategory(ctx, companyID, input.CategoryID); err != nil {
		return nil, err
	}
	dt, err := parseIncomeDate(input.IncomeDate)
	if err != nil {
		return nil, err
	}
	currency := normalizeCurrency(input.Currency)
	input.IncomeDate = dt.Format(time.RFC3339)

	inc, err := s.repo.CreateIncome(ctx, companyID, userID, input, currency)
	if err != nil {
		return nil, err
	}
	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID: companyID, UserID: userID, Action: "income.create",
		EntityType: "INCOME", EntityID: inc.ID, NewData: map[string]any{"amount": input.Amount},
	})
	return inc, nil
}

func (s *Service) Update(ctx context.Context, companyID, userID, id string, input UpdateIncomeInput, canManage bool) (*IncomeResponse, error) {
	inc, err := s.repo.GetIncomeByID(ctx, companyID, id)
	if err != nil {
		return nil, errors.New("Kirim topilmadi")
	}
	if !canManage && inc.CreatedByID != userID {
		return nil, errors.New("Faqat o'z kirimingizni tahrirlashingiz mumkin")
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
	if input.IncomeDate != nil {
		dt, err := parseIncomeDate(*input.IncomeDate)
		if err != nil {
			return nil, err
		}
		s := dt.Format(time.RFC3339)
		input.IncomeDate = &s
	}
	return s.repo.UpdateIncome(ctx, companyID, id, input, cur)
}

func (s *Service) Remove(ctx context.Context, companyID, userID, id string, canManage bool) error {
	inc, err := s.repo.GetIncomeByID(ctx, companyID, id)
	if err != nil {
		return errors.New("Kirim topilmadi")
	}
	if !canManage && inc.CreatedByID != userID {
		return errors.New("Faqat o'z kirimingizni o'chirishingiz mumkin")
	}
	if err := s.repo.DeleteIncome(ctx, companyID, id); err != nil {
		return err
	}
	_ = s.repo.CreateAuditLog(ctx, AuditLogParams{
		CompanyID: companyID, UserID: userID, Action: "income.delete",
		EntityType: "INCOME", EntityID: id, OldData: map[string]any{"amount": inc.Amount},
	})
	return nil
}
