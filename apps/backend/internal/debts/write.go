package debts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
)

const (
	partnerArchiveYears    = 3
	maxPartnerArchiveItems = 5000
)

var debtNotifyRoles = []string{"OWNER", "MANAGER", "ACCOUNTANT"}

type debtEntryState struct {
	ID         string
	DebtorID   string
	CreditorID string
	Remaining  float64
	Currency   string
	Status     string
}

type paymentState struct {
	ID             string
	DebtEntryID    string
	Amount         float64
	Status         string
	Currency       string
	DebtorID       string
	CreditorID     string
	EntryRemaining float64
}

func (s *Service) CreatePaymentRecord(ctx context.Context, debtEntryID, companyID, userID string, in CreatePaymentRecordInput) (map[string]any, error) {
	if in.Amount <= 0 {
		return nil, fmt.Errorf("%w: tolov summasi 0 dan katta bolishi kerak", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	entry, err := s.getDebtEntryForUpdate(ctx, tx, debtEntryID)
	if err != nil {
		return nil, err
	}
	if entry.DebtorID != companyID && entry.CreditorID != companyID {
		return nil, ErrNotFound
	}
	if entry.DebtorID != companyID {
		return nil, fmt.Errorf("%w: faqat qarzdor tolov yaratishi mumkin", ErrForbidden)
	}
	if in.Amount > entry.Remaining+debtRemainingEps {
		return nil, fmt.Errorf("%w: tolov summasi qolgan qarzdan oshib ketdi", ErrValidation)
	}

	notes := composePaymentNotes(in.PaymentMethod, in.Notes, "")
	var paymentID string
	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO "DebtPaymentRecord" (
			id, "debtEntryId", amount, status, notes, "createdBy", "createdAt", "updatedAt"
		)
		VALUES (gen_random_uuid()::text, $1, $2, 'PENDING', $3, $4, NOW(), NOW())
		RETURNING id, "createdAt"
	`, debtEntryID, in.Amount, notes, userID).Scan(&paymentID, &createdAt); err != nil {
		return nil, err
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.payment_created", "DEBT_PAYMENT", paymentID, nil, map[string]any{
		"debtEntryId": debtEntryID,
		"amount":      in.Amount,
		"status":      "PENDING",
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	debtorName := s.companyName(ctx, companyID)
	s.notifyCompany(ctx, entry.CreditorID, "Tolov tasdigi kutilmoqda",
		fmt.Sprintf("%s %.2f %s tolov qayd etdi. Tasdiqlang yoki rad eting.", debtorName, in.Amount, entry.Currency),
		"WARNING", "debt.payment_created",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.payment_created",
			Details: map[string]any{
				"hamkor": debtorName, "amount": in.Amount, "currency": entry.Currency, "status": "PENDING",
			},
			TargetRoles: debtNotifyRoles,
			Actions: []notifications.TelegramAction{
				{Key: "DEBT_CONFIRM", Label: "Qabul qilish", TargetType: "DEBT_PAYMENT", TargetID: paymentID},
				{Key: "DEBT_REJECT", Label: "Bekor qilish", TargetType: "DEBT_PAYMENT", TargetID: paymentID},
			},
		})
	s.notifyDebtsChanged(entry.DebtorID, entry.CreditorID, map[string]any{
		"debtEntryId": debtEntryID,
		"reason":      "payment_created",
	})

	return map[string]any{
		"id":          paymentID,
		"debtEntryId": debtEntryID,
		"amount":      in.Amount,
		"status":      "PENDING",
		"notes":       notes,
		"createdAt":   createdAt,
	}, nil
}

func (s *Service) ConfirmPayment(ctx context.Context, recordID, companyID, userID string) (map[string]any, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	payment, err := s.getPaymentForUpdate(ctx, tx, recordID)
	if err != nil {
		return nil, err
	}
	if payment.CreditorID != companyID {
		return nil, fmt.Errorf("%w: faqat haqdor tolovni tasdiqlashi mumkin", ErrForbidden)
	}
	if payment.Status != "PENDING" {
		return nil, ErrAlreadyReviewed
	}
	if payment.Amount > payment.EntryRemaining+debtRemainingEps {
		return nil, fmt.Errorf("%w: tolov summasi qolgan qarzdan oshib ketdi", ErrValidation)
	}

	newRemaining := math.Max(0, payment.EntryRemaining-payment.Amount)
	newStatus := "PARTIAL"
	if newRemaining <= debtRemainingEps {
		newRemaining = 0
		newStatus = "PAID"
	}

	if _, err := tx.Exec(ctx, `
		UPDATE "DebtPaymentRecord"
		SET status = 'CONFIRMED', "confirmedBy" = $2, "updatedAt" = NOW()
		WHERE id = $1
	`, recordID, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE "DebtEntry"
		SET "remainingAmount" = $2, status = $3, "updatedAt" = NOW()
		WHERE id = $1
	`, payment.DebtEntryID, newRemaining, newStatus); err != nil {
		return nil, err
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.payment_confirmed", "DEBT_PAYMENT", recordID, map[string]any{
		"status": payment.Status,
	}, map[string]any{
		"status":          "CONFIRMED",
		"amount":          payment.Amount,
		"remainingAmount": newRemaining,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	creditorName := s.companyName(ctx, companyID)
	title := "Tolov toliq tasdiqlandi"
	ntype := "SUCCESS"
	remainingText := ""
	if newRemaining > 0 {
		title = "Qisman tolov tasdiqlandi"
		ntype = "WARNING"
		remainingText = fmt.Sprintf(" Qolgan qarz: %.2f %s.", newRemaining, payment.Currency)
	}
	s.notifyCompany(ctx, payment.DebtorID, title,
		fmt.Sprintf("%s sizning %.2f %s lik tolovingizni tasdiqladi.%s", creditorName, payment.Amount, payment.Currency, remainingText),
		ntype, "debt.payment_confirmed",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.payment_confirmed",
			Details: map[string]any{
				"haqdor": creditorName, "amount": payment.Amount, "currency": payment.Currency,
				"remainingAmount": newRemaining, "status": newStatus,
			},
			TargetRoles: debtNotifyRoles,
		})
	s.markPendingPaymentNotificationsResolved(ctx, companyID)
	s.notifyDebtsChanged(payment.DebtorID, payment.CreditorID, map[string]any{
		"debtEntryId": payment.DebtEntryID,
		"reason":      "payment_confirmed",
	})

	return map[string]any{"success": true, "remainingAmount": newRemaining, "status": newStatus}, nil
}

func (s *Service) RejectPayment(ctx context.Context, recordID, companyID, userID string) (map[string]any, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	payment, err := s.getPaymentForUpdate(ctx, tx, recordID)
	if err != nil {
		return nil, err
	}
	if payment.CreditorID != companyID {
		return nil, fmt.Errorf("%w: faqat haqdor tolovni rad etishi mumkin", ErrForbidden)
	}
	if payment.Status != "PENDING" {
		return nil, ErrAlreadyReviewed
	}

	if _, err := tx.Exec(ctx, `
		UPDATE "DebtPaymentRecord"
		SET status = 'REJECTED', "updatedAt" = NOW()
		WHERE id = $1
	`, recordID); err != nil {
		return nil, err
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.payment_rejected", "DEBT_PAYMENT", recordID, map[string]any{
		"status": payment.Status,
	}, map[string]any{
		"status": "REJECTED",
		"amount": payment.Amount,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	creditorName := s.companyName(ctx, companyID)
	s.notifyCompany(ctx, payment.DebtorID, "Tolov rad etildi",
		fmt.Sprintf("%s sizning %.2f %s tolovingizni rad etdi.", creditorName, payment.Amount, payment.Currency),
		"ERROR", "debt.payment_rejected",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.payment_rejected",
			Details: map[string]any{
				"haqdor": creditorName, "amount": payment.Amount, "currency": payment.Currency, "status": "REJECTED",
			},
			TargetRoles: debtNotifyRoles,
		})
	s.markPendingPaymentNotificationsResolved(ctx, companyID)
	s.notifyDebtsChanged(payment.DebtorID, payment.CreditorID, map[string]any{
		"debtEntryId": payment.DebtEntryID,
		"reason":      "payment_rejected",
	})

	return map[string]any{"success": true, "status": "REJECTED"}, nil
}

func (s *Service) ApplyPaymentByCreditor(ctx context.Context, debtEntryID, companyID, userID string, in CreatePaymentRecordInput) (map[string]any, error) {
	if in.Amount <= 0 {
		return nil, fmt.Errorf("%w: tolov summasi 0 dan katta bolishi kerak", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	entry, err := s.getDebtEntryForUpdate(ctx, tx, debtEntryID)
	if err != nil {
		return nil, err
	}
	if entry.DebtorID != companyID && entry.CreditorID != companyID {
		return nil, ErrNotFound
	}
	if entry.CreditorID != companyID {
		return nil, fmt.Errorf("%w: faqat haqdor tolovni qollashi mumkin", ErrForbidden)
	}
	if in.Amount > entry.Remaining+debtRemainingEps {
		return nil, fmt.Errorf("%w: tolov summasi qolgan qarzdan oshib ketdi", ErrValidation)
	}

	newRemaining := math.Max(0, entry.Remaining-in.Amount)
	newStatus := "PARTIAL"
	if newRemaining <= debtRemainingEps {
		newRemaining = 0
		newStatus = "PAID"
	}

	notes := composePaymentNotes(in.PaymentMethod, in.Notes, "")
	var paymentID string
	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO "DebtPaymentRecord" (
			id, "debtEntryId", amount, status, notes, "createdBy", "confirmedBy", "createdAt", "updatedAt"
		)
		VALUES (gen_random_uuid()::text, $1, $2, 'CONFIRMED', $3, $4, $4, NOW(), NOW())
		RETURNING id, "createdAt"
	`, debtEntryID, in.Amount, notes, userID).Scan(&paymentID, &createdAt); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE "DebtEntry"
		SET "remainingAmount" = $2, status = $3, "updatedAt" = NOW()
		WHERE id = $1
	`, debtEntryID, newRemaining, newStatus); err != nil {
		return nil, err
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.payment_applied_by_creditor", "DEBT_PAYMENT", paymentID, nil, map[string]any{
		"debtEntryId":     debtEntryID,
		"amount":          in.Amount,
		"status":          "CONFIRMED",
		"remainingAmount": newRemaining,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	creditorName := s.companyName(ctx, companyID)
	title := "Tolov qabul qilindi"
	ntype := "SUCCESS"
	if newRemaining > 0 {
		title = "Qisman tolov qabul qilindi"
		ntype = "WARNING"
	}
	s.notifyCompany(ctx, entry.DebtorID, title,
		fmt.Sprintf("%s %.2f %s tolovni qabul qildi.", creditorName, in.Amount, entry.Currency),
		ntype, "debt.payment_applied_by_creditor",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.payment_applied_by_creditor",
			Details: map[string]any{
				"paymentRecordId": paymentID, "amount": in.Amount, "remainingAmount": newRemaining,
			},
			TargetRoles: debtNotifyRoles,
		})
	s.notifyDebtsChanged(entry.DebtorID, entry.CreditorID, map[string]any{
		"debtEntryId": debtEntryID,
		"reason":      "payment_applied_by_creditor",
	})

	return map[string]any{
		"success":         true,
		"id":              paymentID,
		"createdAt":       createdAt,
		"remainingAmount": newRemaining,
		"status":          newStatus,
	}, nil
}

func (s *Service) RecordPartnerBulkPaymentByDebtor(ctx context.Context, companyID, partnerCompanyID, userID string, in ApplyPartnerBulkPaymentInput) (map[string]any, error) {
	if in.Amount <= 0 {
		return nil, fmt.Errorf("%w: tolov summasi 0 dan katta bolishi kerak", ErrValidation)
	}
	currency := normalizeDebtCurrency(in.Currency)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT de.id, COALESCE(de."remainingAmount", 0)::float8
		FROM "DebtEntry" de
		WHERE de."debtorId" = $1
		  AND de."creditorId" = $2
		  AND COALESCE(de.currency, 'UZS') = $3
		  AND de.status IN ('OPEN', 'PARTIAL')
		  AND de."remainingAmount" > $4
		  AND NOT EXISTS (
			SELECT 1 FROM "DebtPaymentRecord" dpr
			WHERE dpr."debtEntryId" = de.id AND dpr.status = 'PENDING'
		  )
		ORDER BY de."createdAt" ASC, de.id ASC
		FOR UPDATE
	`, companyID, partnerCompanyID, currency, debtRemainingEps)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type alloc struct {
		DebtEntryID string  `json:"debtEntryId"`
		Amount      float64 `json:"amount"`
		FullyPaid   bool    `json:"fullyPaid"`
	}
	allocations := make([]alloc, 0)
	totalRemaining := 0.0
	left := in.Amount
	for rows.Next() {
		var entryID string
		var remaining float64
		if err := rows.Scan(&entryID, &remaining); err != nil {
			return nil, err
		}
		totalRemaining += remaining
		if left <= 0 {
			continue
		}
		portion := math.Min(left, remaining)
		if portion <= 0 {
			continue
		}
		allocations = append(allocations, alloc{
			DebtEntryID: entryID,
			Amount:      portion,
			FullyPaid:   portion >= remaining-debtRemainingEps,
		})
		left -= portion
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(allocations) == 0 {
		return nil, fmt.Errorf("%w: ochiq qarz yozuvi topilmadi", ErrValidation)
	}
	if in.Amount > totalRemaining+debtRemainingEps {
		return nil, fmt.Errorf("%w: tolov summasi qolgan qarzdan oshib ketdi", ErrValidation)
	}

	baseNote := composePaymentNotes(in.PaymentMethod, in.Notes, "Umumiy tolov (qarzdor qayd etdi | FIFO)")
	paymentIDs := make([]string, 0, len(allocations))
	appliedTotal := 0.0
	for _, a := range allocations {
		var paymentID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO "DebtPaymentRecord" (
				id, "debtEntryId", amount, status, notes, "createdBy", "createdAt", "updatedAt"
			)
			VALUES (gen_random_uuid()::text, $1, $2, 'PENDING', $3, $4, NOW(), NOW())
			RETURNING id
		`, a.DebtEntryID, a.Amount, baseNote, userID).Scan(&paymentID); err != nil {
			return nil, err
		}
		paymentIDs = append(paymentIDs, paymentID)
		appliedTotal += a.Amount
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.partner_bulk_payment_recorded", "DEBT_PARTNER", partnerCompanyID, nil, map[string]any{
		"partnerCompanyId": partnerCompanyID,
		"currency":         currency,
		"requestedAmount":  in.Amount,
		"appliedTotal":     appliedTotal,
		"entriesTouched":   len(allocations),
		"paymentIds":       paymentIDs,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	debtorName := s.companyName(ctx, companyID)
	s.notifyCompany(ctx, partnerCompanyID, "Umumiy tolov tasdiqlanishi kutilmoqda",
		fmt.Sprintf("%s %.2f %s umumiy tolov qayd etdi (%d ta yozuv).\n\nMoliya markazida «Umumiy tolovni tasdiqlash» ni bosing.", debtorName, appliedTotal, currency, len(allocations)),
		"WARNING", "debt.partner_bulk_payment_recorded",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.partner_bulk_payment_recorded",
			Details: map[string]any{
				"hamkor": debtorName, "appliedTotal": appliedTotal, "currency": currency, "entriesCount": len(allocations),
			},
			TargetRoles: debtNotifyRoles,
		})
	s.notifyDebtsChanged(companyID, partnerCompanyID, map[string]any{
		"partnerCompanyId": partnerCompanyID,
		"reason":           "partner_bulk_payment_recorded",
	})

	return map[string]any{
		"success":         true,
		"status":          "PENDING",
		"currency":        currency,
		"requestedAmount": in.Amount,
		"appliedTotal":    appliedTotal,
		"entriesTouched":  len(allocations),
		"paymentIds":      paymentIDs,
		"allocations":     allocations,
	}, nil
}

