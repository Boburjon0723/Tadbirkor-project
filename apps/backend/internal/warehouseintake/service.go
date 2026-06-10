package warehouseintake

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	pkgrealtime "github.com/tadbirkor/axis-erp/backend/pkg/realtime"
	"github.com/tadbirkor/axis-erp/backend/pkg/scope"
)

type Service struct {
	pool      *pgxpool.Pool
	repo      *Repository
	companies *companies.Service
	hub       pkgrealtime.Hub
}

func NewService(pool *pgxpool.Pool, repo *Repository, companiesSvc *companies.Service, hub pkgrealtime.Hub) *Service {
	if hub == nil {
		hub = pkgrealtime.Noop
	}
	return &Service{
		pool:      pool,
		repo:      repo,
		companies: companiesSvc,
		hub:       hub,
	}
}

type badRequestError struct{ msg string }

func (e badRequestError) Error() string { return e.msg }
func errBadRequest(msg string) error    { return badRequestError{msg: msg} }

type intakeSettings struct {
	ScanMode          string `json:"scanMode"`
	AllowBulkQty      bool   `json:"allowBulkQty"`
	AllowQuickProduct bool   `json:"allowQuickProduct"`
	MaxQtyPerScan     *int   `json:"maxQtyPerScan"`
}

func defaultIntakeSettings() intakeSettings {
	return intakeSettings{
		ScanMode:          "SINGLE_SCAN_QTY",
		AllowBulkQty:      true,
		AllowQuickProduct: false,
		MaxQtyPerScan:     nil,
	}
}

func normalizeIntakeSettings(raw map[string]any) intakeSettings {
	def := defaultIntakeSettings()
	if raw == nil {
		return def
	}
	mode := strings.ToUpper(strings.TrimSpace(asString(raw["scanMode"])))
	if mode == "EACH_SCAN_ONE" {
		def.ScanMode = "EACH_SCAN_ONE"
	}
	if v, ok := raw["allowBulkQty"]; ok {
		def.AllowBulkQty = asBool(v)
	}
	if v, ok := raw["allowQuickProduct"]; ok {
		def.AllowQuickProduct = asBool(v)
	}
	if v, ok := raw["maxQtyPerScan"]; ok {
		def.MaxQtyPerScan = parseMaxQty(v)
	}
	return def
}

func parseMaxQty(v any) *int {
	switch t := v.(type) {
	case nil:
		return nil
	case int:
		if t < 1 {
			return nil
		}
		n := t
		return &n
	case int64:
		if t < 1 {
			return nil
		}
		n := int(t)
		return &n
	case float64:
		if !isFinite(t) || t < 1 {
			return nil
		}
		n := int(math.Floor(t))
		return &n
	case string:
		s := strings.TrimSpace(t)
		if s == "" {
			return nil
		}
		var parsed float64
		if _, err := fmt.Sscan(s, &parsed); err != nil || !isFinite(parsed) || parsed < 1 {
			return nil
		}
		n := int(math.Floor(parsed))
		return &n
	default:
		return nil
	}
}

func parseJSONMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return nil
	}
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

func resolveIntakeSettings(companyRaw, warehouseRaw []byte) intakeSettings {
	company := normalizeIntakeSettings(parseJSONMap(companyRaw))
	if len(warehouseRaw) == 0 {
		return company
	}
	cfg := parseJSONMap(warehouseRaw)
	override, _ := cfg["intakeSettings"].(map[string]any)
	if override == nil {
		override, _ = cfg["intake"].(map[string]any)
	}
	if override == nil {
		return company
	}
	merged := map[string]any{
		"scanMode":          company.ScanMode,
		"allowBulkQty":      company.AllowBulkQty,
		"allowQuickProduct": company.AllowQuickProduct,
		"maxQtyPerScan":     company.MaxQtyPerScan,
	}
	for k, v := range override {
		merged[k] = v
	}
	return normalizeIntakeSettings(merged)
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func asBool(v any) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}

func settingsToMap(s intakeSettings) map[string]any {
	return map[string]any{
		"scanMode":          s.ScanMode,
		"allowBulkQty":      s.AllowBulkQty,
		"allowQuickProduct": s.AllowQuickProduct,
		"maxQtyPerScan":     s.MaxQtyPerScan,
	}
}

