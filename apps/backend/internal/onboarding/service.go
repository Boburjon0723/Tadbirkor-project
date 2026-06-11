package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotFound      = errors.New("Kompaniya topilmadi")
	ErrTinTaken      = errors.New("Ushbu STIR (TIN) allaqachon boshqa kompaniya tomonidan ro'yxatdan o'tkazilgan")
	ErrLoginTaken    = errors.New("Login allaqachon mavjud")
	ErrPasswordShort = errors.New("Parol kamida 6 belgidan iborat bo'lishi kerak")
	ErrNoCompany     = errors.New("Kompaniya topilmadi. Chiqib qayta kiring (login).")
)

// Har bir kompaniya uchun minimal boshlang‘ich to‘plam (mahsulot + ombor asoslari).
var baseFeatureKeys = []string{"WAREHOUSE_BASIC", "STOCK_ADJUSTMENT"}

var defaultFeatureKeys = []string{
	"WAREHOUSE_BASIC", "STOCK_ADJUSTMENT", "B2B_ORDERS", "GOODS_RECEIPTS_MAIN", "DEBT_TRACKING",
}

type Service struct {
	pool  *pgxpool.Pool
	cache *cache.Cache
}

func NewService(pool *pgxpool.Pool, c *cache.Cache) *Service {
	return &Service{pool: pool, cache: c}
}

func (s *Service) invalidateSessionCaches(ctx context.Context, companyID, userID string) {
	if s.cache == nil {
		return
	}
	s.cache.Del(ctx, cache.CompanyFeaturesKey(companyID))
	s.cache.InvalidateAuthMe(ctx, userID, companyID)
}