func (s *Service) ConfirmPartnerBulkPaymentsByCreditor(ctx context.Context, companyID, partnerCompanyID, userID string, in ConfirmPartnerBulkPaymentInput) (map[string]any, error) {
	filterCurrency := ""
	if in.Currency != nil && strings.TrimSpace(*in.Currency) != "" {
		filterCurrency = normalizeDebtCurrency(*in.Currency)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT dpr.id,
		       dpr."debtEntryId",
		       COALESCE(dpr.amount, 0)::float8,
		       dpr.status,
		       COALESCE(de.currency, 'UZS'),
		       de."debtorId",
		       de."creditorId",
		       COALESCE(de."remainingAmount", 0)::float8
		FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.status = 'PENDING'
		  AND de."creditorId" = $1
		  AND de."debtorId" = $2
		ORDER BY dpr."createdAt" ASC, dpr.id ASC
		FOR UPDATE OF dpr, de
	`, companyID, partnerCompanyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type pendingRecord struct {
		ID             string
		DebtEntryID    string
		Amount         float64
		Currency       string
		EntryRemaining float64
	}

	records := make([]pendingRecord, 0)
	for rows.Next() {
		var rec pendingRecord
		var status, debtorID, creditorID string
		if err := rows.Scan(&rec.ID, &rec.DebtEntryID, &rec.Amount, &status, &rec.Currency, &debtorID, &creditorID, &rec.EntryRemaining); err != nil {
			return nil, err
		}
		if filterCurrency != "" && rec.Currency != filterCurrency {
			continue
		}
		records = append(records, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, ErrNoPending
	}

	remainingByEntry := map[string]float64{}
	for _, rec := range records {
		current := rec.EntryRemaining
		if existing, ok := remainingByEntry[rec.DebtEntryID]; ok {
			current = existing
		}
		if rec.Amount > current+debtRemainingEps {
			return nil, fmt.Errorf("%w: tolov summasi qolgan qarzdan oshib ketdi", ErrValidation)
		}
		remainingByEntry[rec.DebtEntryID] = math.Max(0, current-rec.Amount)
	}

	paymentIDs := make([]string, 0, len(records))
	confirmedTotal := 0.0
	for _, rec := range records {
		if _, err := tx.Exec(ctx, `
			UPDATE "DebtPaymentRecord"
			SET status = 'CONFIRMED', "confirmedBy" = $2, "updatedAt" = NOW()
			WHERE id = $1
		`, rec.ID, userID); err != nil {
			return nil, err
		}
		paymentIDs = append(paymentIDs, rec.ID)
		confirmedTotal += rec.Amount
	}

	for entryID, remaining := range remainingByEntry {
		newStatus := "PARTIAL"
		normalizedRemaining := remaining
		if normalizedRemaining <= debtRemainingEps {
			normalizedRemaining = 0
			newStatus = "PAID"
		}
		if _, err := tx.Exec(ctx, `
			UPDATE "DebtEntry"
			SET "remainingAmount" = $2, status = $3, "updatedAt" = NOW()
			WHERE id = $1
		`, entryID, normalizedRemaining, newStatus); err != nil {
			return nil, err
		}
	}

	if err := writeAuditLog(ctx, tx, companyID, userID, "debt.partner_bulk_payment_confirmed", "DEBT_PARTNER", partnerCompanyID, nil, map[string]any{
		"partnerCompanyId": partnerCompanyID,
		"currency":         filterCurrency,
		"confirmedCount":   len(paymentIDs),
		"confirmedTotal":   confirmedTotal,
		"paymentIds":       paymentIDs,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	creditorName := s.companyName(ctx, companyID)
	currencyLabel := filterCurrency
	if currencyLabel == "" {
		currencyLabel = "MIXED"
	}
	s.notifyCompany(ctx, partnerCompanyID, "Umumiy tolov tasdiqlandi",
		fmt.Sprintf("%s %.2f %s tolovingizni tasdiqladi (%d ta yozuv).", creditorName, confirmedTotal, currencyLabel, len(paymentIDs)),
		"SUCCESS", "debt.partner_bulk_payment_confirmed",
		&notifications.TelegramPayload{
			ModuleKey: "DEBT", EventKey: "debt.partner_bulk_payment_confirmed",
			Details: map[string]any{
				"haqdor": creditorName, "confirmedTotal": confirmedTotal, "currency": currencyLabel, "confirmedCount": len(paymentIDs),
			},
			TargetRoles: debtNotifyRoles,
		})
	s.markPendingPaymentNotificationsResolved(ctx, companyID)
	s.notifyDebtsChanged(partnerCompanyID, companyID, map[string]any{
		"partnerCompanyId": partnerCompanyID,
		"reason":           "partner_bulk_payment_confirmed",
	})

	return map[string]any{
		"success":        true,
		"confirmedCount": len(paymentIDs),
		"confirmedTotal": confirmedTotal,
		"currency":       filterCurrency,
		"paymentIds":     paymentIDs,
	}, nil
}

func (s *Service) FindPartnerReportArchive(ctx context.Context, companyID string, q map[string]string) (map[string]any, error) {
	tab := "receivable"
	if strings.EqualFold(strings.TrimSpace(q["tab"]), "payable") {
		tab = "payable"
	}
	search := strings.ToLower(strings.TrimSpace(q["search"]))
	settledOnly := true
	switch strings.ToLower(strings.TrimSpace(q["settledOnly"])) {
	case "false", "0", "no":
		settledOnly = false
	}
	page, limit := paginate(q, 30, 100)

	since := time.Now().UTC().AddDate(-partnerArchiveYears, 0, 0)
	rows, err := s.pool.Query(ctx, `
		SELECT de."debtorId",
		       de."creditorId",
		       de.status,
		       COALESCE(de."remainingAmount", 0)::float8,
		       COALESCE(de."updatedAt", de."createdAt"),
		       d.name,
		       COALESCE(d.tin, '-'),
		       c.name,
		       COALESCE(c.tin, '-'),
		       EXISTS (
		         SELECT 1 FROM "DebtPaymentRecord" dpr
		         WHERE dpr."debtEntryId" = de.id AND dpr.status = 'PENDING'
		       ) AS has_pending
		FROM "DebtEntry" de
		JOIN "Company" d ON d.id = de."debtorId"
		JOIN "Company" c ON c.id = de."creditorId"
		WHERE (de."debtorId" = $1 OR de."creditorId" = $1)
		  AND de."updatedAt" >= $2
		ORDER BY de."updatedAt" DESC
		LIMIT $3
	`, companyID, since, maxPartnerArchiveItems)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type archiveItem struct {
		PartnerCompanyID string
		PartnerName      string
		PartnerTin       string
		HasActiveDebt    bool
		LastActivityAt   time.Time
		EntryCount       int
		LastStatus       string
	}

	grouped := map[string]*archiveItem{}
	rowCount := 0
	for rows.Next() {
		rowCount++
		var debtorID, creditorID, status, debtorName, debtorTin, creditorName, creditorTin string
		var remaining float64
		var activityAt time.Time
		var hasPending bool
		if err := rows.Scan(&debtorID, &creditorID, &status, &remaining, &activityAt, &debtorName, &debtorTin, &creditorName, &creditorTin, &hasPending); err != nil {
			return nil, err
		}

		isReceivable := creditorID == companyID
		if tab == "receivable" && !isReceivable {
			continue
		}
		if tab == "payable" && isReceivable {
			continue
		}

		partnerID := creditorID
		partnerName := creditorName
		partnerTin := creditorTin
		if isReceivable {
			partnerID = debtorID
			partnerName = debtorName
			partnerTin = debtorTin
		}

		active := ((status == "OPEN" || status == "PARTIAL") && remaining > debtRemainingEps) || hasPending
		item, ok := grouped[partnerID]
		if !ok {
			grouped[partnerID] = &archiveItem{
				PartnerCompanyID: partnerID,
				PartnerName:      partnerName,
				PartnerTin:       partnerTin,
				HasActiveDebt:    active,
				LastActivityAt:   activityAt,
				EntryCount:       1,
				LastStatus:       status,
			}
			continue
		}
		item.EntryCount++
		if active {
			item.HasActiveDebt = true
		}
		if activityAt.After(item.LastActivityAt) {
			item.LastActivityAt = activityAt
			item.LastStatus = status
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	items := make([]archiveItem, 0, len(grouped))
	for _, it := range grouped {
		if settledOnly && it.HasActiveDebt {
			continue
		}
		if search != "" {
			name := strings.ToLower(it.PartnerName)
			tin := strings.ToLower(it.PartnerTin)
			if !strings.Contains(name, search) && !strings.Contains(tin, search) {
				continue
			}
		}
		items = append(items, *it)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].LastActivityAt.After(items[j].LastActivityAt)
	})

	total := len(items)
	skip := (page - 1) * limit
	if skip > total {
		skip = total
	}
	end := skip + limit
	if end > total {
		end = total
	}

	outItems := make([]map[string]any, 0, end-skip)
	for _, it := range items[skip:end] {
		outItems = append(outItems, map[string]any{
			"partnerCompanyId": it.PartnerCompanyID,
			"partner": map[string]any{
				"name": it.PartnerName,
				"tin":  it.PartnerTin,
			},
			"hasActiveDebt":  it.HasActiveDebt,
			"lastActivityAt": it.LastActivityAt,
			"entryCount":     it.EntryCount,
			"lastStatus":     it.LastStatus,
		})
	}

	return map[string]any{
		"items":        outItems,
		"page":         page,
		"limit":        limit,
		"total":        total,
		"hasMore":      end < total,
		"archiveYears": partnerArchiveYears,
		"capped":       rowCount >= maxPartnerArchiveItems,
	}, nil
}

func (s *Service) getDebtEntryForUpdate(ctx context.Context, tx pgx.Tx, debtEntryID string) (debtEntryState, error) {
	var out debtEntryState
	err := tx.QueryRow(ctx, `
		SELECT id,
		       "debtorId",
		       "creditorId",
		       COALESCE("remainingAmount", 0)::float8,
		       COALESCE(currency, 'UZS'),
		       status
		FROM "DebtEntry"
		WHERE id = $1
		FOR UPDATE
	`, debtEntryID).Scan(&out.ID, &out.DebtorID, &out.CreditorID, &out.Remaining, &out.Currency, &out.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNotFound
	}
	return out, err
}

func (s *Service) getPaymentForUpdate(ctx context.Context, tx pgx.Tx, recordID string) (paymentState, error) {
	var out paymentState
	err := tx.QueryRow(ctx, `
		SELECT dpr.id,
		       dpr."debtEntryId",
		       COALESCE(dpr.amount, 0)::float8,
		       dpr.status,
		       COALESCE(de.currency, 'UZS'),
		       de."debtorId",
		       de."creditorId",
		       COALESCE(de."remainingAmount", 0)::float8
		FROM "DebtPaymentRecord" dpr
		JOIN "DebtEntry" de ON de.id = dpr."debtEntryId"
		WHERE dpr.id = $1
		FOR UPDATE OF dpr, de
	`, recordID).Scan(
		&out.ID,
		&out.DebtEntryID,
		&out.Amount,
		&out.Status,
		&out.Currency,
		&out.DebtorID,
		&out.CreditorID,
		&out.EntryRemaining,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrPaymentNotFound
	}
	return out, err
}

func writeAuditLog(ctx context.Context, tx pgx.Tx, companyID, userID, action, entityType, entityID string, oldData, newData any) error {
	oldJSON, err := toJSONParam(oldData)
	if err != nil {
		return err
	}
	newJSON, err := toJSONParam(newData)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "AuditLog" (
			id, "companyId", "userId", action, "entityType", "entityId", "oldData", "newData", "createdAt"
		)
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())
	`, companyID, userID, action, entityType, entityID, oldJSON, newJSON)
	return err
}