func normalizeOptional(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func parseStatus(status *string) (*string, error) {
	if status == nil {
		return nil, nil
	}
	v := strings.ToUpper(strings.TrimSpace(*status))
	if v == "" {
		return nil, nil
	}
	switch v {
	case "DRAFT", "COMPLETED", "CANCELLED":
		return &v, nil
	default:
		return nil, errBadRequest("status: DRAFT, COMPLETED yoki CANCELLED")
	}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *Service) assertFeature(ctx context.Context, companyID string) error {
	if s.companies == nil {
		return nil
	}
	if err := s.companies.AssertFeatureEnabled(ctx, companyID, "WAREHOUSE_INTAKE"); err != nil {
		return errBadRequest(err.Error())
	}
	return nil
}

func (s *Service) assertWarehouseScope(ctx context.Context, companyID, userID, warehouseID string) error {
	whScope, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return err
	}
	if whScope.All {
		return nil
	}
	if len(whScope.WarehouseIDs) == 0 {
		return scope.ErrNoWarehouseAssigned
	}
	if !whScope.Allowed(warehouseID) {
		return scope.ErrWarehouseForbidden
	}
	return nil
}

func (s *Service) loadSettings(ctx context.Context, companyID string, warehouse *WarehouseRef) (intakeSettings, error) {
	companyRaw, err := s.repo.LoadCompanyIntakeSettingsRaw(ctx, companyID)
	if err != nil {
		return intakeSettings{}, err
	}
	var warehouseRaw []byte
	if warehouse != nil {
		warehouseRaw = warehouse.FieldConfig
	}
	return resolveIntakeSettings(companyRaw, warehouseRaw), nil
}

func (s *Service) applyQtyRules(settings intakeSettings, context string, quantity float64, scanIncrement int) (float64, error) {
	if !isFinite(quantity) || quantity <= 0 {
		return 0, errBadRequest("Miqdor noto'g'ri")
	}
	if settings.ScanMode == "EACH_SCAN_ONE" {
		switch context {
		case "UPDATE":
			return 0, errBadRequest("Qattiq rejim: miqdorni qo'lda o'zgartirish mumkin emas. Har donani skanerlang yoki qatorni o'chiring.")
		case "MANUAL":
			return 0, errBadRequest("Qattiq rejim: qo'lda qator qo'shish o'chirilgan. Faqat skaner ishlating.")
		case "SCAN":
			if scanIncrement != 1 || quantity != 1 {
				return 0, errBadRequest("Qattiq rejim: har skaner faqat 1 dona qo'shadi")
			}
			return 1, nil
		}
	}
	if context == "SCAN" && !settings.AllowBulkQty && quantity != 1 {
		return 0, errBadRequest("Sozlamalar: bir skanerda faqat 1 dona. Ko'proq miqdor uchun har donani skanerlang.")
	}
	if context == "MANUAL" && !settings.AllowBulkQty {
		return 0, errBadRequest("Sozlamalar: qo'lda miqdor kiritish o'chirilgan. Skaner ishlating.")
	}
	if settings.MaxQtyPerScan != nil && quantity > float64(*settings.MaxQtyPerScan) {
		if context == "UPDATE" {
			return 0, errBadRequest(fmt.Sprintf("Qator miqdori maksimum %d dan oshmasligi kerak.", *settings.MaxQtyPerScan))
		}
		return 0, errBadRequest(fmt.Sprintf("Bir amalda maksimum %d dona (sozlama limiti).", *settings.MaxQtyPerScan))
	}
	return quantity, nil
}

func isFinite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func (s *Service) applyLineTotalRules(settings intakeSettings, existingQty, addQty float64) error {
	if settings.MaxQtyPerScan == nil {
		return nil
	}
	if existingQty+addQty > float64(*settings.MaxQtyPerScan) {
		return errBadRequest(fmt.Sprintf(
			"Qator jami miqdori %d dan oshmasligi kerak (hozir %.4f, qo'shilmoqda %.4f).",
			*settings.MaxQtyPerScan, existingQty, addQty,
		))
	}
	return nil
}

