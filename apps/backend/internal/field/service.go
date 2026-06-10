package field

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

type Service struct {
	pool      *pgxpool.Pool
	repo      *Repository
	companies *companies.Service
	notify    *notifications.Service
	hub       pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, repo *Repository, companiesSvc *companies.Service, notify *notifications.Service, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, repo: repo, companies: companiesSvc, notify: notify, hub: hub}
}

func (s *Service) assertFieldModule(ctx context.Context, companyID string) error {
	return s.companies.AssertModuleEnabled(ctx, companyID, "FIELD_SERVICE")
}

func (s *Service) enrichTask(ctx context.Context, companyID string, task map[string]any) (map[string]any, error) {
	return s.repo.EnrichTaskPlannedItems(ctx, companyID, task)
}

func (s *Service) FindAll(ctx context.Context, companyID string, status, assigneeID, warehouseID *string) ([]map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	return s.repo.ListTasks(ctx, companyID, status, assigneeID, warehouseID)
}

func (s *Service) FindOne(ctx context.Context, companyID, id string) (map[string]any, error) {
	task, err := s.repo.FindTask(ctx, companyID, id, true)
	if err != nil {
		return nil, err
	}
	return s.enrichTask(ctx, companyID, task)
}

func (s *Service) CreateAndAssign(ctx context.Context, companyID, userID string, input CreateFieldTaskInput) (map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	if _, err := s.repo.AssertFieldWorker(ctx, companyID, input.AssigneeID); err != nil {
		return nil, err
	}
	if len(input.PlannedItems) == 0 {
		return nil, errBadRequest("Kamida bitta mahsulot qatori kerak")
	}
	whName, err := s.repo.WarehouseExists(ctx, companyID, input.SourceWarehouseID)
	if err != nil {
		return nil, err
	}

	planned := make([]PlannedItem, len(input.PlannedItems))
	for i, p := range input.PlannedItems {
		planned[i] = PlannedItem{VariantID: p.VariantID, Qty: p.Qty}
		if p.Label != nil {
			planned[i].Label = *p.Label
		}
	}
	planned, err = s.repo.LoadVariantLabels(ctx, companyID, planned)
	if err != nil {
		return nil, err
	}

	assigneeName, _ := s.repo.GetAssigneeName(ctx, companyID, input.AssigneeID)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	taskID, err := s.repo.CreateTaskTx(ctx, tx, companyID, userID, input, planned)
	if err != nil {
		return nil, err
	}

	for _, item := range planned {
		_, err := stock.RecordOneOutInTx(ctx, tx, companyID, userID, StockSourceAssign, stock.Line{
			WarehouseID:      input.SourceWarehouseID,
			ProductVariantID: item.VariantID,
			Quantity:         item.Qty,
			SourceID:         taskID,
			Note:             fmt.Sprintf("Dala vazifasi: %s", input.Title),
		})
		if err != nil {
			return nil, err
		}
		if err := s.repo.UpsertUserStockTx(ctx, tx, companyID, input.AssigneeID, item.VariantID, input.SourceWarehouseID, item.Qty); err != nil {
			return nil, err
		}
	}

	_ = s.repo.CreateAuditLogTx(ctx, tx, companyID, userID, "field.task.assigned", taskID, map[string]any{
		"plannedItems": planned, "assigneeId": input.AssigneeID,
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": input.SourceWarehouseID,
		"reason":      "FIELD_TASK",
	})

	itemSummary := make([]string, len(planned))
	for i, p := range planned {
		label := p.Label
		if label == "" {
			label = "Mahsulot"
		}
		itemSummary[i] = fmt.Sprintf("%s: %v", label, p.Qty)
	}
	summary := strings.Join(itemSummary, ", ")

	_ = s.notify.NotifyUser(ctx, input.AssigneeID, "Yangi dala vazifasi",
		fmt.Sprintf(`"%s" — %s. Ilovada qabul qiling.`, input.Title, summary), "INFO")
	_ = s.notify.NotifyCompanyRoles(ctx, companyID, []string{"OWNER", "MANAGER", "WAREHOUSE"},
		"Ombordan dala xodimiga tovar berildi",
		fmt.Sprintf("%s: \"%s\". Ombor: %s. %s", assigneeName, input.Title, whName, summary),
		"INFO", "FIELD_SERVICE", "field.stock.assigned",
		&notifications.TelegramPayload{
			ModuleKey: "FIELD_SERVICE", EventKey: "field.stock.assigned",
			Details:     map[string]any{"taskId": taskID, "warehouse": whName},
			TargetRoles: []string{"OWNER", "MANAGER", "WAREHOUSE"},
		})

	return s.FindOne(ctx, companyID, taskID)
}