func toJSONParam(v any) (any, error) {
	if v == nil {
		return nil, nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return string(raw), nil
}

func composePaymentNotes(paymentMethod, notes *string, extra string) *string {
	parts := make([]string, 0, 3)
	if paymentMethod != nil && strings.TrimSpace(*paymentMethod) != "" {
		parts = append(parts, "Usul: "+strings.TrimSpace(*paymentMethod))
	}
	if notes != nil && strings.TrimSpace(*notes) != "" {
		parts = append(parts, strings.TrimSpace(*notes))
	}
	if strings.TrimSpace(extra) != "" {
		parts = append(parts, strings.TrimSpace(extra))
	}
	if len(parts) == 0 {
		return nil
	}
	joined := strings.Join(parts, " | ")
	return &joined
}

func normalizeDebtCurrency(v string) string {
	if strings.EqualFold(strings.TrimSpace(v), "USD") {
		return "USD"
	}
	return "UZS"
}

func (s *Service) notifyCompany(ctx context.Context, companyID, title, message, ntype, eventKey string, telegram *notifications.TelegramPayload) {
	if s.notifications == nil || strings.TrimSpace(companyID) == "" {
		return
	}
	tg := telegram
	if tg == nil {
		tg = &notifications.TelegramPayload{ModuleKey: "DEBT", EventKey: eventKey, TargetRoles: debtNotifyRoles}
	} else {
		if tg.ModuleKey == "" {
			tg.ModuleKey = "DEBT"
		}
		if tg.EventKey == "" {
			tg.EventKey = eventKey
		}
		if len(tg.TargetRoles) == 0 {
			tg.TargetRoles = debtNotifyRoles
		}
	}
	_ = s.notifications.NotifyCompany(ctx, companyID, title, message, ntype, tg, "", 5*time.Minute)
}

func (s *Service) companyName(ctx context.Context, companyID string) string {
	var name string
	if err := s.pool.QueryRow(ctx, `SELECT name FROM "Company" WHERE id = $1`, companyID).Scan(&name); err != nil {
		return "Hamkor"
	}
	return name
}

func (s *Service) markPendingPaymentNotificationsResolved(ctx context.Context, companyID string) {
	_, _ = s.pool.Exec(ctx, `
		UPDATE "Notification" n
		SET "isRead" = true
		WHERE n."isRead" = false
		  AND n.title = 'Tolov tasdigi kutilmoqda'
		  AND n."userId" IN (
			SELECT cu."userId"
			FROM "CompanyUser" cu
			WHERE cu."companyId" = $1
		  )
	`, companyID)
}