func variantToMap(v VariantLite) map[string]any {
	return map[string]any{
		"id":      v.ID,
		"name":    v.Name,
		"sku":     v.SKU,
		"barcode": v.Barcode,
		"product": map[string]any{
			"id":       v.ProductID,
			"name":     v.ProductName,
			"unit":     v.ProductUnit,
			"imageUrl": v.ProductImage,
		},
	}
}

func intakeToMap(rec *IntakeRecord, settings *intakeSettings) map[string]any {
	lines := make([]map[string]any, 0, len(rec.Lines))
	for i := range rec.Lines {
		line := rec.Lines[i]
		lines = append(lines, map[string]any{
			"id":               line.ID,
			"intakeId":         line.IntakeID,
			"productVariantId": line.ProductVariantID,
			"quantity":         line.Quantity,
			"scanCount":        line.ScanCount,
			"scannedBarcode":   line.ScannedBarcode,
			"entryMode":        line.EntryMode,
			"createdAt":        line.CreatedAt,
			"updatedAt":        line.UpdatedAt,
			"productVariant":   variantToMap(line.Variant),
		})
	}
	out := map[string]any{
		"id":                     rec.ID,
		"companyId":              rec.CompanyID,
		"warehouseId":            rec.WarehouseID,
		"reference":              rec.Reference,
		"status":                 rec.Status,
		"note":                   rec.Note,
		"partnerLedgerContactId": rec.PartnerLedgerContactID,
		"createdBy":              rec.CreatedBy,
		"completedBy":            rec.CompletedBy,
		"completedAt":            rec.CompletedAt,
		"createdAt":              rec.CreatedAt,
		"updatedAt":              rec.UpdatedAt,
		"warehouse": map[string]any{
			"id":   rec.WarehouseID,
			"name": rec.WarehouseName,
		},
		"lines": lines,
	}
	if settings != nil {
		out["intakeSettings"] = settingsToMap(*settings)
	}
	return out
}

func listItemToMap(rec IntakeListRecord) map[string]any {
	return map[string]any{
		"id":          rec.ID,
		"warehouseId": rec.WarehouseID,
		"reference":   rec.Reference,
		"status":      rec.Status,
		"note":        rec.Note,
		"createdAt":   rec.CreatedAt,
		"updatedAt":   rec.UpdatedAt,
		"completedAt": rec.CompletedAt,
		"warehouse": map[string]any{
			"id":   rec.WarehouseID,
			"name": rec.WarehouseName,
		},
		"_count": map[string]any{"lines": rec.LinesCount},
	}
}

func (s *Service) tryResolveVariantByBarcode(ctx context.Context, companyID, code string) (*VariantLite, error) {
	exact, err := s.repo.FindVariantsExactByCode(ctx, companyID, code, 5)
	if err != nil {
		return nil, err
	}
	if len(exact) == 1 {
		return &exact[0], nil
	}
	if len(exact) > 1 {
		return nil, errBadRequest("Bir nechta variant topildi - qo'lda tanlang")
	}

	fuzzy, err := s.repo.FindVariantsFuzzyByCode(ctx, companyID, code, 5)
	if err != nil {
		return nil, err
	}
	if len(fuzzy) == 1 {
		return &fuzzy[0], nil
	}
	if len(fuzzy) > 1 {
		return nil, errBadRequest("Bir nechta variant topildi - qo'lda tanlang")
	}
	return nil, nil
}

func (s *Service) LookupBarcode(ctx context.Context, companyID, userID, barcode string, warehouseID *string) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	code := strings.TrimSpace(barcode)
	if code == "" {
		return nil, errBadRequest("Barcode kiriting")
	}

	whScope, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return nil, err
	}
	requested := ""
	if warehouseID != nil {
		requested = strings.TrimSpace(*warehouseID)
	}
	if requested == "" && !whScope.All && len(whScope.WarehouseIDs) == 1 {
		requested = whScope.WarehouseIDs[0]
	}
	var warehouse *WarehouseRef
	if requested != "" {
		if err := s.assertWarehouseScope(ctx, companyID, userID, requested); err != nil {
			return nil, err
		}
		warehouse, err = s.repo.LoadWarehouse(ctx, companyID, requested)
		if err != nil {
			return nil, err
		}
	} else if !whScope.All {
		return nil, errBadRequest("warehouseId majburiy")
	}

	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	variant, err := s.tryResolveVariantByBarcode(ctx, companyID, code)
	if err != nil {
		return nil, err
	}
	if variant == nil {
		return map[string]any{
			"found":             false,
			"barcode":           code,
			"allowQuickProduct": settings.AllowQuickProduct,
			"intakeSettings":    settingsToMap(settings),
		}, nil
	}
	return map[string]any{
		"found":            true,
		"productVariantId": variant.ID,
		"name":             variant.Name,
		"sku":              variant.SKU,
		"barcode":          variant.Barcode,
		"product": map[string]any{
			"id":       variant.ProductID,
			"name":     variant.ProductName,
			"unit":     variant.ProductUnit,
			"imageUrl": variant.ProductImage,
		},
		"intakeSettings": settingsToMap(settings),
	}, nil
}

