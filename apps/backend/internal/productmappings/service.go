package productmappings

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("Mapping topilmadi")
	ErrBadInput  = errors.New("Hamkor mahsulot nomi bo'sh bo'lmasligi kerak")
	ErrVariantNF = errors.New("Maxsulot varianti topilmadi yoki nofaol")
	ErrPartnerNF = errors.New("Faol hamkor topilmadi")
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type CreateInput struct {
	PartnerCompanyID    string   `json:"partnerCompanyId"`
	PartnerProductName  string   `json:"partnerProductName"`
	PartnerSku          *string  `json:"partnerSku"`
	PartnerBarcode      *string  `json:"partnerBarcode"`
	OwnProductVariantID string   `json:"ownProductVariantId"`
	ConversionRatio     *float64 `json:"conversionRatio"`
	UnitMapping         *string  `json:"unitMapping"`
	Status              *string  `json:"status"`
}

type UpdateInput struct {
	PartnerProductName  *string  `json:"partnerProductName"`
	PartnerSku          *string  `json:"partnerSku"`
	PartnerBarcode      *string  `json:"partnerBarcode"`
	OwnProductVariantID *string  `json:"ownProductVariantId"`
	ConversionRatio     *float64 `json:"conversionRatio"`
	UnitMapping         *string  `json:"unitMapping"`
	Status              *string  `json:"status"`
}

func (s *Service) assertActivePartner(ctx context.Context, companyID, partnerCompanyID string) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM "Partner"
		WHERE status = 'ACTIVE' AND (
		  ("ownerCompanyId" = $1 AND "partnerCompanyId" = $2) OR
		  ("ownerCompanyId" = $2 AND "partnerCompanyId" = $1)
		) LIMIT 1
	`, companyID, partnerCompanyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPartnerNF
	}
	return err
}

func (s *Service) FindAll(ctx context.Context, companyID, partnerCompanyID string) ([]map[string]any, error) {
	q := `
		SELECT pm.id, pm."companyId", pm."partnerCompanyId", pm."partnerProductName", pm."partnerSku",
		       pm."partnerBarcode", pm."ownProductVariantId", pm."conversionRatio", pm."unitMapping", pm.status,
		       pm."createdBy", pm."createdAt", pm."updatedAt",
		       pv.id, pv.sku, pv.name, p.id, p.name
		FROM "ProductMapping" pm
		JOIN "ProductVariant" pv ON pv.id = pm."ownProductVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pm."companyId" = $1 AND pm.status = 'ACTIVE'
	`
	args := []any{companyID}
	if partnerCompanyID != "" {
		q += ` AND pm."partnerCompanyId" = $2`
		args = append(args, partnerCompanyID)
	}
	q += ` ORDER BY pm."updatedAt" DESC`
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	partnerIDs := map[string]struct{}{}
	for rows.Next() {
		item, pid, err := scanMappingRow(rows)
		if err != nil {
			return nil, err
		}
		partnerIDs[pid] = struct{}{}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	partners := s.loadPartnerCompanies(ctx, partnerIDs)
	for i := range items {
		if pid, ok := items[i]["partnerCompanyId"].(string); ok {
			items[i]["partnerCompany"] = partners[pid]
		}
	}
	return items, nil
}

func scanMappingRow(rows pgx.Rows) (map[string]any, string, error) {
	var id, companyID, partnerID, partnerName, ownVariantID, pvID, sku, variantName, productID, productName, status, createdBy string
	var partnerSku, partnerBarcode, unitMapping *string
	var ratio float64
	var createdAt, updatedAt any
	if err := rows.Scan(&id, &companyID, &partnerID, &partnerName, &partnerSku, &partnerBarcode, &ownVariantID, &ratio, &unitMapping, &status, &createdBy, &createdAt, &updatedAt, &pvID, &sku, &variantName, &productID, &productName); err != nil {
		return nil, "", err
	}
	return map[string]any{
		"id": id, "companyId": companyID, "partnerCompanyId": partnerID, "partnerProductName": partnerName,
		"partnerSku": partnerSku, "partnerBarcode": partnerBarcode, "ownProductVariantId": ownVariantID,
		"conversionRatio": ratio, "unitMapping": unitMapping, "status": status, "createdBy": createdBy,
		"createdAt": createdAt, "updatedAt": updatedAt,
		"ownProductVariant": map[string]any{
			"id": pvID, "sku": sku, "name": variantName,
			"product": map[string]any{"id": productID, "name": productName},
		},
	}, partnerID, nil
}

func (s *Service) loadPartnerCompanies(ctx context.Context, ids map[string]struct{}) map[string]any {
	out := map[string]any{}
	for id := range ids {
		var name, tin string
		if err := s.pool.QueryRow(ctx, `SELECT name, COALESCE(tin, '') FROM "Company" WHERE id = $1`, id).Scan(&name, &tin); err == nil {
			out[id] = map[string]any{"id": id, "name": name, "tin": tin}
		}
	}
	return out
}

func (s *Service) FindOne(ctx context.Context, companyID, id string) (map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pm.id, pm."companyId", pm."partnerCompanyId", pm."partnerProductName", pm."partnerSku",
		       pm."partnerBarcode", pm."ownProductVariantId", pm."conversionRatio", pm."unitMapping", pm.status,
		       pm."createdBy", pm."createdAt", pm."updatedAt",
		       pv.id, pv.sku, pv.name, p.id, p.name
		FROM "ProductMapping" pm
		JOIN "ProductVariant" pv ON pv.id = pm."ownProductVariantId"
		JOIN "Product" p ON p.id = pv."productId"
		WHERE pm.id = $1 AND pm."companyId" = $2
	`, id, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, ErrNotFound
	}
	item, _, err := scanMappingRow(rows)
	return item, err
}

