package products

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
)

func importSyncMaxRows() int {
	n, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("IMPORT_SYNC_MAX_ROWS")))
	if n <= 0 {
		return 250
	}
	return n
}

func importConfirmMaxRows() int {
	n, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("IMPORT_CONFIRM_MAX_ROWS")))
	if n <= 0 {
		return 5000
	}
	return n
}

func importProgressEvery() int {
	n, _ := strconv.Atoi(strings.TrimSpace(os.Getenv("IMPORT_BATCH_SIZE")))
	if n <= 0 {
		return 50
	}
	return n
}

func resolveImportJobFinalStatus(success, failed int) string {
	if failed == 0 {
		return "COMPLETED"
	}
	if success > 0 {
		return "COMPLETED_WITH_ERRORS"
	}
	return "FAILED"
}

func (s *Service) enqueueImport(ctx context.Context, companyID, userID string, rows []ImportRow, input ImportConfirmInput, defaultWarehouseID string) (map[string]any, error) {
	mode := "set"
	if input.ImportMode != nil && strings.TrimSpace(*input.ImportMode) != "" {
		mode = strings.TrimSpace(*input.ImportMode)
	}
	rows = reactivateRowsForImportPolicy(rows, input.StockPolicy)
	workRows := normalizeImportWorkRows(rows, defaultWarehouseID)
	if len(rows) > importConfirmMaxRows() {
		return nil, fmt.Errorf("import: %d qator (limit %d). Navbatga bo'lib yuboring", len(rows), importConfirmMaxRows())
	}
	if len(workRows) == 0 {
		return nil, ErrBadInput
	}
	missingWH := 0
	for _, row := range workRows {
		wh := strings.TrimSpace(row.WarehouseID)
		if wh == "" {
			wh = defaultWarehouseID
		}
		if wh == "" {
			missingWH++
		}
	}
	if missingWH > 0 {
		return nil, fmt.Errorf("%d ta qatorda ombor topilmadi. Inventarda omborni tanlang va importni qayta boshlang", missingWH)
	}

	syncMax := importSyncMaxRows()
	if len(workRows) <= syncMax {
		return s.runSyncImportDirect(ctx, companyID, userID, workRows, mode, defaultWarehouseID, input.PartnerLedgerContactID)
	}

	var jobID string
	contactID := (*string)(nil)
	if input.PartnerLedgerContactID != nil && strings.TrimSpace(*input.PartnerLedgerContactID) != "" {
		v := strings.TrimSpace(*input.PartnerLedgerContactID)
		contactID = &v
	}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "ProductImportJob" (id, "companyId", "userId", status, "totalRows", "partnerLedgerContactId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, 'QUEUED', $3, $4, NOW(), NOW())
		RETURNING id
	`, companyID, userID, len(workRows), contactID).Scan(&jobID)
	if err != nil {
		return nil, err
	}

	chunkSize := 500
	for start := 0; start < len(rows); start += chunkSize {
		end := start + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		for i, row := range rows[start:end] {
			rowPayload, _ := marshalStagingPayload(row, mode, defaultWarehouseID)
			_, err = s.pool.Exec(ctx, `
				INSERT INTO "ProductImportStagingRow" (id, "jobId", "rowIndex", payload, status, "createdAt", "updatedAt")
				VALUES (gen_random_uuid(), $1, $2, $3, 'PENDING', NOW(), NOW())
			`, jobID, start+i, rowPayload)
			if err != nil {
				return nil, err
			}
		}
	}

	go s.runImportJobSafe(jobID)
	return map[string]any{"jobId": jobID, "status": "QUEUED", "totalRows": len(workRows)}, nil
}

func reactivateRowsForImportPolicy(rows []ImportRow, stockPolicy *string) []ImportRow {
	policy := "apply_all"
	if stockPolicy != nil && strings.TrimSpace(*stockPolicy) != "" {
		policy = strings.TrimSpace(*stockPolicy)
	}
	if policy != "apply_all" {
		return rows
	}
	out := make([]ImportRow, len(rows))
	copy(out, rows)
	for i := range out {
		row := &out[i]
		if !strings.EqualFold(strings.TrimSpace(row.RowAction), "skip") {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(row.FileStockMode), "without_stock") {
			continue
		}
		qty := importRowExcelQty(*row)
		if qty == nil || *qty <= 0 {
			continue
		}
		if row.ExistingVariantID != nil && strings.TrimSpace(*row.ExistingVariantID) != "" {
			row.RowAction = "update"
		} else {
			row.RowAction = "create"
		}
		row.StockAction = "apply"
	}
	return out
}

func normalizeImportWorkRows(rows []ImportRow, defaultWH string) []ImportRow {
	out := []ImportRow{}
	for _, row := range rows {
		if strings.TrimSpace(row.Name) == "" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(row.RowAction), "skip") && !strings.EqualFold(strings.TrimSpace(row.StockAction), "apply") {
			continue
		}
		if strings.TrimSpace(row.WarehouseID) == "" && defaultWH != "" {
			row.WarehouseID = defaultWH
		}
		out = append(out, row)
	}
	return out
}

func (s *Service) runSyncImportDirect(ctx context.Context, companyID, userID string, workRows []ImportRow, mode, defaultWH string, partnerContactID *string) (map[string]any, error) {
	contactID := (*string)(nil)
	if partnerContactID != nil && strings.TrimSpace(*partnerContactID) != "" {
		v := strings.TrimSpace(*partnerContactID)
		contactID = &v
	}
	var jobID string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "ProductImportJob" (id, "companyId", "userId", status, "totalRows", "partnerLedgerContactId", "startedAt", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, 'RUNNING', $3, $4, NOW(), NOW(), NOW())
		RETURNING id
	`, companyID, userID, len(workRows), contactID).Scan(&jobID)
	if err != nil {
		return nil, err
	}

	acc := (*importLedgerAccumulator)(nil)
	if contactID != nil {
		acc = newImportLedgerAccumulator()
	}
	success, failed, importErrors := s.executeImportRows(ctx, companyID, userID, jobID, workRows, mode, defaultWH, acc)
	finalStatus := resolveImportJobFinalStatus(success, failed)
	_, _ = s.pool.Exec(ctx, `
		UPDATE "ProductImportJob"
		SET status = $2, "processedRows" = $3, "successRows" = $4, "failedRows" = $5,
		    "finishedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $1
	`, jobID, finalStatus, len(workRows), success, failed)

	if contactID != nil {
		s.linkPartnerLedgerFromImport(ctx, companyID, userID, *contactID, jobID, acc)
	}
	s.emitImportDone(companyID, jobID, finalStatus, len(workRows), success, failed, nil)

	return map[string]any{
		"sync":          true,
		"jobId":         jobID,
		"status":        finalStatus,
		"totalRows":     len(workRows),
		"processedRows": len(workRows),
		"successRows":   success,
		"failedRows":    failed,
		"errors":        importErrors,
	}, nil
}