func (s *Service) Create(ctx context.Context, companyID, userID string, input CreateWarehouseIntakeInput) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID := strings.TrimSpace(input.WarehouseID)
	if warehouseID == "" {
		return nil, errBadRequest("warehouseId majburiy")
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	if _, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID); err != nil {
		return nil, err
	}

	contactID := normalizeOptional(input.PartnerLedgerContactID)
	if contactID != nil {
		ok, err := s.repo.PartnerLedgerContactExists(ctx, companyID, *contactID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, errBadRequest("Hamkor daftari kontakti topilmadi")
		}
	}
	note := normalizeOptional(input.Note)

	for attempt := 0; attempt < 5; attempt++ {
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		reference, err := s.repo.GenerateReferenceTx(ctx, tx, companyID, time.Now())
		if err != nil {
			_ = tx.Rollback(ctx)
			return nil, err
		}
		id, err := s.repo.CreateIntakeTx(ctx, tx, companyID, warehouseID, reference, userID, note, contactID)
		if err != nil {
			_ = tx.Rollback(ctx)
			if isUniqueViolation(err) && attempt < 4 {
				continue
			}
			return nil, err
		}
		rec, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, false)
		if err != nil {
			_ = tx.Rollback(ctx)
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return intakeToMap(rec, nil), nil
	}
	return nil, errBadRequest("Kirim raqami yaratib bo'lmadi, qayta urinib ko'ring")
}

func (s *Service) List(ctx context.Context, companyID, userID string, status, warehouseID *string) ([]map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	parsedStatus, err := parseStatus(status)
	if err != nil {
		return nil, err
	}
	var requestedWarehouse *string
	if warehouseID != nil && strings.TrimSpace(*warehouseID) != "" {
		wid := strings.TrimSpace(*warehouseID)
		if err := s.assertWarehouseScope(ctx, companyID, userID, wid); err != nil {
			return nil, err
		}
		requestedWarehouse = &wid
	}
	whScope, err := scope.ForUser(ctx, s.pool, companyID, userID)
	if err != nil {
		return nil, err
	}
	enforce := !whScope.All
	rows, err := s.repo.ListIntakes(ctx, companyID, parsedStatus, requestedWarehouse, enforce, whScope.WarehouseIDs)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(rows))
	for i := range rows {
		out = append(out, listItemToMap(rows[i]))
	}
	return out, nil
}

func (s *Service) FindOne(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	rec, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, rec.WarehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, rec.WarehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	return intakeToMap(rec, &settings), nil
}

func (s *Service) AddLine(ctx context.Context, id, companyID, userID string, input AddIntakeLineInput) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID, intakeStatus, err := s.repo.LoadIntakeMeta(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if intakeStatus != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	qty, err := s.applyQtyRules(settings, "MANUAL", input.Quantity, 0)
	if err != nil {
		return nil, err
	}
	variantID := strings.TrimSpace(input.ProductVariantID)
	if _, err := s.repo.LoadVariantByID(ctx, companyID, variantID); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := s.repo.AssertDraftTx(ctx, tx, id, companyID); err != nil {
		return nil, err
	}
	existing, err := s.repo.FindLineByIntakeVariantTx(ctx, tx, id, variantID)
	if err != nil {
		return nil, err
	}
	existingQty := 0.0
	if existing != nil {
		existingQty = existing.Quantity
	}
	if err := s.applyLineTotalRules(settings, existingQty, qty); err != nil {
		return nil, err
	}
	if err := s.repo.UpsertLineTx(ctx, tx, id, variantID, qty, "MANUAL", nil, 0); err != nil {
		return nil, err
	}
	rec, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return intakeToMap(rec, &settings), nil
}