func (s *Service) GetMissing(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT gr."sellerCompanyId", c.name, gri."productNameSnapshot", gr.id
		FROM "GoodsReceipt" gr
		JOIN "GoodsReceiptItem" gri ON gri."receiptId" = gr.id
		JOIN "Company" c ON c.id = gr."sellerCompanyId"
		WHERE gr."buyerCompanyId" = $1 AND gr.status = 'PENDING'
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]struct{}{}
	out := []map[string]any{}
	for rows.Next() {
		var partnerID, partnerName, productName, receiptID string
		if err := rows.Scan(&partnerID, &partnerName, &productName, &receiptID); err != nil {
			return nil, err
		}
		key := partnerID + "|" + strings.ToLower(strings.TrimSpace(productName))
		if _, ok := seen[key]; ok {
			continue
		}
		var mappingID string
		err := s.pool.QueryRow(ctx, `
			SELECT id FROM "ProductMapping"
			WHERE "companyId" = $1 AND "partnerCompanyId" = $2 AND status = 'ACTIVE'
			  AND LOWER("partnerProductName") = LOWER($3) LIMIT 1
		`, companyID, partnerID, productName).Scan(&mappingID)
		if err == nil {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, map[string]any{
			"partnerCompanyId": partnerID, "partnerCompanyName": partnerName,
			"partnerProductName": productName, "receiptId": receiptID,
		})
	}
	return out, rows.Err()
}