func (s *Service) ResolveCompanyID(ctx context.Context, companyID, userID string) (string, error) {
	if strings.TrimSpace(companyID) != "" {
		return companyID, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		SELECT "companyId" FROM "CompanyUser" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1
	`, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoCompany
	}
	return id, err
}

func (s *Service) CreateCompany(ctx context.Context, userID string, input CreateCompanyInput) (map[string]any, error) {
	name := strings.TrimSpace(input.Name)
	tin := trimPtr(input.Tin)
	phone := trimPtr(input.Phone)
	address := trimPtr(input.Address)
	businessType := trimPtr(input.BusinessType)

	var membershipCompanyID string
	var currentTin *string
	err := s.pool.QueryRow(ctx, `
		SELECT cu."companyId", c.tin
		FROM "CompanyUser" cu
		JOIN "Company" c ON c.id = cu."companyId"
		WHERE cu."userId" = $1
		ORDER BY cu."createdAt" ASC
		LIMIT 1
	`, userID).Scan(&membershipCompanyID, &currentTin)

	if err == nil {
		if tin != nil && (currentTin == nil || *tin != *currentTin) {
			var existingID string
			err := s.pool.QueryRow(ctx, `SELECT id FROM "Company" WHERE tin = $1`, *tin).Scan(&existingID)
			if err == nil && existingID != membershipCompanyID {
				return nil, ErrTinTaken
			}
		}

		var whCount int
		_ = s.pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM "Warehouse" WHERE "companyId" = $1 AND status <> 'ARCHIVED'
		`, membershipCompanyID).Scan(&whCount)
		if whCount == 0 {
			addr := "Toshkent"
			if address != nil {
				addr = *address
			}
			_, _ = s.pool.Exec(ctx, `
				INSERT INTO "Warehouse" (id, "companyId", name, address, status, "createdAt", "updatedAt")
				VALUES ($1, $2, 'Asosiy Ombor', $3, 'ACTIVE', NOW(), NOW())
			`, uuid.NewString(), membershipCompanyID, addr)
		}

		sets := []string{`name = $1`, `"updatedAt" = NOW()`}
		args := []any{name}
		n := 2
		add := func(col string, val any) {
			sets = append(sets, `"`+col+`" = $`+strconv.Itoa(n))
			args = append(args, val)
			n++
		}
		add("tin", tin)
		add("phone", phone)
		add("address", address)
		if businessType != nil {
			add("businessType", *businessType)
		}
		args = append(args, membershipCompanyID)
		_, err := s.pool.Exec(ctx, `UPDATE "Company" SET `+strings.Join(sets, ", ")+` WHERE id = $`+strconv.Itoa(n), args...)
		if err != nil {
			return nil, err
		}
		return s.companyWithWarehouses(ctx, membershipCompanyID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	companyID := uuid.NewString()
	warehouseID := uuid.NewString()
	trialEnds := computeTrialEndsAt()
	addr := "Toshkent"
	if address != nil {
		addr = *address
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO "Company" (
			id, name, tin, phone, address, "businessType", status,
			"trialEndsAt", "subscriptionStatus", "trialStartedAt", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, 'onboarding', $7, 'TRIAL', NOW(), NOW(), NOW())
	`, companyID, name, tin, phone, address, businessType, trialEnds)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "CompanyUser" (id, "companyId", "userId", role, "createdAt")
		VALUES ($1, $2, $3, 'OWNER', NOW())
	`, uuid.NewString(), companyID, userID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "Warehouse" (id, "companyId", name, address, status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'Asosiy Ombor', $3, 'ACTIVE', NOW(), NOW())
	`, warehouseID, companyID, addr)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.companyWithWarehouses(ctx, companyID)
}

func (s *Service) UpdateCompanyProfile(ctx context.Context, companyID, userID string, input UpdateCompanyInput) (map[string]any, error) {
	resolved, err := s.ResolveCompanyID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	var exists string
	err = s.pool.QueryRow(ctx, `
		SELECT id FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2
	`, resolved, userID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if input.BusinessType == nil {
		return s.companyWithWarehouses(ctx, resolved)
	}
	bt := strings.TrimSpace(*input.BusinessType)
	_, err = s.pool.Exec(ctx, `UPDATE "Company" SET "businessType" = $1, "updatedAt" = NOW() WHERE id = $2`, bt, resolved)
	if err != nil {
		return nil, err
	}
	return s.companyWithWarehouses(ctx, resolved)
}

func (s *Service) GetStatus(ctx context.Context, companyID, userID string) (*StatusResponse, error) {
	resolved, err := s.ResolveCompanyID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}

	var tin, businessType, status *string
	err = s.pool.QueryRow(ctx, `
		SELECT tin, "businessType", status FROM "Company" WHERE id = $1
	`, resolved).Scan(&tin, &businessType, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var featureCount, warehouseCount int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyFeature" WHERE "companyId" = $1`, resolved).Scan(&featureCount)
	_ = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "Warehouse" WHERE "companyId" = $1 AND status <> 'ARCHIVED'
	`, resolved).Scan(&warehouseCount)

	var role string
	err = s.pool.QueryRow(ctx, `
		SELECT role FROM "CompanyUser" WHERE "companyId" = $1 AND "userId" = $2
	`, resolved, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		role = "OWNER"
	} else if err != nil {
		return nil, err
	}
	role = strings.ToUpper(role)

	core := computeStatusFields(strVal(tin), strVal(businessType), strVal(status), featureCount, role)
	return &StatusResponse{
		IsCompleted:        core.isCompleted,
		RequiresOnboarding: core.requiresOnboarding,
		NextPath:           core.nextPath,
		HasTin:             core.hasTin,
		HasBusinessType:    core.hasBusinessType,
		HasModules:         core.hasModules,
		HasWarehouse:       warehouseCount > 0,
		Role:               role,
	}, nil
}

type statusFields struct {
	isCompleted, requiresOnboarding, hasTin, hasBusinessType, hasModules bool
	nextPath                                                           string
}

func computeStatusFields(tin, businessType, companyStatus string, featureCount int, role string) statusFields {
	tinDigits := regexp.MustCompile(`\D`).ReplaceAllString(tin, "")
	hasTin := len(tinDigits) == 9
	hasBusinessType := strings.TrimSpace(businessType) != ""
	hasModules := featureCount > 0
	isCompleted := strings.EqualFold(companyStatus, "active") && hasTin && hasBusinessType

	nextPath := "/onboarding/company"
	switch {
	case !hasTin:
		nextPath = "/onboarding/company"
	case !hasBusinessType:
		nextPath = "/onboarding/business-type"
	case !hasModules:
		nextPath = "/onboarding/questions"
	case !isCompleted:
		nextPath = "/onboarding/modules"
	default:
		nextPath = "/dashboard"
	}

	return statusFields{
		isCompleted:        isCompleted,
		requiresOnboarding: role == "OWNER" && !isCompleted,
		nextPath:           nextPath,
		hasTin:             hasTin,
		hasBusinessType:    hasBusinessType,
		hasModules:         hasModules,
	}
}

func (s *Service) ApplyModules(ctx context.Context, companyID, userID string, input SubmitBusinessAnswersInput) (*ApplyModulesResult, error) {
	resolved, err := s.ResolveCompanyID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}
	answers := input.Answers
	if answers == nil {
		answers = map[string]string{}
	}

	var businessType string
	_ = s.pool.QueryRow(ctx, `SELECT COALESCE("businessType", '') FROM "Company" WHERE id = $1`, resolved).Scan(&businessType)

	hasWarehouse := isWarehouseAnswer(answers["hasWarehouse"]) || isWarehouseAnswer(answers["q1"])
	hasPartners := isPartnersAnswer(answers["hasPartners"]) || isPartnersAnswer(answers["q2"])
	hasDebt := isDebtAnswer(answers["hasDebt"]) || isDebtAnswer(answers["q3"])
	needsEmployees := isEmployeesAnswer(answers["q5"]) || isEmployeesAnswer(answers["needsEmployees"])
	needsPos := isPosAnswer(answers["q6"]) || isPosAnswer(answers["needsPos"])

	applyBusinessTypeHints(businessType, answers, &hasWarehouse, &hasPartners, &hasDebt)

	enabledKeys := append([]string{}, baseFeatureKeys...)
	if hasPartners {
		enabledKeys = append(enabledKeys,
			"B2B_ORDERS", "GOODS_RECEIPTS_MAIN", "PARTIAL_RECEIPT",
			"PRODUCT_MAPPING", "PARTNER_NETWORK",
		)
	}
	if hasDebt {
		enabledKeys = append(enabledKeys, "DEBT_TRACKING", "PAYMENT_RECORDS")
	}
	if needsEmployees {
		enabledKeys = append(enabledKeys, "TEAM_MANAGEMENT")
	}
	if needsPos {
		enabledKeys = append(enabledKeys, "POS_TERMINAL")
	}
	_ = hasWarehouse // ombor «yo‘q» bo‘lsa ham mahsulot/qoldiq bazasi qoladi

	features, err := s.loadFeatures(ctx)
	if err != nil {
		return nil, err
	}

	toEnable := filterFeaturesByKeys(features, enabledKeys)
	if len(toEnable) > 0 {
		if err := s.insertCompanyFeatures(ctx, resolved, toEnable); err != nil {
			return nil, err
		}
	} else {
		if err := s.ensureDefaultCompanyFeatures(ctx, resolved); err != nil {
			return nil, err
		}
	}

	moduleKeys := uniqueStrings(extractModuleKeys(toEnable))
	s.invalidateSessionCaches(ctx, resolved, userID)
	return &ApplyModulesResult{Success: true, EnabledModules: moduleKeys}, nil
}

func (s *Service) AddTeamMember(ctx context.Context, companyID, userID string, input AddTeamMemberInput) (*TeamMemberResponse, error) {
	resolved, err := s.ResolveCompanyID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}

	var existing string
	err = s.pool.QueryRow(ctx, `SELECT id FROM "User" WHERE login = $1`, strings.TrimSpace(input.Login)).Scan(&existing)
	if err == nil {
		return nil, ErrLoginTaken
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	password := strings.TrimSpace(input.Password)
	if len(password) < 6 {
		return nil, ErrPasswordShort
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return nil, err
	}

	newUserID := uuid.NewString()
	var resp TeamMemberResponse
	err = s.pool.QueryRow(ctx, `
		WITH u AS (
			INSERT INTO "User" (id, "fullName", login, "passwordHash", status, "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
			RETURNING id, "fullName", login, email, phone
		)
		INSERT INTO "CompanyUser" (id, "companyId", "userId", role, "createdAt")
		SELECT gen_random_uuid()::text, $5, u.id, $6, NOW() FROM u
		RETURNING (SELECT id FROM u), (SELECT "fullName" FROM u), (SELECT login FROM u),
		          (SELECT email FROM u), (SELECT phone FROM u)
	`, newUserID, strings.TrimSpace(input.FullName), strings.TrimSpace(input.Login), string(hash), resolved, strings.TrimSpace(input.Role)).Scan(
		&resp.ID, &resp.FullName, &resp.Login, &resp.Email, &resp.Phone,
	)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s *Service) CompleteOnboarding(ctx context.Context, companyID, userID string) (map[string]any, error) {
	resolved, err := s.ResolveCompanyID(ctx, companyID, userID)
	if err != nil {
		return nil, err
	}

	if err := s.ensureDefaultCompanyFeatures(ctx, resolved); err != nil {
		return nil, err
	}

	var address *string
	err = s.pool.QueryRow(ctx, `
		UPDATE "Company" SET status = 'active', "updatedAt" = NOW() WHERE id = $1 RETURNING address
	`, resolved).Scan(&address)
	if err != nil {
		return nil, err
	}

	var whCount int
	_ = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "Warehouse" WHERE "companyId" = $1 AND status <> 'ARCHIVED'
	`, resolved).Scan(&whCount)
	if whCount == 0 {
		addr := "Toshkent"
		if address != nil && strings.TrimSpace(*address) != "" {
			addr = *address
		}
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO "Warehouse" (id, "companyId", name, address, status, "createdAt", "updatedAt")
			VALUES ($1, $2, 'Asosiy Ombor', $3, 'ACTIVE', NOW(), NOW())
		`, uuid.NewString(), resolved, addr)
	}

	s.invalidateSessionCaches(ctx, resolved, userID)
	return s.companyWithWarehouses(ctx, resolved)
}

type featureRow struct {
	id, key, moduleKey string
}

func (s *Service) loadFeatures(ctx context.Context) ([]featureRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT f.id, f.key, COALESCE(m.key, '')
		FROM "Feature" f
		LEFT JOIN "Module" m ON m.id = f."moduleId"
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []featureRow{}
	for rows.Next() {
		var f featureRow
		if err := rows.Scan(&f.id, &f.key, &f.moduleKey); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func filterFeaturesByKeys(features []featureRow, keys []string) []featureRow {
	set := map[string]struct{}{}
	for _, k := range keys {
		set[strings.ToUpper(k)] = struct{}{}
	}
	out := []featureRow{}
	for _, f := range features {
		if _, ok := set[strings.ToUpper(f.key)]; ok {
			out = append(out, f)
		}
	}
	return out
}

func extractModuleKeys(features []featureRow) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, f := range features {
		if f.moduleKey == "" {
			continue
		}
		if _, ok := seen[f.moduleKey]; ok {
			continue
		}
		seen[f.moduleKey] = struct{}{}
		out = append(out, f.moduleKey)
	}
	return out
}

func (s *Service) insertCompanyFeatures(ctx context.Context, companyID string, features []featureRow) error {
	if len(features) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, f := range features {
		batch.Queue(`
			INSERT INTO "CompanyFeature" (id, "companyId", "featureId", enabled, "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, true, NOW(), NOW())
			ON CONFLICT ("companyId", "featureId") DO NOTHING
		`, companyID, f.id)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range features {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return br.Close()
}

func (s *Service) ensureDefaultCompanyFeatures(ctx context.Context, companyID string) error {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "CompanyFeature" WHERE "companyId" = $1`, companyID).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	features, err := s.loadFeatures(ctx)
	if err != nil {
		return err
	}
	toEnable := filterFeaturesByKeys(features, defaultFeatureKeys)
	return s.insertCompanyFeatures(ctx, companyID, toEnable)
}

func (s *Service) companyWithWarehouses(ctx context.Context, companyID string) (map[string]any, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `
		SELECT row_to_json(t) FROM (
			SELECT c.*,
				COALESCE((
					SELECT json_agg(w ORDER BY w."createdAt")
					FROM "Warehouse" w WHERE w."companyId" = c.id
				), '[]'::json) AS warehouses
			FROM "Company" c WHERE c.id = $1
		) t
	`, companyID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if json.Unmarshal(raw, &out) != nil {
		return nil, err
	}
	return out, nil
}

func isWarehouseAnswer(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yes", "many", "one", "true":
		return true
	default:
		return false
	}
}

func isPartnersAnswer(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "always", "sometimes", "yes", "true":
		return true
	default:
		return false
	}
}

