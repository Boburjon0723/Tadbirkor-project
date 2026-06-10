package tasks

import (
	"context"
	"errors"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) FindAll(ctx context.Context, companyID string) ([]TaskResponse, error) {
	return s.repo.FindAll(ctx, companyID)
}

func (s *Service) FindMy(ctx context.Context, companyID, userID string) ([]TaskResponse, error) {
	return s.repo.FindMy(ctx, companyID, userID)
}

func (s *Service) Create(ctx context.Context, companyID, creatorID string, input CreateTaskInput) (*TaskResponse, error) {
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		return nil, errors.New("Sarlavha bo‘sh bo‘lmasligi kerak")
	}

	var assigneeID = input.AssigneeID
	if input.AssignedRole != nil && *input.AssignedRole != "" && assigneeID == nil {
		id, err := s.repo.GetUserByRole(ctx, companyID, *input.AssignedRole)
		if err != nil {
			return nil, err
		}
		assigneeID = id
	}

	if assigneeID != nil {
		role, err := s.repo.GetUserRole(ctx, companyID, *assigneeID)
		if err != nil {
			return nil, err
		}
		if role == nil {
			return nil, errors.New("Belgilangan foydalanuvchi ushbu kompaniyaga tegishli emas")
		}
	}

	input.AssigneeID = assigneeID
	return s.repo.Create(ctx, companyID, creatorID, input)
}

func (s *Service) UpdateStatus(ctx context.Context, companyID, userID, taskID string, input UpdateTaskStatusInput) (*TaskResponse, error) {
	task, err := s.repo.FindByID(ctx, companyID, taskID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("Task topilmadi")
		}
		return nil, err
	}

	isAssignee := task.AssigneeID != nil && *task.AssigneeID == userID
	isCreator := task.CreatorID == userID

	if !isAssignee && !isCreator {
		return nil, errors.New("Faqat task egasi yoki yaratuvchisi holatni o‘zgartira oladi")
	}

	return s.repo.UpdateStatus(ctx, companyID, taskID, input.Status)
}

func (s *Service) Assign(ctx context.Context, companyID, taskID string, input AssignTaskInput) (*TaskResponse, error) {
	task, err := s.repo.FindByID(ctx, companyID, taskID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("Task topilmadi")
		}
		return nil, err
	}

	var assigneeID = input.AssigneeID
	var role = input.Role
	if role == nil {
		role = task.AssignedRole
	}

	if assigneeID == nil && input.Role != nil && *input.Role != "" {
		id, err := s.repo.GetUserByRole(ctx, companyID, *input.Role)
		if err != nil {
			return nil, err
		}
		if id == nil {
			return nil, errors.New("Berilgan rol uchun xodim topilmadi")
		}
		assigneeID = id
	}

	if assigneeID == nil {
		return nil, errors.New("assigneeId yoki role berilishi shart")
	}

	userRole, err := s.repo.GetUserRole(ctx, companyID, *assigneeID)
	if err != nil {
		return nil, err
	}
	if userRole == nil {
		return nil, errors.New("Belgilangan foydalanuvchi ushbu kompaniyaga tegishli emas")
	}

	if role == nil || *role == "" {
		role = userRole
	}

	return s.repo.Assign(ctx, companyID, taskID, assigneeID, role)
}
