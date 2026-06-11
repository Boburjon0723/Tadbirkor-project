package warehouses

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type CreateInput struct {
	Name        string         `json:"name"`
	Address     *string        `json:"address"`
	FieldConfig map[string]any `json:"fieldConfig"`
	Status      *string        `json:"status"`
}

type UpdateInput struct {
	Name        *string        `json:"name"`
	Address     *string        `json:"address"`
	FieldConfig map[string]any `json:"fieldConfig"`
	Status      *string        `json:"status"`
}

func defaultFieldConfig(cfg map[string]any) map[string]any {
	def := func(k string, v bool) bool {
		if cfg == nil {
			return v
		}
		if x, ok := cfg[k].(bool); ok {
			return x
		}
		return v
	}
	return map[string]any{
		"showVariantName":   def("showVariantName", true),
		"showImage":         def("showImage", true),
		"showDescription":   def("showDescription", true),
		"showSku":           def("showSku", true),
		"showBarcode":       def("showBarcode", true),
		"showColor":         def("showColor", true),
		"showTotalStock":    def("showTotalStock", true),
		"showPurchasePrice": def("showPurchasePrice", true),
		"showSalePrice":     def("showSalePrice", true),
	}
}

func mergeFieldConfig(existing []byte, patch map[string]any) ([]byte, error) {
	base := map[string]any{}
	if len(existing) > 0 {
		_ = json.Unmarshal(existing, &base)
	}
	for k, v := range patch {
		base[k] = v
	}
	return json.Marshal(defaultFieldConfig(base))
}

func (s *Service) Create(ctx context.Context, companyID string, in CreateInput) (map[string]any, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, errors.New("Ombor nomi majburiy")
	}
	status := "ACTIVE"
	if in.Status != nil && strings.TrimSpace(*in.Status) != "" {
		status = strings.ToUpper(strings.TrimSpace(*in.Status))
	}
	fc, _ := json.Marshal(defaultFieldConfig(in.FieldConfig))
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "Warehouse" (id, "companyId", name, address, "fieldConfig", status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id
	`, companyID, name, in.Address, fc, status).Scan(&id)
	if err != nil {
		return nil, err
	}
	s.bumpWarehouseCaches(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Update(ctx context.Context, id, companyID string, in UpdateInput) (map[string]any, error) {
	existing, err := s.FindOne(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	sets := []string{`"updatedAt" = NOW()`}
	args := []any{id, companyID}
	n := 3
	if in.Name != nil {
		sets = append(sets, fmt.Sprintf("name = $%d", n))
		args = append(args, strings.TrimSpace(*in.Name))
		n++
	}
	if in.Address != nil {
		sets = append(sets, fmt.Sprintf("address = $%d", n))
		args = append(args, in.Address)
		n++
	}
	if in.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", n))
		args = append(args, strings.ToUpper(strings.TrimSpace(*in.Status)))
		n++
	}
	if in.FieldConfig != nil {
		var raw []byte
		if fc, ok := existing["fieldConfig"]; ok && fc != nil {
			raw, _ = json.Marshal(fc)
		}
		merged, err := mergeFieldConfig(raw, in.FieldConfig)
		if err != nil {
			return nil, err
		}
		sets = append(sets, fmt.Sprintf(`"fieldConfig" = $%d`, n))
		args = append(args, merged)
		n++
	}
	ct, err := s.pool.Exec(ctx, fmt.Sprintf(`UPDATE "Warehouse" SET %s WHERE id = $1 AND "companyId" = $2`, strings.Join(sets, ", ")), args...)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	s.bumpWarehouseCaches(ctx, companyID)
	return s.FindOne(ctx, id, companyID)
}

func (s *Service) Remove(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	if _, err := s.FindOne(ctx, id, companyID); err != nil {
		return nil, err
	}
	ct, err := s.pool.Exec(ctx, `UPDATE "Warehouse" SET status = 'ARCHIVED', "updatedAt" = NOW() WHERE id = $1 AND "companyId" = $2`, id, companyID)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	s.bumpWarehouseCaches(ctx, companyID)
	_ = userID
	return map[string]any{"success": true}, nil
}
