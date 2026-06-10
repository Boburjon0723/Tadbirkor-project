package picktasks

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
)

type Service struct {
	repo   *Repository
	notify *notifications.Service
}

func NewService(repo *Repository, notify *notifications.Service) *Service {
	return &Service{repo: repo, notify: notify}
}

func (s *Service) List(ctx context.Context, companyID, status, warehouseID string) ([]PickTaskResponse, error) {
	status = strings.TrimSpace(strings.ToUpper(status))
	return s.repo.List(ctx, companyID, status, warehouseID)
}

func (s *Service) FindOne(ctx context.Context, taskID, companyID string) (*PickTaskResponse, error) {
	return s.repo.FindOne(ctx, taskID, companyID)
}

func (s *Service) ListForDispatch(ctx context.Context, dispatchID, companyID string) ([]PickTaskResponse, error) {
	return s.repo.ListForDispatch(ctx, dispatchID, companyID)
}

func (s *Service) Scan(ctx context.Context, taskID, companyID, userID string, input ScanInput) (*PickTaskPlain, error) {
	quantity := 1.0
	if input.Quantity != nil {
		quantity = *input.Quantity
	}
	barcode := strings.TrimSpace(input.Barcode)
	if barcode == "" {
		return nil, errBadRequest("Barcode yoki SKU kiriting")
	}
	if quantity <= 0 {
		return nil, errBadRequest("Miqdor noto'g'ri")
	}

	companyUserID, err := s.repo.FindCompanyUserID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.Scan(ctx, taskID, companyID, companyUserID, barcode, quantity)
}

func (s *Service) Complete(ctx context.Context, taskID, companyID, userID string) (*PickTaskPlain, error) {
	companyUserID, err := s.repo.FindCompanyUserID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.Complete(ctx, taskID, companyID, companyUserID)
}

func (s *Service) CreatePickTasksForDispatch(ctx context.Context, dispatchID string) error {
	result, err := s.repo.CreatePickTasksForDispatch(ctx, dispatchID)
	if err != nil || result == nil || len(result.TaskSummaries) == 0 {
		return err
	}
	go s.notifyPickTasksCreated(result)
	return nil
}

func (s *Service) DeleteTasksForDispatch(ctx context.Context, dispatchID string) error {
	return s.repo.DeleteTasksForDispatch(ctx, dispatchID)
}

func (s *Service) DeleteTasksForDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	return s.repo.DeleteTasksForDispatchTx(ctx, tx, dispatchID)
}

func (s *Service) CancelTasksForDispatch(ctx context.Context, dispatchID string) error {
	return s.repo.CancelTasksForDispatch(ctx, dispatchID)
}

func (s *Service) CancelTasksForDispatchTx(ctx context.Context, tx pgx.Tx, dispatchID string) error {
	return s.repo.CancelTasksForDispatchTx(ctx, tx, dispatchID)
}

func (s *Service) AssertDispatchPicked(ctx context.Context, dispatchID string) error {
	return s.repo.AssertDispatchPicked(ctx, dispatchID)
}

func (s *Service) notifyPickTasksCreated(result *CreatePickTasksResult) {
	ctx := context.Background()
	limit := len(result.TaskSummaries)
	if limit > 3 {
		limit = 3
	}
	parts := make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		t := result.TaskSummaries[i]
		parts = append(parts, fmt.Sprintf("%s (%g ta)", t.ProductName, t.QuantityRequired))
	}
	summary := strings.Join(parts, ", ")
	if extra := len(result.TaskSummaries) - limit; extra > 0 {
		summary += fmt.Sprintf(" +%d ta boshqa", extra)
	}
	message := result.DispatchNumber + ": " + summary
	if err := s.notify.NotifyCompany(ctx, result.SellerCompanyID,
		"Yangi saralash vazifasi", message, "INFO",
		&notifications.TelegramPayload{
			ModuleKey: "WAREHOUSE", EventKey: "pick_task.created",
			Details: map[string]any{
				"dispatchId": result.DispatchID, "dispatchNumber": result.DispatchNumber, "taskCount": len(result.TaskSummaries),
			},
			TargetRoles: []string{"WAREHOUSE", "MANAGER"},
		}, "", 0,
	); err != nil {
		log.Printf("pick_tasks notification failed: %v", err)
	}
}

type badRequestError struct{ msg string }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }
func (e badRequestError) Error() string { return e.msg }