func (s *Service) GetMyTasks(ctx context.Context, userID, companyID string, status *string) ([]map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	tasks, err := s.repo.ListMyTasks(ctx, companyID, userID, status)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, len(tasks))
	for i, t := range tasks {
		enriched, err := s.enrichTask(ctx, companyID, t)
		if err != nil {
			return nil, err
		}
		out[i] = enriched
	}
	return out, nil
}

func (s *Service) GetMyStock(ctx context.Context, userID, companyID string) ([]map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	return s.repo.ListMyStock(ctx, companyID, userID)
}

func (s *Service) AcceptTask(ctx context.Context, companyID, userID, id string) (map[string]any, error) {
	task, err := s.FindOne(ctx, companyID, id)
	if err != nil {
		return nil, err
	}
	if task["assigneeId"] != userID {
		return nil, ErrForbidden
	}
	if task["status"] != StatusAssigned {
		return nil, errBadRequest("Vazifa allaqachon qabul qilingan yoki yakunlangan")
	}
	if err := s.repo.AcceptTask(ctx, id); err != nil {
		return nil, err
	}
	return s.FindOne(ctx, companyID, id)
}

func (s *Service) SubmitReport(ctx context.Context, companyID, userID, id string, input SubmitFieldReportInput) (map[string]any, error) {
	task, err := s.FindOne(ctx, companyID, id)
	if err != nil {
		return nil, err
	}
	if task["assigneeId"] != userID {
		return nil, ErrForbidden
	}
	st := task["status"].(string)
	if st != StatusInProgress && st != StatusNeedsFix {
		return nil, errBadRequest("Avval topshiriqni qabul qiling, keyin tugatganingizda hisobot yuboring")
	}

	plannedRaw, _ := task["plannedItems"].([]PlannedItem)
	plannedMap := map[string]float64{}
	for _, p := range plannedRaw {
		plannedMap[p.VariantID] = p.Qty
	}
	submitted := map[string]bool{}
	for _, item := range input.Items {
		if _, ok := plannedMap[item.VariantID]; !ok {
			return nil, errBadRequest("Faqat vazifadagi mahsulotlarni kiritish mumkin")
		}
		plannedQty := plannedMap[item.VariantID]
		total := item.UsedQty + item.ReturnedQty + item.LostQty
		if total > plannedQty {
			return nil, errBadRequest(fmt.Sprintf("Variant %s: jami %v reja miqdoridan (%v) oshib ketdi", item.VariantID, total, plannedQty))
		}
		submitted[item.VariantID] = true
	}
	if len(submitted) != len(plannedMap) {
		return nil, errBadRequest("Barcha vazifa mahsulotlari bo'yicha hisobot to'ldiring")
	}

	var gpsDistanceM *float64
	if input.GpsLat != nil && input.GpsLng != nil {
		if lat, ok := task["lat"].(*float64); ok && lat != nil {
			if lng, ok2 := task["lng"].(*float64); ok2 && lng != nil {
				d := haversineDistanceM(*lat, *lng, *input.GpsLat, *input.GpsLng)
				gpsDistanceM = &d
			}
		}
	}

	reportItems := make([]ReportItem, len(input.Items))
	for i, it := range input.Items {
		reportItems[i] = ReportItem{VariantID: it.VariantID, UsedQty: it.UsedQty, ReturnedQty: it.ReturnedQty, LostQty: it.LostQty}
	}
	photos := input.Photos
	if photos == nil {
		photos = []string{}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.UpsertReportTx(ctx, tx, id, reportItems, photos, input.GpsLat, input.GpsLng, gpsDistanceM, input.Comment); err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `UPDATE "FieldTask" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, StatusReported, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	assignee := task["assignee"].(map[string]any)
	assigneeName, _ := assignee["fullName"].(string)
	summaryParts := make([]string, len(input.Items))
	for i, it := range input.Items {
		summaryParts[i] = fmt.Sprintf("ishlatildi %v, qoldi %v", it.UsedQty, it.ReturnedQty)
	}
	taskID, _ := task["id"].(string)
	_ = s.notify.NotifyCompanyRoles(ctx, companyID, []string{"OWNER", "MANAGER"},
		"Dala vazifasi hisoboti",
		fmt.Sprintf("%s — \"%s\". %s. Tasdiqlaysizmi?", assigneeName, task["title"], strings.Join(summaryParts, "; ")),
		"WARNING", "FIELD_SERVICE", "field.task.reported",
		&notifications.TelegramPayload{
			ModuleKey: "FIELD_SERVICE", EventKey: "field.task.reported",
			Details: map[string]any{"taskId": taskID, "worker": assigneeName},
			TargetRoles: []string{"OWNER", "MANAGER"},
			Actions: []notifications.TelegramAction{
				{Key: "FIELD_APPROVE", Label: "✅ Tasdiqlash", TargetType: "FIELD_TASK", TargetID: taskID},
				{Key: "FIELD_REJECT", Label: "❌ Rad etish", TargetType: "FIELD_TASK", TargetID: taskID},
			},
		})

	return s.FindOne(ctx, companyID, id)
}

func (s *Service) ApproveTask(ctx context.Context, companyID, userID, id string) (map[string]any, error) {
	task, err := s.FindOne(ctx, companyID, id)
	if err != nil {
		return nil, err
	}
	if task["status"] != StatusReported {
		return nil, errBadRequest("Faqat hisobot yuborilgan vazifani tasdiqlash mumkin")
	}
	report, ok := task["report"].(map[string]any)
	if !ok || report == nil {
		return nil, errBadRequest("Hisobot topilmadi")
	}
	items, _ := report["items"].([]ReportItem)
	if items == nil {
		// JSON decode may produce []any
		if raw, ok := report["items"].([]any); ok {
			for _, r := range raw {
				if m, ok := r.(map[string]any); ok {
					items = append(items, ReportItem{
						VariantID: fmt.Sprint(m["variantId"]),
						UsedQty:   toFloat(m["usedQty"]),
						ReturnedQty: toFloat(m["returnedQty"]),
						LostQty:   toFloat(m["lostQty"]),
					})
				}
			}
		}
	}

	assigneeID := task["assigneeId"].(string)
	warehouseID := task["sourceWarehouseId"].(string)
	title := task["title"].(string)
	reportID := report["id"].(string)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		totalOut := item.UsedQty + item.ReturnedQty + item.LostQty
		stockID, onHand, err := s.repo.GetUserStockTx(ctx, tx, assigneeID, item.VariantID, warehouseID)
		if errors.Is(err, pgx.ErrNoRows) {
			if totalOut > 0 {
				return nil, errBadRequest(fmt.Sprintf("Ishchi balansida tovar yo'q (variant %s)", item.VariantID))
			}
			continue
		}
		if err != nil {
			return nil, err
		}
		if totalOut > float64(onHand) {
			return nil, errBadRequest(fmt.Sprintf("Ishchi balansida yetarli tovar yo'q (variant %s)", item.VariantID))
		}

		if item.UsedQty > 0 {
			if err := s.repo.DecrementUserStockTx(ctx, tx, stockID, item.UsedQty); err != nil {
				return nil, err
			}
			if err := s.repo.InsertMovementOnlyTx(ctx, tx, companyID, warehouseID, item.VariantID, userID, "OUT",
				StockSourceWorkerCustomer, id, item.UsedQty, fmt.Sprintf("Mijozga sarflandi: %s", title)); err != nil {
				return nil, err
			}
		}
		if item.ReturnedQty > 0 {
			if err := s.repo.DecrementUserStockTx(ctx, tx, stockID, item.ReturnedQty); err != nil {
				return nil, err
			}
			_, err := stock.RecordOneInTx(ctx, tx, companyID, userID, stock.Line{
				WarehouseID: warehouseID, ProductVariantID: item.VariantID,
				Quantity: item.ReturnedQty, SourceID: id, Note: fmt.Sprintf("Omborga qaytdi: %s", title),
			}, StockSourceWorkerReturn)
			if err != nil {
				return nil, err
			}
		}
		if item.LostQty > 0 {
			if err := s.repo.DecrementUserStockTx(ctx, tx, stockID, item.LostQty); err != nil {
				return nil, err
			}
			if err := s.repo.InsertMovementOnlyTx(ctx, tx, companyID, warehouseID, item.VariantID, userID, "OUT",
				StockSourceWorkerLoss, id, item.LostQty, fmt.Sprintf("Yo'qotish/sindirish: %s", title)); err != nil {
				return nil, err
			}
		}
	}

	if err := s.repo.CreateApprovalTx(ctx, tx, reportID, id, userID, "APPROVED", "WEB", nil); err != nil {
		return nil, err
	}
	if err := s.repo.ApproveTaskTx(ctx, tx, id, userID); err != nil {
		return nil, err
	}
	_ = s.repo.CreateAuditLogTx(ctx, tx, companyID, userID, "field.task.approved", id, map[string]any{"items": items})
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": warehouseID,
		"reason":      "FIELD_TASK",
	})
	_ = s.notify.NotifyUser(ctx, assigneeID, "Vazifa tasdiqlandi",
		fmt.Sprintf(`"%s" hisobotingiz tasdiqlandi.`, title), "SUCCESS")

	return s.FindOne(ctx, companyID, id)
}

func (s *Service) RejectTask(ctx context.Context, companyID, userID, id string, reason string) (map[string]any, error) {
	if strings.TrimSpace(reason) == "" {
		return nil, errBadRequest("Rad etish sababi kerak")
	}
	task, err := s.FindOne(ctx, companyID, id)
	if err != nil {
		return nil, err
	}
	if task["status"] != StatusReported {
		return nil, errBadRequest("Faqat hisobot yuborilgan vazifani rad etish mumkin")
	}
	report, ok := task["report"].(map[string]any)
	if !ok || report == nil {
		return nil, errBadRequest("Hisobot topilmadi")
	}
	reportID := report["id"].(string)
	assigneeID := task["assigneeId"].(string)
	title := task["title"].(string)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.CreateApprovalTx(ctx, tx, reportID, id, userID, "REJECTED", "WEB", &reason); err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `UPDATE "FieldTask" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, StatusNeedsFix, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	_ = s.notify.NotifyUser(ctx, assigneeID, "Hisobot rad etildi",
		fmt.Sprintf(`"%s": %s. Qayta hisobot yuboring.`, title, reason), "WARNING")

	return s.FindOne(ctx, companyID, id)
}

func (s *Service) ListWorkerBalances(ctx context.Context, companyID string) (map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	return s.repo.ListWorkerBalances(ctx, companyID)
}

func (s *Service) GetKpi(ctx context.Context, companyID string, from, to *string) (map[string]any, error) {
	if err := s.assertFieldModule(ctx, companyID); err != nil {
		return nil, errBadRequest(err.Error())
	}
	dateTo := time.Now()
	if to != nil && strings.TrimSpace(*to) != "" {
		if t, err := time.Parse("2006-01-02", strings.TrimSpace(*to)); err == nil {
			dateTo = t
		}
		if !strings.Contains(strings.TrimSpace(*to), "T") {
			dateTo = time.Date(dateTo.Year(), dateTo.Month(), dateTo.Day(), 23, 59, 59, 999999999, dateTo.Location())
		}
	}
	dateFrom := time.Date(dateTo.Year(), dateTo.Month(), 1, 0, 0, 0, 0, dateTo.Location())
	if from != nil && strings.TrimSpace(*from) != "" {
		if t, err := time.Parse("2006-01-02", strings.TrimSpace(*from)); err == nil {
			dateFrom = t
		}
	}
	return s.repo.GetKPI(ctx, companyID, dateFrom, dateTo)
}

func toFloat(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	default:
		return 0
	}
}
