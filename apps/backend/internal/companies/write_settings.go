package companies

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

func (s *Service) GetPosReceiptSettings(ctx context.Context, companyID string) (map[string]any, error) {
	if err := s.assertModuleEnabled(ctx, companyID, "POS"); err != nil {
		return nil, err
	}
	var receiptJSON []byte
	err := s.pool.QueryRow(ctx, `SELECT "posReceiptSettings" FROM "Company" WHERE id = $1`, companyID).Scan(&receiptJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	var raw map[string]any
	_ = json.Unmarshal(receiptJSON, &raw)
	return map[string]any{"settings": posReceiptToMap(normalizePosReceiptSettings(raw))}, nil
}

func (s *Service) UpdatePosReceiptSettings(ctx context.Context, companyID string, patch map[string]any) (map[string]any, error) {
	if err := s.assertModuleEnabled(ctx, companyID, "POS"); err != nil {
		return nil, err
	}
	var receiptJSON []byte
	err := s.pool.QueryRow(ctx, `SELECT "posReceiptSettings" FROM "Company" WHERE id = $1`, companyID).Scan(&receiptJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	var raw map[string]any
	_ = json.Unmarshal(receiptJSON, &raw)
	settings := mergePosReceiptPatch(normalizePosReceiptSettings(raw), patch)
	out, _ := json.Marshal(posReceiptToMap(settings))
	_, err = s.pool.Exec(ctx, `UPDATE "Company" SET "posReceiptSettings" = $1 WHERE id = $2`, out, companyID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"settings": posReceiptToMap(settings)}, nil
}

func (s *Service) GetIntakeSettings(ctx context.Context, companyID, warehouseID, userID string) (map[string]any, error) {
	if err := s.AssertFeatureEnabled(ctx, companyID, "WAREHOUSE_INTAKE"); err != nil {
		return nil, err
	}
	var intakeJSON []byte
	err := s.pool.QueryRow(ctx, `SELECT "warehouseIntakeSettings" FROM "Company" WHERE id = $1`, companyID).Scan(&intakeJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	wid := strings.TrimSpace(warehouseID)
	var warehouseFieldConfig []byte
	if wid != "" {
		if userID != "" {
			whScope, _ := scope.ForUser(ctx, s.pool, companyID, userID)
			if !whScope.Allowed(wid) {
				return nil, scope.ErrWarehouseForbidden
			}
		}
		err = s.pool.QueryRow(ctx, `SELECT "fieldConfig" FROM "Warehouse" WHERE id = $1 AND "companyId" = $2`, wid, companyID).Scan(&warehouseFieldConfig)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("Ombor topilmadi")
		}
		if err != nil {
			return nil, err
		}
	}
	settings := resolveWarehouseIntakeSettings(intakeJSON, warehouseFieldConfig)
	var whOut any = nil
	if wid != "" {
		whOut = wid
	}
	return map[string]any{"settings": intakeToMap(settings), "warehouseId": whOut}, nil
}

func (s *Service) UpdateIntakeSettings(ctx context.Context, companyID string, patch map[string]any) (map[string]any, error) {
	if err := s.AssertFeatureEnabled(ctx, companyID, "WAREHOUSE_INTAKE"); err != nil {
		return nil, err
	}
	var intakeJSON []byte
	err := s.pool.QueryRow(ctx, `SELECT "warehouseIntakeSettings" FROM "Company" WHERE id = $1`, companyID).Scan(&intakeJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	var raw map[string]any
	_ = json.Unmarshal(intakeJSON, &raw)
	settings := mergeIntakePatch(normalizeIntakeSettings(raw), patch)
	out, _ := json.Marshal(intakeToMap(settings))
	_, err = s.pool.Exec(ctx, `UPDATE "Company" SET "warehouseIntakeSettings" = $1 WHERE id = $2`, out, companyID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"settings": intakeToMap(settings)}, nil
}