func (s *Service) ScanLine(ctx context.Context, id, companyID, userID string, input ScanIntakeLineInput) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID, intakeStatus, err := s.repo.LoadIntakeMeta(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if intakeStatus != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}

	barcode := strings.TrimSpace(input.Barcode)
	if barcode == "" {
		return nil, errBadRequest("Barcode kiriting")
	}
	rawQty := 1.0
	if input.Quantity != nil {
		rawQty = *input.Quantity
	}
	qty, err := s.applyQtyRules(settings, "SCAN", rawQty, 1)
	if err != nil {
		return nil, err
	}
	variants, err := s.repo.FindVariantsExactByCode(ctx, companyID, barcode, 2)
	if err != nil {
		return nil, err
	}
	if len(variants) > 1 {
		return nil, errBadRequest("Bir nechta variant topildi - qo'lda tanlang")
	}
	if len(variants) == 0 {
		if settings.AllowQuickProduct {
			return nil, fmt.Errorf("%w: Mahsulot topilmadi: %s. Tez qo'shish uchun quick-product endpointidan foydalaning.", ErrVariantNotFound, barcode)
		}
		return nil, fmt.Errorf("%w: Mahsulot topilmadi: %s", ErrVariantNotFound, barcode)
	}
	variantID := variants[0].ID

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := s.repo.AssertDraftTx(ctx, tx, id, companyID); err != nil {
		return nil, err
	}
	existing, err := s.repo.FindLineByIntakeVariantTx(ctx, tx, id, variantID)
	if err != nil {
		return nil, err
	}
	existingQty := 0.0
	if existing != nil {
		existingQty = existing.Quantity
	}
	if err := s.applyLineTotalRules(settings, existingQty, qty); err != nil {
		return nil, err
	}
	barcodeRef := barcode
	if err := s.repo.UpsertLineTx(ctx, tx, id, variantID, qty, "SCAN", &barcodeRef, 1); err != nil {
		return nil, err
	}
	rec, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return intakeToMap(rec, &settings), nil
}

func (s *Service) QuickProduct(ctx context.Context, id, companyID, userID string, input QuickIntakeProductInput) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID, intakeStatus, err := s.repo.LoadIntakeMeta(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if intakeStatus != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	if !settings.AllowQuickProduct {
		return nil, errBadRequest("Tez mahsulot qo'shish ushbu kompaniyada o'chirilgan")
	}
	barcode := strings.TrimSpace(input.Barcode)
	name := strings.TrimSpace(input.Name)
	if barcode == "" || name == "" {
		return nil, errBadRequest("Barcode va nom majburiy")
	}
	if len(name) < 2 {
		return nil, errBadRequest("Mahsulot nomi kamida 2 belgi bo'lishi kerak")
	}
	exists, err := s.repo.BarcodeOrSKUExists(ctx, companyID, barcode)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errBadRequest("Bunday barcode allaqachon katalogda mavjud")
	}
	rawQty := 1.0
	if input.Quantity != nil {
		rawQty = *input.Quantity
	}
	qty, err := s.applyQtyRules(settings, "SCAN", rawQty, 1)
	if err != nil {
		return nil, err
	}
	unit := "dona"
	if input.Unit != nil && strings.TrimSpace(*input.Unit) != "" {
		unit = strings.TrimSpace(*input.Unit)
	}
	salePrice := 0.0
	if input.SalePrice != nil {
		salePrice = *input.SalePrice
	}
	var purchasePrice *float64
	if input.PurchasePrice != nil {
		v := *input.PurchasePrice
		purchasePrice = &v
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := s.repo.AssertDraftTx(ctx, tx, id, companyID); err != nil {
		return nil, err
	}
	dup, err := s.repo.BarcodeExistsTx(ctx, tx, companyID, barcode)
	if err != nil {
		return nil, err
	}
	if dup {
		return nil, errBadRequest("Bunday barcode allaqachon mavjud")
	}
	categoryID, err := s.repo.ResolveQuickCategoryTx(ctx, tx, companyID, input.CategoryID)
	if err != nil {
		return nil, err
	}
	productID, variantID, err := s.repo.CreateQuickProductTx(
		ctx, tx, companyID, userID, name, unit, barcode, categoryID, salePrice, purchasePrice,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errBadRequest("Bunday barcode allaqachon mavjud")
		}
		return nil, err
	}
	if err := s.repo.InsertAuditLogTx(ctx, tx, companyID, userID, "warehouse_intake.quick_product", "PRODUCT_VARIANT", variantID, map[string]any{
		"intakeId":  id,
		"barcode":   barcode,
		"name":      name,
		"productId": productID,
	}); err != nil {
		return nil, err
	}
	existing, err := s.repo.FindLineByIntakeVariantTx(ctx, tx, id, variantID)
	if err != nil {
		return nil, err
	}
	existingQty := 0.0
	if existing != nil {
		existingQty = existing.Quantity
	}
	if err := s.applyLineTotalRules(settings, existingQty, qty); err != nil {
		return nil, err
	}
	barcodeRef := barcode
	if err := s.repo.UpsertLineTx(ctx, tx, id, variantID, qty, "SCAN", &barcodeRef, 1); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.FindOne(ctx, id, companyID, userID)
}