func isDebtAnswer(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yes", "sometimes", "true":
		return true
	default:
		return false
	}
}

func isEmployeesAnswer(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "now", "later":
		return true
	default:
		return false
	}
}

func isPosAnswer(value string) bool {
	return strings.ToLower(strings.TrimSpace(value)) == "yes"
}

// Biznes turiga qarab savollarga qo‘shimcha yo‘naltirish (foydalanuvchi aniq «yo‘q» demagan bo‘lsa).
func applyBusinessTypeHints(businessType string, answers map[string]string, hasWarehouse, hasPartners, hasDebt *bool) {
	bt := strings.ToLower(strings.TrimSpace(businessType))
	if bt == "" {
		return
	}
	if !*hasWarehouse && answers["hasWarehouse"] != "no" {
		if strings.Contains(bt, "ombor") || strings.Contains(bt, "distribyutor") || strings.Contains(bt, "ishlab chiqarish") || strings.Contains(bt, "chakana") {
			*hasWarehouse = true
		}
	}
	if !*hasPartners && answers["hasPartners"] != "no" {
		if strings.Contains(bt, "ulgurji") || strings.Contains(bt, "ombor") || strings.Contains(bt, "aralash") {
			*hasPartners = true
		}
	}
	if !*hasDebt && answers["hasDebt"] != "no" {
		if strings.Contains(bt, "xizmat") || strings.Contains(bt, "ulgurji") {
			*hasDebt = true
		}
	}
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func uniqueStrings(in []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func trialDays() int {
	n, err := strconv.Atoi(strings.TrimSpace(os.Getenv("TRIAL_DAYS")))
	if err != nil || n <= 0 {
		return 7
	}
	if n > 365 {
		return 365
	}
	return n
}

func computeTrialEndsAt() time.Time {
	return time.Now().AddDate(0, 0, trialDays())
}
