package partners

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
)

var (
	ErrNotFound    = errors.New("Hamkor topilmadi")
	ErrConflict    = errors.New("Hamkorlik allaqachon mavjud")
	ErrBadRequest  = errors.New("Hamkor STIR yoki kompaniya ID si kerak")
	ErrSelfPartner = errors.New("O'zingizga hamkorlik so'rovi yubora olmaysiz")
	ErrNotPending  = errors.New("Faqat PENDING holatidagi so'rovlarni qabul qilish mumkin")
)

type Service struct {
	pool    *pgxpool.Pool
	notify  *notifications.Service
}

func NewService(pool *pgxpool.Pool, notify *notifications.Service) *Service {
	return &Service{pool: pool, notify: notify}
}

type RequestInput struct {
	PartnerCompanyID *string `json:"partnerCompanyId"`
	PartnerTin       *string `json:"partnerTin"`
}

func (s *Service) FindAll(ctx context.Context, companyID string) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p."ownerCompanyId", p."partnerCompanyId", p.status, p."acceptedAt", p."createdAt",
		       p."warehouseVisibilityConfig",
		       oc.id, oc.name, oc.tin, oc.phone, oc.address, oc."businessType",
		       pc.id, pc.name, pc.tin, pc.phone, pc.address, pc."businessType"
		FROM "Partner" p
		JOIN "Company" oc ON oc.id = p."ownerCompanyId"
		JOIN "Company" pc ON pc.id = p."partnerCompanyId"
		WHERE p."ownerCompanyId" = $1 OR p."partnerCompanyId" = $1
		ORDER BY p."createdAt" DESC
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		m, err := scanPartnerRow(rows, companyID)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func companySummary(id, name string, tin, phone, addr, biz *string) map[string]any {
	return map[string]any{
		"id": id, "name": name, "tin": tin, "phone": phone, "address": addr, "businessType": biz,
	}
}

func parseVisibilityConfig(config []byte) any {
	if len(config) == 0 {
		return nil
	}
	var v any
	if json.Unmarshal(config, &v) != nil {
		return nil
	}
	return v
}