func (s *Service) UpdateLine(ctx context.Context, id, lineID, companyID, userID string, input UpdateIntakeLineInput) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID, intakeStatus, err := s.repo.LoadIntakeMeta(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if intakeStatus != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	qty, err := s.applyQtyRules(settings, "UPDATE", input.Quantity, 0)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindLine(ctx, companyID, id, lineID); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateLineQuantity(ctx, lineID, qty); err != nil {
		return nil, err
	}
	rec, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	return intakeToMap(rec, &settings), nil
}

func (s *Service) RemoveLine(ctx context.Context, id, lineID, companyID, userID string) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	warehouseID, intakeStatus, err := s.repo.LoadIntakeMeta(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if intakeStatus != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, warehouseID); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, warehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindLine(ctx, companyID, id, lineID); err != nil {
		return nil, err
	}
	if err := s.repo.DeleteLine(ctx, lineID); err != nil {
		return nil, err
	}
	rec, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	return intakeToMap(rec, &settings), nil
}

func (s *Service) Complete(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	preview, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if preview.Status != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, preview.WarehouseID); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	intake, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, true)
	if err != nil {
		return nil, err
	}
	if intake.Status != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if len(intake.Lines) == 0 {
		return nil, errBadRequest("Kamida bitta mahsulot qatori kerak")
	}
	movementNote := intake.Reference
	if intake.Note != nil && strings.TrimSpace(*intake.Note) != "" {
		movementNote = intake.Reference + " - " + strings.TrimSpace(*intake.Note)
	}

	lines := make([]stock.Line, 0, len(intake.Lines))
	for i := range intake.Lines {
		lines = append(lines, stock.Line{
			WarehouseID:      intake.WarehouseID,
			ProductVariantID: intake.Lines[i].ProductVariantID,
			Quantity:         intake.Lines[i].Quantity,
			SourceID:         intake.ID,
			Note:             movementNote,
		})
	}
	if err := stock.RecordMovements(ctx, tx, companyID, userID, "IN", "WAREHOUSE_INTAKE", lines); err != nil {
		if errors.Is(err, stock.ErrInsufficientStock) {
			return nil, errBadRequest(err.Error())
		}
		return nil, err
	}
	if intake.PartnerLedgerContactID != nil && strings.TrimSpace(*intake.PartnerLedgerContactID) != "" {
		if err := linkIntakeMovementsToLedgerTx(ctx, tx, companyID, userID, *intake.PartnerLedgerContactID, intake.ID, movementNote); err != nil {
			return nil, err
		}
	}
	if err := s.repo.MarkCompletedTx(ctx, tx, id, userID); err != nil {
		return nil, err
	}
	if err := s.repo.InsertAuditLogTx(ctx, tx, companyID, userID, "warehouse_intake.completed", "WAREHOUSE_INTAKE", id, map[string]any{
		"reference":   intake.Reference,
		"warehouseId": intake.WarehouseID,
		"lineCount":   len(intake.Lines),
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	for _, line := range updated.Lines {
		s.hub.EmitInventoryChanged(companyID, map[string]any{
			"warehouseId":      updated.WarehouseID,
			"productVariantId": line.ProductVariantID,
			"reason":           "WAREHOUSE_INTAKE",
		})
	}
	s.hub.EmitDashboardRefresh(companyID)
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, updated.WarehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	return intakeToMap(updated, &settings), nil
}

func (s *Service) Cancel(ctx context.Context, id, companyID, userID string) (map[string]any, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, err
	}
	preview, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, err
	}
	if preview.Status != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, preview.WarehouseID); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	intake, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, true)
	if err != nil {
		return nil, err
	}
	if intake.Status != "DRAFT" {
		return nil, ErrDraftOnly
	}
	if err := s.repo.MarkCancelledTx(ctx, tx, id); err != nil {
		return nil, err
	}
	if err := s.repo.InsertAuditLogTx(ctx, tx, companyID, userID, "warehouse_intake.cancelled", "WAREHOUSE_INTAKE", id, map[string]any{
		"reference":   intake.Reference,
		"warehouseId": intake.WarehouseID,
		"lineCount":   len(intake.Lines),
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.LoadIntakeDetailTx(ctx, tx, id, companyID, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	warehouse, err := s.repo.LoadWarehouse(ctx, companyID, updated.WarehouseID)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadSettings(ctx, companyID, warehouse)
	if err != nil {
		return nil, err
	}
	return intakeToMap(updated, &settings), nil
}

func (s *Service) GetNakladnoyPDF(ctx context.Context, id, companyID, userID string) ([]byte, string, error) {
	if err := s.assertFeature(ctx, companyID); err != nil {
		return nil, "", err
	}
	intake, err := s.repo.LoadIntakeDetail(ctx, id, companyID)
	if err != nil {
		return nil, "", err
	}
	if err := s.assertWarehouseScope(ctx, companyID, userID, intake.WarehouseID); err != nil {
		return nil, "", err
	}
	if intake.Status != "COMPLETED" {
		return nil, "", errBadRequest("Nakladnoy faqat yakunlangan (COMPLETED) hujjat uchun chop etiladi")
	}

	var companyName string
	var companyTin *string
	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE("legalName", name), tin
		FROM "Company"
		WHERE id = $1
	`, companyID).Scan(&companyName, &companyTin); err != nil {
		return nil, "", err
	}

	workerName := "Noma'lum"
	actorID := normalizeOptional(intake.CompletedBy)
	if actorID == nil {
		auditActor, err := s.repo.FindLatestCompletionActor(ctx, companyID, intake.ID)
		if err != nil {
			return nil, "", err
		}
		actorID = normalizeOptional(auditActor)
	}
	if actorID == nil {
		actorID = normalizeOptional(intake.CreatedBy)
	}
	if actorID != nil {
		fullName, err := s.repo.FindUserFullName(ctx, *actorID)
		if err != nil {
			return nil, "", err
		}
		if fullName != nil && strings.TrimSpace(*fullName) != "" {
			workerName = strings.TrimSpace(*fullName)
		}
	}

	lines := make([]NakladnoyLine, 0, len(intake.Lines))
	totalUnits := 0.0
	for i := range intake.Lines {
		line := intake.Lines[i]
		lines = append(lines, NakladnoyLine{
			ProductName: line.Variant.ProductName,
			VariantName: line.Variant.Name,
			Barcode:     line.Variant.Barcode,
			SKU:         line.Variant.SKU,
			Unit:        line.Variant.ProductUnit,
			Quantity:    line.Quantity,
		})
		totalUnits += line.Quantity
	}

	docDate := intake.UpdatedAt
	if intake.CompletedAt != nil {
		docDate = *intake.CompletedAt
	}
	pdf, err := GenerateNakladnoyPDF(NakladnoyData{
		Reference:           intake.Reference,
		Date:                docDate,
		CompanyName:         companyName,
		CompanyTin:          companyTin,
		WarehouseName:       intake.WarehouseName,
		WarehouseWorkerName: workerName,
		Note:                intake.Note,
		Lines:               lines,
		TotalPositions:      len(lines),
		TotalUnits:          totalUnits,
	})
	if err != nil {
		return nil, "", err
	}
	shortID := intake.ID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return pdf, fmt.Sprintf("nakladnoy-%s.pdf", shortID), nil
}
