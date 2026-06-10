package partnerledger

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/pkg/phone"
)

type Service struct {
	pool   *pgxpool.Pool
	repo   *Repository
	notify *notifications.Service
}

func NewService(pool *pgxpool.Pool, repo *Repository, notify *notifications.Service) *Service {
	return &Service{pool: pool, repo: repo, notify: notify}
}

func (s *Service) GetGlobalSummary(ctx context.Context, companyID string) (map[string]any, error) {
	return s.repo.GetGlobalSummary(ctx, companyID)
}

func (s *Service) ListContactsForSelect(ctx context.Context, companyID string, search *string) ([]map[string]any, error) {
	searchVal := ""
	if search != nil {
		searchVal = *search
	}
	return s.repo.ListContactsForSelect(ctx, companyID, searchVal)
}

func (s *Service) ListContacts(ctx context.Context, companyID string, search *string) ([]map[string]any, error) {
	searchVal := ""
	if search != nil {
		searchVal = *search
	}
	return s.repo.ListContacts(ctx, companyID, searchVal)
}

func (s *Service) CreateContact(ctx context.Context, companyID string, input CreatePartnerLedgerContactInput) (map[string]any, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errBadRequest("Ism bo'sh bo'lmasligi kerak")
	}
	var phoneVal, tagVal, notesVal *string
	if input.Phone != nil {
		if p := phone.NormalizeUzPhone(*input.Phone); p != "" {
			phoneVal = &p
		}
	}
	if input.Tag != nil {
		if t := strings.TrimSpace(*input.Tag); t != "" {
			tagVal = &t
		}
	}
	if input.Notes != nil {
		if n := strings.TrimSpace(*input.Notes); n != "" {
			notesVal = &n
		}
	}
	return s.repo.CreateContact(ctx, companyID, name, phoneVal, tagVal, notesVal)
}

func (s *Service) GetContact(ctx context.Context, companyID, contactID string) (map[string]any, error) {
	return s.repo.GetContact(ctx, companyID, contactID)
}

func (s *Service) UpdateContact(ctx context.Context, companyID, contactID string, input UpdatePartnerLedgerContactInput) (map[string]any, error) {
	if _, err := s.repo.GetContact(ctx, companyID, contactID); err != nil {
		return nil, err
	}
	sets := map[string]any{}
	if input.Name != nil {
		sets["name"] = strings.TrimSpace(*input.Name)
	}
	if input.Phone != nil {
		p := phone.NormalizeUzPhone(*input.Phone)
		var phoneVal any
		if p != "" {
			phoneVal = p
		}
		sets["phone"] = phoneVal
		sets["telegramChatId"] = nil
		sets["telegramLinkedAt"] = nil
		sets["telegramLinkStatus"] = "UNLINKED"
	}
	if input.Tag != nil {
		t := strings.TrimSpace(*input.Tag)
		if t == "" {
			sets["tag"] = nil
		} else {
			sets["tag"] = t
		}
	}
	if input.Notes != nil {
		n := strings.TrimSpace(*input.Notes)
		if n == "" {
			sets["notes"] = nil
		} else {
			sets["notes"] = n
		}
	}
	if input.IsActive != nil {
		sets["isActive"] = *input.IsActive
	}
	return s.repo.UpdateContact(ctx, contactID, sets)
}

func (s *Service) DeleteContact(ctx context.Context, companyID, userID, contactID string) (map[string]any, error) {
	if _, err := s.repo.GetContact(ctx, companyID, contactID); err != nil {
		return nil, err
	}
	count, err := s.repo.CountContactOperations(ctx, contactID)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		if err := s.repo.SoftDeleteContact(ctx, contactID); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.DeleteContact(ctx, contactID); err != nil {
			return nil, err
		}
	}
	_ = s.repo.CreateAuditLog(ctx, companyID, userID, "partner_ledger.contact_delete", "PARTNER_LEDGER_CONTACT", contactID, nil)
	return map[string]any{"success": true}, nil
}

func (s *Service) ListOperations(ctx context.Context, companyID, contactID string, pageStr, limitStr *string) (map[string]any, error) {
	if _, err := s.repo.GetContact(ctx, companyID, contactID); err != nil {
		return nil, err
	}
	page, limit := parsePageLimit(derefStr(pageStr, "1"), derefStr(limitStr, "100"))
	return s.repo.ListOperations(ctx, companyID, contactID, page, limit)
}