func extractVisibleWarehouseIds(config []byte, companyID string) any {
	if len(config) == 0 {
		return nil
	}
	var raw map[string]json.RawMessage
	if json.Unmarshal(config, &raw) != nil {
		return nil
	}
	entry, ok := raw[companyID]
	if !ok {
		return nil
	}
	var ids []string
	if json.Unmarshal(entry, &ids) != nil {
		return nil
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id != "" {
			out = append(out, id)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func buildPartnerResponse(
	id, ownerID, partnerID, status string,
	acceptedAt *time.Time,
	createdAt time.Time,
	visJSON []byte,
	companyID string,
	ownerCompany, partnerCompany map[string]any,
) map[string]any {
	isIncoming := partnerID == companyID
	company := ownerCompany
	if !isIncoming {
		company = partnerCompany
	}
	return map[string]any{
		"id":                                   id,
		"ownerCompanyId":                       ownerID,
		"partnerCompanyId":                     partnerID,
		"status":                               status,
		"acceptedAt":                           acceptedAt,
		"createdAt":                            createdAt,
		"warehouseVisibilityConfig":            parseVisibilityConfig(visJSON),
		"ownerCompany":                         ownerCompany,
		"partnerCompany":                       partnerCompany,
		"isIncoming":                           isIncoming,
		"visibleWarehouseIdsForCurrentCompany": extractVisibleWarehouseIds(visJSON, companyID),
		"company":                              company,
	}
}

func scanPartnerRow(rows pgx.Rows, companyID string) (map[string]any, error) {
	var id, ownerID, partnerID, status string
	var acceptedAt *time.Time
	var createdAt time.Time
	var visJSON []byte
	var ocID, ocName string
	var ocTin, ocPhone, ocAddr, ocBiz *string
	var pcID, pcName string
	var pcTin, pcPhone, pcAddr, pcBiz *string
	if err := rows.Scan(&id, &ownerID, &partnerID, &status, &acceptedAt, &createdAt, &visJSON,
		&ocID, &ocName, &ocTin, &ocPhone, &ocAddr, &ocBiz,
		&pcID, &pcName, &pcTin, &pcPhone, &pcAddr, &pcBiz); err != nil {
		return nil, err
	}
	return buildPartnerResponse(
		id, ownerID, partnerID, status, acceptedAt, createdAt, visJSON, companyID,
		companySummary(ocID, ocName, ocTin, ocPhone, ocAddr, ocBiz),
		companySummary(pcID, pcName, pcTin, pcPhone, pcAddr, pcBiz),
	), nil
}

func (s *Service) FindOne(ctx context.Context, companyID, id string) (map[string]any, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT p.id, p."ownerCompanyId", p."partnerCompanyId", p.status, p."acceptedAt", p."createdAt", p."warehouseVisibilityConfig",
		       oc.id, oc.name, oc.tin, pc.id, pc.name, pc.tin
		FROM "Partner" p
		JOIN "Company" oc ON oc.id = p."ownerCompanyId"
		JOIN "Company" pc ON pc.id = p."partnerCompanyId"
		WHERE p.id = $1 AND (p."ownerCompanyId" = $2 OR p."partnerCompanyId" = $2)
	`, id, companyID)
	var pid, ownerID, partnerID, status string
	var acceptedAt *time.Time
	var createdAt time.Time
	var visJSON []byte
	var ocID, ocName string
	var ocTin *string
	var pcID, pcName string
	var pcTin *string
	if err := row.Scan(&pid, &ownerID, &partnerID, &status, &acceptedAt, &createdAt, &visJSON,
		&ocID, &ocName, &ocTin, &pcID, &pcName, &pcTin); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	return buildPartnerResponse(
		pid, ownerID, partnerID, status, acceptedAt, createdAt, visJSON, companyID,
		companySummary(ocID, ocName, ocTin, nil, nil, nil),
		companySummary(pcID, pcName, pcTin, nil, nil, nil),
	), nil
}

func (s *Service) SearchCompany(ctx context.Context, tin string) (map[string]any, error) {
	tin = strings.TrimSpace(tin)
	var id, name string
	var phone, address *string
	err := s.pool.QueryRow(ctx, `SELECT id, name, phone, address FROM "Company" WHERE tin = $1`, tin).Scan(&id, &name, &phone, &address)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "name": name, "tin": tin, "phone": phone, "address": address}, nil
}

func (s *Service) Request(ctx context.Context, companyID, userID string, in RequestInput) (map[string]any, error) {
	partnerID := ""
	if in.PartnerCompanyID != nil {
		partnerID = strings.TrimSpace(*in.PartnerCompanyID)
	}
	if partnerID == "" && in.PartnerTin != nil {
		c, err := s.SearchCompany(ctx, strings.TrimSpace(*in.PartnerTin))
		if err != nil {
			return nil, err
		}
		partnerID = c["id"].(string)
	}
	if partnerID == "" {
		return nil, ErrBadRequest
	}
	if partnerID == companyID {
		return nil, ErrSelfPartner
	}

	var existingID, existingStatus string
	err := s.pool.QueryRow(ctx, `
		SELECT id, status FROM "Partner"
		WHERE ("ownerCompanyId" = $1 AND "partnerCompanyId" = $2)
		   OR ("ownerCompanyId" = $2 AND "partnerCompanyId" = $1)
		LIMIT 1
	`, companyID, partnerID).Scan(&existingID, &existingStatus)
	if err == nil {
		switch existingStatus {
		case "ACTIVE":
			return nil, errors.New("Ushbu kompaniya bilan allaqachon hamkorlik o'rnatilgan")
		case "PENDING":
			return nil, ErrConflict
		case "BLOCKED":
			return nil, errors.New("Ushbu hamkor bloklangan")
		case "REJECTED":
			_, err = s.pool.Exec(ctx, `UPDATE "Partner" SET status = 'PENDING', "ownerCompanyId" = $1, "partnerCompanyId" = $2, "createdBy" = $3, "updatedAt" = NOW() WHERE id = $4`,
				companyID, partnerID, userID, existingID)
			if err != nil {
				return nil, err
			}
			s.notifyPartnerRequest(ctx, companyID, partnerID, existingID)
			return s.FindOne(ctx, companyID, existingID)
		}
	}

	var id string
	err = s.pool.QueryRow(ctx, `
		INSERT INTO "Partner" (id, "ownerCompanyId", "partnerCompanyId", status, "createdBy", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'PENDING', $3, NOW(), NOW()) RETURNING id
	`, companyID, partnerID, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	s.notifyPartnerRequest(ctx, companyID, partnerID, id)
	return s.FindOne(ctx, companyID, id)
}

func (s *Service) notifyPartnerRequest(ctx context.Context, ownerCompanyID, partnerCompanyID, partnerID string) {
	if s.notify == nil {
		return
	}
	ownerName := "Kompaniya"
	_ = s.pool.QueryRow(ctx, `SELECT name FROM "Company" WHERE id = $1`, ownerCompanyID).Scan(&ownerName)
	_ = s.notify.NotifyCompanyRoles(ctx, partnerCompanyID, []string{"OWNER", "MANAGER"},
		"Yangi hamkor so'rovi",
		ownerName+" hamkorlik so'rovi yubordi.",
		"INFO", "PARTNERS", "partner.request_created",
		&notifications.TelegramPayload{
			ModuleKey: "PARTNERS", EventKey: "partner.request_created",
			Details: map[string]any{
				"partnerRequestId": partnerID, "fromCompany": ownerName, "status": "PENDING",
			},
			TargetRoles: []string{"OWNER", "MANAGER"},
			Actions: []notifications.TelegramAction{
				{Key: "PARTNER_ACCEPT", Label: "Qabul qilish", TargetType: "PARTNER", TargetID: partnerID},
				{Key: "PARTNER_REJECT", Label: "Bekor qilish", TargetType: "PARTNER", TargetID: partnerID},
			},
		})
}

func (s *Service) Accept(ctx context.Context, companyID, requestID, userID string) (map[string]any, error) {
	var status, ownerCompanyID string
	err := s.pool.QueryRow(ctx, `SELECT status, "ownerCompanyId" FROM "Partner" WHERE id = $1 AND "partnerCompanyId" = $2`, requestID, companyID).Scan(&status, &ownerCompanyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("Hamkorlik so'rovi topilmadi")
	}
	if err != nil {
		return nil, err
	}
	if status != "PENDING" {
		return nil, ErrNotPending
	}
	_, err = s.pool.Exec(ctx, `UPDATE "Partner" SET status = 'ACTIVE', "acceptedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, requestID)
	if err != nil {
		return nil, err
	}
	_ = userID
	s.notifyPartnerResponse(ctx, ownerCompanyID, requestID, true)
	return s.FindOne(ctx, companyID, requestID)
}

func (s *Service) Reject(ctx context.Context, companyID, requestID string) (map[string]any, error) {
	var ownerCompanyID string
	err := s.pool.QueryRow(ctx, `SELECT "ownerCompanyId" FROM "Partner" WHERE id = $1 AND "partnerCompanyId" = $2`, requestID, companyID).Scan(&ownerCompanyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("Hamkorlik so'rovi topilmadi")
	}
	if err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `UPDATE "Partner" SET status = 'REJECTED', "updatedAt" = NOW() WHERE id = $1`, requestID)
	if err != nil {
		return nil, err
	}
	s.notifyPartnerResponse(ctx, ownerCompanyID, requestID, false)
	return s.FindOne(ctx, companyID, requestID)
}

func (s *Service) notifyPartnerResponse(ctx context.Context, ownerCompanyID, requestID string, accepted bool) {
	if s.notify == nil || strings.TrimSpace(ownerCompanyID) == "" {
		return
	}
	if accepted {
		_ = s.notify.NotifyCompany(ctx, ownerCompanyID,
			"Hamkor so'rovi qabul qilindi",
			"Yuborgan hamkorlik so'rovingiz qabul qilindi.",
			"SUCCESS",
			&notifications.TelegramPayload{
				ModuleKey: "PARTNERS", EventKey: "partner.request_accepted",
				Details:   map[string]any{"partnerRequestId": requestID, "status": "ACTIVE"},
				TargetRoles: []string{"OWNER", "MANAGER"},
			}, "", 5*time.Minute)
		return
	}
	_ = s.notify.NotifyCompany(ctx, ownerCompanyID,
		"Hamkor so'rovi rad etildi",
		"Yuborgan hamkorlik so'rovingiz rad etildi.",
		"ERROR",
		&notifications.TelegramPayload{
			ModuleKey: "PARTNERS", EventKey: "partner.request_rejected",
			Details:   map[string]any{"partnerRequestId": requestID, "status": "REJECTED"},
			TargetRoles: []string{"OWNER", "MANAGER"},
		}, "", 5*time.Minute)
}

func (s *Service) Block(ctx context.Context, companyID, partnerID, userID string) (map[string]any, error) {
	p, err := s.FindOne(ctx, companyID, partnerID)
	if err != nil {
		return nil, err
	}
	ownerID := p["ownerCompanyId"].(string)
	partnerCompID := p["partnerCompanyId"].(string)
	_, err = s.pool.Exec(ctx, `
		UPDATE "Partner" SET status = 'BLOCKED', "updatedAt" = NOW()
		WHERE ("ownerCompanyId" = $1 AND "partnerCompanyId" = $2) OR ("ownerCompanyId" = $2 AND "partnerCompanyId" = $1)
	`, ownerID, partnerCompID)
	if err != nil {
		return nil, err
	}
	_ = userID
	return s.FindOne(ctx, companyID, partnerID)
}

func (s *Service) Remove(ctx context.Context, companyID, partnerID, userID string) error {
	if _, err := s.FindOne(ctx, companyID, partnerID); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM "Partner" WHERE id = $1`, partnerID)
	_ = userID
	return err
}

func (s *Service) UpdateWarehouseVisibility(ctx context.Context, companyID, partnerID string, warehouseIDs []string) (map[string]any, error) {
	if _, err := s.FindOne(ctx, companyID, partnerID); err != nil {
		return nil, err
	}
	cfg := map[string][]string{companyID: warehouseIDs}
	raw, _ := json.Marshal(cfg)
	_, err := s.pool.Exec(ctx, `UPDATE "Partner" SET "warehouseVisibilityConfig" = $1, "updatedAt" = NOW() WHERE id = $2`, raw, partnerID)
	if err != nil {
		return nil, err
	}
	return s.FindOne(ctx, companyID, partnerID)
}