func (s *Service) runImportJobSafe(jobID string) {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			_, _ = s.pool.Exec(ctx, `
				UPDATE "ProductImportJob" SET status='FAILED', "errorMessage"=$2, "finishedAt"=NOW(), "updatedAt"=NOW() WHERE id=$1
			`, jobID, fmt.Sprintf("panic: %v", r))
		}
	}()
	_ = s.processImportJob(ctx, jobID)
}

func (s *Service) processImportJob(ctx context.Context, jobID string) error {
	var companyID, userID, status string
	var partnerContactID *string
	err := s.pool.QueryRow(ctx, `
		SELECT "companyId", "userId", status, "partnerLedgerContactId"
		FROM "ProductImportJob" WHERE id = $1
	`, jobID).Scan(&companyID, &userID, &status, &partnerContactID)
	if err != nil {
		return err
	}
	if status == "CANCELLED" || status == "COMPLETED" || status == "COMPLETED_WITH_ERRORS" || status == "RUNNING" {
		return nil
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE "ProductImportJob" SET status='RUNNING', "startedAt"=NOW(), "errorMessage"=NULL, "updatedAt"=NOW() WHERE id=$1
	`, jobID)
	if err != nil {
		return err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT "rowIndex", payload FROM "ProductImportStagingRow"
		WHERE "jobId" = $1 ORDER BY "rowIndex" ASC
	`, jobID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type stagedRow struct {
		index      int
		payload    ImportRow
		mode       string
		defaultWH  string
	}
	staging := []stagedRow{}
	mode := "set"
	defaultWH := ""
	for rows.Next() {
		var idx int
		var raw []byte
		if err := rows.Scan(&idx, &raw); err != nil {
			return err
		}
		row, rowMode, rowDefaultWH := parseStagingPayload(raw)
		if rowMode != "" {
			mode = rowMode
		}
		if rowDefaultWH != "" {
			defaultWH = rowDefaultWH
		}
		if strings.EqualFold(strings.TrimSpace(row.RowAction), "skip") && !strings.EqualFold(strings.TrimSpace(row.StockAction), "apply") {
			continue
		}
		staging = append(staging, stagedRow{index: idx, payload: row, mode: mode, defaultWH: defaultWH})
	}
	if err := rows.Err(); err != nil {
		return err
	}

	acc := (*importLedgerAccumulator)(nil)
	if partnerContactID != nil && strings.TrimSpace(*partnerContactID) != "" {
		acc = newImportLedgerAccumulator()
	}
	workRows := make([]ImportRow, len(staging))
	for i, srow := range staging {
		workRows[i] = srow.payload
		if srow.mode != "" {
			mode = srow.mode
		}
		if srow.defaultWH != "" {
			defaultWH = srow.defaultWH
		}
	}

	progressEvery := importProgressEvery()
	totalRows := len(workRows)
	success := 0
	failed := 0
	var lastErr string
	importErrors := []map[string]any{}
	catCache := map[string]string{}

	for i, row := range workRows {
		if s.isImportJobCancelled(ctx, jobID) {
			return nil
		}
		wh := strings.TrimSpace(row.WarehouseID)
		if wh == "" {
			wh = defaultWH
		}
		err := s.importOneRowWithLedger(ctx, companyID, userID, row, wh, mode, acc, catCache)
		if err != nil {
			if mapped := mapProductWriteErr(err); mapped != err {
				err = mapped
			}
			failed++
			lastErr = err.Error()
			importErrors = append(importErrors, map[string]any{"rowNumber": i + 1, "message": err.Error(), "name": row.Name})
			_ = s.insertImportStagingFailure(ctx, jobID, staging[i].index, row, err.Error())
		} else {
			success++
		}
		processed := i + 1
		if processed%progressEvery == 0 || processed >= totalRows {
			if s.isImportJobCancelled(ctx, jobID) {
				return nil
			}
			_, _ = s.pool.Exec(ctx, `
				UPDATE "ProductImportJob"
				SET "processedRows"=$2, "successRows"=$3, "failedRows"=$4, "updatedAt"=NOW()
				WHERE id=$1
			`, jobID, processed, success, failed)
			s.emitImportProgress(companyID, jobID, "RUNNING", processed, totalRows, success, failed, nil)
		}
	}

	if s.isImportJobCancelled(ctx, jobID) {
		return nil
	}

	finalStatus := resolveImportJobFinalStatus(success, failed)
	var finalErr *string
	if failed > 0 {
		msg := lastErr
		if msg == "" {
			msg = fmt.Sprintf("%d ta qator import qilinmadi. %d ta muvaffaqiyatli.", failed, success)
		}
		finalErr = &msg
	}
	_, _ = s.pool.Exec(ctx, `
		UPDATE "ProductImportJob"
		SET status=$2, "processedRows"=$3, "successRows"=$4, "failedRows"=$5,
		    "errorMessage"=$6, "finishedAt"=NOW(), "updatedAt"=NOW()
		WHERE id=$1
	`, jobID, finalStatus, totalRows, success, failed, finalErr)

	if partnerContactID != nil && strings.TrimSpace(*partnerContactID) != "" {
		s.linkPartnerLedgerFromImport(ctx, companyID, userID, strings.TrimSpace(*partnerContactID), jobID, acc)
	}
	s.emitImportDone(companyID, jobID, finalStatus, totalRows, success, failed, finalErr)
	_ = importErrors
	return nil
}

func (s *Service) isImportJobCancelled(ctx context.Context, jobID string) bool {
	var status string
	err := s.pool.QueryRow(ctx, `SELECT status FROM "ProductImportJob" WHERE id = $1`, jobID).Scan(&status)
	return err == nil && status == "CANCELLED"
}

func (s *Service) emitImportProgress(companyID, jobID, status string, processed, total, success, failed int, errMsg *string) {
	if s.hub == nil {
		return
	}
	payload := map[string]any{
		"jobId": jobID, "status": status, "processedRows": processed, "totalRows": total,
		"successRows": success, "failedRows": failed, "errorMessage": errMsg,
	}
	s.hub.EmitImportProgress(companyID, payload)
}

func (s *Service) emitImportDone(companyID, jobID, status string, total, success, failed int, errMsg *string) {
	s.emitImportProgress(companyID, jobID, status, total, total, success, failed, errMsg)
	if s.hub != nil {
		pkgrealtime.NotifyInventory(context.Background(), s.hub, s.cache, companyID, map[string]any{"reason": "PRODUCT_IMPORT"})
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func marshalStagingPayload(row ImportRow, mode, defaultWH string) ([]byte, error) {
	payload := map[string]any{}
	raw, err := json.Marshal(row)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	payload["_importMode"] = mode
	if defaultWH != "" {
		payload["_defaultWarehouseId"] = defaultWH
	}
	return json.Marshal(payload)
}

func parseStagingPayload(raw []byte) (ImportRow, string, string) {
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	mode := "set"
	if v, ok := m["_importMode"].(string); ok && strings.TrimSpace(v) != "" {
		mode = strings.TrimSpace(v)
	}
	defaultWH := ""
	if v, ok := m["_defaultWarehouseId"].(string); ok {
		defaultWH = strings.TrimSpace(v)
	}
	delete(m, "_importMode")
	delete(m, "_defaultWarehouseId")
	b, _ := json.Marshal(m)
	var row ImportRow
	_ = json.Unmarshal(b, &row)
	return row, mode, defaultWH
}
