package dispatches

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/picktasks"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

type Service struct {
	pool    *pgxpool.Pool
	repo    *Repository
	picking *picktasks.Service
	notify  *notifications.Service
	hub     pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, repo *Repository, picking *picktasks.Service, notify *notifications.Service, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{pool: pool, repo: repo, picking: picking, notify: notify, hub: hub}
}

var allowedOrderStatuses = map[string]bool{
	"ACCEPTED": true, "PARTIAL_ACCEPTED": true, "PARTIALLY_DISPATCHED": true,
	"DISPATCHED": true, "RECEIVED": true,
}

func (s *Service) Create(ctx context.Context, companyID, userID string, input CreateInput) (map[string]any, error) {
	input.OrderID = strings.TrimSpace(input.OrderID)
	input.WarehouseID = strings.TrimSpace(input.WarehouseID)
	if input.OrderID == "" || input.WarehouseID == "" {
		return nil, errBadRequest("orderId va warehouseId majburiy")
	}

	order, err := s.repo.LoadOrder(ctx, input.OrderID, companyID)
	if err != nil {
		return nil, err
	}

	for _, item := range order.Items {
		if item.ProductVariantID == nil && item.MappingStatus != "MAPPED" {
			return nil, errBadRequest("Buyurtmadagi barcha mahsulotlar mapping qilingan bo'lishi shart")
		}
	}

	ok, err := s.repo.WarehouseExists(ctx, input.WarehouseID, companyID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrWarehouseNF
	}

	if err := s.assertCanCreateDispatch(ctx, order); err != nil {
		return nil, err
	}

	lines, err := s.resolveDispatchLines(ctx, order, input)
	if err != nil {
		return nil, err
	}
	if len(lines) == 0 {
		return nil, errBadRequest("Jo'natish uchun qolgan miqdor topilmadi")
	}

	stockLines := make([]stock.DispatchLine, len(lines))
	for i, line := range lines {
		stockLines[i] = stock.DispatchLine{
			ProductVariantID: line.ProductVariantID,
			Quantity:         line.Quantity,
			Label:            line.ProductNameSnapshot,
		}
	}
	if err := stock.AssertDispatchStockAvailablePool(ctx, s.pool, companyID, input.WarehouseID, stockLines); err != nil {
		return nil, errBadRequest(err.Error())
	}

	existingDraft, err := s.repo.FindExistingDraft(ctx, input.OrderID, companyID)
	if err != nil {
		return nil, err
	}
	if existingDraft != nil && len(input.Items) == 0 {
		return s.repo.GetDispatchWithItems(ctx, *existingDraft)
	}

	hasReservation, err := stock.HasActiveReservations(ctx, stock.PoolQueryRower(s.pool), input.OrderID)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if existingDraft != nil {
		if err := s.picking.DeleteTasksForDispatchTx(ctx, tx, *existingDraft); err != nil {
			return nil, err
		}
		if err := s.repo.DeleteDispatchTx(ctx, tx, *existingDraft); err != nil {
			return nil, err
		}
	}

	if hasReservation {
		resWh, err := stock.GetActiveReservationWarehouse(ctx, stock.TxQueryRower(tx), input.OrderID)
		if err != nil {
			return nil, err
		}
		if resWh != "" && resWh != input.WarehouseID {
			return nil, errBadRequest("Jo'natma ombori buyurtma rezervi qilingan ombor bilan bir xil bo'lishi kerak")
		}
	} else {
		resItems := make([]stock.ReservationItem, len(lines))
		for i, line := range lines {
			resItems[i] = stock.ReservationItem{
				ProductVariantID: line.ProductVariantID,
				WarehouseID:      input.WarehouseID,
				Quantity:         line.Quantity,
			}
		}
		result, err := stock.CreateReservationTx(ctx, tx, input.OrderID, companyID, resItems)
		if err != nil {
			return nil, err
		}
		if !result.Success {
			return nil, errBadRequest("Rezerv yaratib bo'lmadi: " + stock.FormatReservationFailures(result))
		}
	}

	dispatchID, err := s.repo.CreateDispatchTx(ctx, tx, createDispatchParams{
		OrderID: input.OrderID, SellerCompanyID: companyID, BuyerCompanyID: order.BuyerCompanyID,
		WarehouseID: input.WarehouseID, CreatedBy: userID, Lines: lines,
	})
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if err := s.picking.CreatePickTasksForDispatch(ctx, dispatchID); err != nil {
		log.Printf("pick tasks create failed for dispatch %s: %v", dispatchID, err)
	}
	return s.repo.GetDispatchWithItems(ctx, dispatchID)
}