func (s *Service) GetBalanceHistory(ctx context.Context, companyID, contactID string, days int) (map[string]any, error) {
	if _, err := s.repo.GetContact(ctx, companyID, contactID); err != nil {
		return nil, err
	}
	if days < 1 {
		days = 7
	}
	if days > 90 {
		days = 90
	}
	return s.repo.GetBalanceHistory(ctx, companyID, contactID, days)
}

func (s *Service) CreateOperation(ctx context.Context, companyID, userID, contactID string, input CreatePartnerLedgerOperationInput) (map[string]any, error) {
	if _, err := s.repo.GetContact(ctx, companyID, contactID); err != nil {
		return nil, err
	}
	if err := assertOperationType(input.Type); err != nil {
		return nil, err
	}
	operationDate, err := parseOperationDate(input.OperationDate)
	if err != nil {
		return nil, errBadRequest("Sana noto'g'ri")
	}
	currency := "UZS"
	if input.Currency != nil {
		currency = NormalizeCurrency(*input.Currency)
	}
	var notes *string
	if input.Notes != nil {
		if n := strings.TrimSpace(*input.Notes); n != "" {
			notes = &n
		}
	}
	op, err := s.repo.CreateOperation(ctx, companyID, contactID, userID, input.Type, input.Amount, currency, operationDate, notes)
	if err != nil {
		return nil, err
	}
	_ = s.repo.CreateAuditLog(ctx, companyID, userID, "partner_ledger.operation_create", "PARTNER_LEDGER_OPERATION", op.ID, map[string]any{
		"type": input.Type, "amount": input.Amount, "contactId": contactID,
	})
	item := mapOperationItem(*op, nil)
	return item, nil
}

func (s *Service) UpdateOperation(ctx context.Context, companyID, userID, operationID string, input UpdatePartnerLedgerOperationInput) (map[string]any, error) {
	op, err := s.repo.FindOperation(ctx, companyID, operationID)
	if err != nil {
		return nil, err
	}
	if isStockLinked(op.SourceType, op.SourceID) {
		return nil, errBadRequest("Ombordan kelgan daftar yozuvi qo'lda tahrirlanmaydi. Ombor harakatini o'zgartiring.")
	}
	if input.Type != nil {
		if err := assertOperationType(*input.Type); err != nil {
			return nil, err
		}
	}
	sets := map[string]any{}
	if input.Type != nil {
		sets["type"] = *input.Type
	}
	if input.Amount != nil {
		sets["amount"] = *input.Amount
	}
	if input.Currency != nil {
		sets["currency"] = NormalizeCurrency(*input.Currency)
	}
	if input.OperationDate != nil {
		dt, err := parseOperationDate(*input.OperationDate)
		if err != nil {
			return nil, errBadRequest("Sana noto'g'ri")
		}
		sets["operationDate"] = dt
	}
	if input.Notes != nil {
		n := strings.TrimSpace(*input.Notes)
		if n == "" {
			sets["notes"] = nil
		} else {
			sets["notes"] = n
		}
	}
	updated, err := s.repo.UpdateOperation(ctx, operationID, sets)
	if err != nil {
		return nil, err
	}
	_ = s.repo.CreateAuditLog(ctx, companyID, userID, "partner_ledger.operation_update", "PARTNER_LEDGER_OPERATION", operationID, nil)
	return mapOperationItem(*updated, nil), nil
}

func (s *Service) DeleteOperation(ctx context.Context, companyID, userID, operationID string) (map[string]any, error) {
	op, err := s.repo.FindOperation(ctx, companyID, operationID)
	if err != nil {
		return nil, err
	}
	if isStockLinked(op.SourceType, op.SourceID) {
		return nil, errBadRequest("Ombordan kelgan daftar yozuvi qo'lda o'chirib bo'lmaydi. Ombor harakatini bekor qiling.")
	}
	if err := s.repo.DeleteOperation(ctx, operationID); err != nil {
		return nil, err
	}
	_ = s.repo.CreateAuditLog(ctx, companyID, userID, "partner_ledger.operation_delete", "PARTNER_LEDGER_OPERATION", operationID, nil)
	return map[string]any{"success": true}, nil
}

func parseOperationDate(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, errBadRequest("Sana noto'g'ri")
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errBadRequest("Sana noto'g'ri")
}