func (s *Service) Create(ctx context.Context, companyID, userID string, in CreateInput) (map[string]any, error) {
	name := strings.TrimSpace(in.PartnerProductName)
	if name == "" {
		return nil, ErrBadInput
	}
	if err := s.assertActivePartner(ctx, companyID, in.PartnerCompanyID); err != nil {
		return nil, err
	}
	if err := s.assertVariant(ctx, companyID, in.OwnProductVariantID); err != nil {
		return nil, err
	}
	ratio := 1.0
	if in.ConversionRatio != nil {
		ratio = *in.ConversionRatio
	}
	status := "ACTIVE"
	if in.Status != nil {
		status = strings.ToUpper(*in.Status)
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "ProductMapping" (
		  id, "companyId", "partnerCompanyId", "partnerProductName", "partnerSku", "partnerBarcode",
		  "ownProductVariantId", "conversionRatio", "unitMapping", status, "createdBy", "createdAt", "updatedAt"
		) VALUES (
		  gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
		) RETURNING id
	`, companyID, in.PartnerCompanyID, name, ptrTrim(in.PartnerSku), ptrTrim(in.PartnerBarcode),
		in.OwnProductVariantID, ratio, in.UnitMapping, status, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.FindOne(ctx, companyID, id)
}

func (s *Service) Update(ctx context.Context, companyID, id, userID string, in UpdateInput) (map[string]any, error) {
	if _, err := s.FindOne(ctx, companyID, id); err != nil {
		return nil, err
	}
	if in.OwnProductVariantID != nil {
		if err := s.assertVariant(ctx, companyID, *in.OwnProductVariantID); err != nil {
			return nil, err
		}
	}
	sets := []string{`"updatedAt" = NOW()`}
	args := []any{id, companyID}
	n := 3
	if in.PartnerProductName != nil {
		v := strings.TrimSpace(*in.PartnerProductName)
		if v == "" {
			return nil, ErrBadInput
		}
		sets = append(sets, `"partnerProductName" = $`+itoa(n))
		args = append(args, v)
		n++
	}
	if in.PartnerSku != nil {
		sets = append(sets, `"partnerSku" = $`+itoa(n))
		args = append(args, ptrTrim(in.PartnerSku))
		n++
	}
	if in.PartnerBarcode != nil {
		sets = append(sets, `"partnerBarcode" = $`+itoa(n))
		args = append(args, ptrTrim(in.PartnerBarcode))
		n++
	}
	if in.OwnProductVariantID != nil {
		sets = append(sets, `"ownProductVariantId" = $`+itoa(n))
		args = append(args, *in.OwnProductVariantID)
		n++
	}
	if in.ConversionRatio != nil {
		sets = append(sets, `"conversionRatio" = $`+itoa(n))
		args = append(args, *in.ConversionRatio)
		n++
	}
	if in.UnitMapping != nil {
		sets = append(sets, `"unitMapping" = $`+itoa(n))
		args = append(args, *in.UnitMapping)
		n++
	}
	if in.Status != nil {
		sets = append(sets, `status = $`+itoa(n))
		args = append(args, strings.ToUpper(*in.Status))
		n++
	}
	_, err := s.pool.Exec(ctx, `UPDATE "ProductMapping" SET `+strings.Join(sets, ", ")+` WHERE id = $1 AND "companyId" = $2`, args...)
	if err != nil {
		return nil, err
	}
	_ = userID
	return s.FindOne(ctx, companyID, id)
}

func (s *Service) Remove(ctx context.Context, companyID, id, userID string) (map[string]any, error) {
	if _, err := s.FindOne(ctx, companyID, id); err != nil {
		return nil, err
	}
	_, err := s.pool.Exec(ctx, `UPDATE "ProductMapping" SET status = 'INACTIVE', "updatedAt" = NOW() WHERE id = $1 AND "companyId" = $2`, id, companyID)
	_ = userID
	return map[string]any{"success": true}, err
}

func (s *Service) assertVariant(ctx context.Context, companyID, variantID string) error {
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "ProductVariant" WHERE id = $1 AND "companyId" = $2 AND status = 'ACTIVE'`, variantID, companyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrVariantNF
	}
	return err
}

func ptrTrim(p *string) any {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(*p)
	if v == "" {
		return nil
	}
	return v
}

func itoa(n int) string {
	const d = "0123456789"
	if n < 10 {
		return string(d[n])
	}
	return itoa(n/10) + string(d[n%10])
}