func (s *Service) CreateAndSend(ctx context.Context, companyID, userID string, input CreateInput) (map[string]any, error) {
	dispatch, err := s.Create(ctx, companyID, userID, input)
	if err != nil {
		return nil, err
	}
	if dispatch["status"] == "SENT" {
		return map[string]any{"success": true, "dispatchId": dispatch["id"]}, nil
	}
	dispatchID, _ := dispatch["id"].(string)
	if _, err := s.Send(ctx, dispatchID, companyID, userID); err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "dispatchId": dispatchID}, nil
}

func (s *Service) Send(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	head, err := s.repo.GetDispatchHead(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if head.Status == "SENT" {
		return map[string]any{"success": true}, nil
	}
	if head.Status != "DRAFT" {
		return nil, errBadRequest("Jo'natma yuborish mumkin emas")
	}

	stockLines := make([]stock.DispatchLine, len(head.Items))
	for i, item := range head.Items {
		stockLines[i] = stock.DispatchLine{
			ProductVariantID: item.ProductVariantID,
			Quantity:         item.Quantity,
			Label:            item.ProductNameSnapshot,
		}
	}
	if err := stock.AssertDispatchStockAvailablePool(ctx, s.pool, companyID, head.WarehouseID, stockLines); err != nil {
		return nil, errBadRequest(err.Error())
	}

	if err := s.picking.AssertDispatchPicked(ctx, id); err != nil {
		return nil, errBadRequest(err.Error())
	}

	orderQty, err := s.repo.GetOrderItemsQty(ctx, head.OrderID)
	if err != nil {
		return nil, err
	}
	isPartial := false
	for _, item := range head.Items {
		ordered := orderQty[item.ProductVariantID]
		if ordered > 0 && item.Quantity < ordered {
			isPartial = true
			break
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	movements := make([]stock.Line, len(head.Items))
	for i, item := range head.Items {
		movements[i] = stock.Line{
			WarehouseID:      head.WarehouseID,
			ProductVariantID: item.ProductVariantID,
			Quantity:         item.Quantity,
			Note:             fmt.Sprintf("Dispatch %s", head.DispatchNumber),
		}
	}
	if err := stock.RecordMovements(ctx, tx, companyID, userID, "OUT", "DISPATCH", movements); err != nil {
		if errors.Is(err, stock.ErrInsufficientStock) {
			return nil, errBadRequest(err.Error())
		}
		return nil, err
	}

	consumeItems := make([]struct {
		ProductVariantID string
		Quantity         float64
	}, len(head.Items))
	for i, item := range head.Items {
		consumeItems[i] = struct {
			ProductVariantID string
			Quantity         float64
		}{item.ProductVariantID, item.Quantity}
	}
	if err := stock.ConsumeReservationForShipmentTx(ctx, tx, head.OrderID, consumeItems); err != nil {
		return nil, errBadRequest(err.Error())
	}

	if err := s.repo.SendDispatchTx(ctx, tx, *head, companyID, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	pkgrealtime.NotifyInventory(s.hub, companyID, map[string]any{
		"warehouseId": head.WarehouseID,
		"reason":      "DISPATCH",
	})
	go s.notifyDispatchSent(head, isPartial)
	return map[string]any{"success": true}, nil
}

func (s *Service) Cancel(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	_ = userID
	exists, err := s.repo.FindDraftForCancel(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("Jo'natma topilmadi yoki bekor qilib bo'lmaydi")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := s.picking.CancelTasksForDispatchTx(ctx, tx, id); err != nil {
		return nil, err
	}
	if err := s.repo.CancelDispatchTx(ctx, tx, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	dispatch, err := s.repo.GetDispatchWithItems(ctx, id)
	if err != nil {
		return nil, err
	}
	return dispatch, nil
}

func (s *Service) FindAll(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	return s.repo.FindAll(ctx, companyID, q)
}

func (s *Service) FindOne(ctx context.Context, id, companyID string) (map[string]any, error) {
	return s.repo.FindOne(ctx, id, companyID)
}

func (s *Service) assertCanCreateDispatch(ctx context.Context, order *orderHead) error {
	if !allowedOrderStatuses[order.Status] {
		return errBadRequest("Buyurtma holati jo'natma yaratish uchun mos emas")
	}
	sentByVariant, err := s.repo.GetSentQtyByVariant(ctx, order.ID, nil)
	if err != nil {
		return err
	}
	hasRemaining := false
	for _, item := range order.Items {
		if item.ProductVariantID == nil {
			continue
		}
		if remainingQty(item.Quantity, *item.ProductVariantID, sentByVariant) > 0 {
			hasRemaining = true
			break
		}
	}
	if !hasRemaining {
		return errBadRequest("Buyurtmadagi barcha mahsulotlar allaqachon jo'natilgan")
	}
	return nil
}

func (s *Service) resolveDispatchLines(ctx context.Context, order *orderHead, input CreateInput) ([]dispatchLine, error) {
	sentByVariant, err := s.repo.GetSentQtyByVariant(ctx, order.ID, nil)
	if err != nil {
		return nil, err
	}
	orderByID := map[string]orderItem{}
	for _, item := range order.Items {
		orderByID[item.ID] = item
	}

	if len(input.Items) > 0 {
		lines := []dispatchLine{}
		for _, row := range input.Items {
			if row.Quantity <= 0 {
				continue
			}
			oi, ok := orderByID[row.OrderItemID]
			if !ok {
				return nil, errBadRequest(fmt.Sprintf("Buyurtma qatori topilmadi: %s", row.OrderItemID))
			}
			if oi.ProductVariantID == nil {
				return nil, errBadRequest(fmt.Sprintf("Mahsulot ID-si topilmadi: %s", oi.ProductNameSnapshot))
			}
			maxQty := remainingQty(oi.Quantity, *oi.ProductVariantID, sentByVariant)
			if maxQty <= 0 {
				return nil, errBadRequest(fmt.Sprintf("%s uchun qolgan jo'natiladigan miqdor yo'q", oi.ProductNameSnapshot))
			}
			if row.Quantity > maxQty {
				return nil, errBadRequest(fmt.Sprintf("Jo'natma miqdori qolgan miqdordan oshib ketdi (%s: max %g)", oi.ProductNameSnapshot, maxQty))
			}
			lines = append(lines, dispatchLine{
				ProductVariantID: *oi.ProductVariantID, ProductNameSnapshot: oi.ProductNameSnapshot, Quantity: row.Quantity,
			})
		}
		if len(lines) == 0 {
			return nil, errBadRequest("Kamida bitta mahsulot uchun jo'natma miqdori 0 dan katta bo'lishi kerak")
		}
		return lines, nil
	}

	lines := []dispatchLine{}
	for _, item := range order.Items {
		if item.ProductVariantID == nil || item.Quantity <= 0 {
			continue
		}
		remaining := remainingQty(item.Quantity, *item.ProductVariantID, sentByVariant)
		if remaining > 0 {
			lines = append(lines, dispatchLine{
				ProductVariantID: *item.ProductVariantID, ProductNameSnapshot: item.ProductNameSnapshot, Quantity: remaining,
			})
		}
	}
	return lines, nil
}

func remainingQty(ordered float64, variantID string, sentByVariant map[string]float64) float64 {
	sent := sentByVariant[variantID]
	r := ordered - sent
	if r < 0 {
		return 0
	}
	return r
}

func (s *Service) notifyDispatchSent(head *dispatchHead, isPartial bool) {
	ctx := context.Background()
	sellerName, _ := s.repo.GetSellerName(ctx, head.SellerCompanyID)
	if sellerName == "" {
		sellerName = head.SellerCompanyID
	}
	title := "Yuk yuborildi"
	message := sellerName + " tomonidan yuk jo'natildi. Qabul qilishni kuting."
	eventKey := "dispatch.sent"
	if isPartial {
		title = "Qisman yuk yuborildi"
		message = sellerName + " buyurtmadan kamroq miqdorda yuk jo'natdi (qisman jo'natma). Qabul qilishni kuting."
		eventKey = "dispatch.sent.partial"
	}
	if err := s.notify.NotifyCompany(ctx, head.BuyerCompanyID, title, message, "INFO",
		&notifications.TelegramPayload{
			ModuleKey: "WAREHOUSE", EventKey: eventKey,
			Details: map[string]any{
				"dispatchId": head.ID, "dispatchNumber": head.DispatchNumber,
				"seller": sellerName, "status": "SENT", "isPartialShipment": isPartial,
			},
			TargetRoles: []string{"OWNER", "MANAGER", "WAREHOUSE"},
		}, "", 0,
	); err != nil {
		log.Printf("dispatch.sent notification failed: %v", err)
	}
}

type badRequestError struct{ msg string }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }
func (e badRequestError) Error() string { return e.msg }
