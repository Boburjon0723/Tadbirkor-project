package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/internal/auditlogs"
	"github.com/tadbirkor/axis-erp/backend/internal/auth"
	"github.com/tadbirkor/axis-erp/backend/internal/b2borders"
	"github.com/tadbirkor/axis-erp/backend/internal/categories"
	"github.com/tadbirkor/axis-erp/backend/internal/companies"
	"github.com/tadbirkor/axis-erp/backend/internal/config"
	"github.com/tadbirkor/axis-erp/backend/internal/dashboard"
	"github.com/tadbirkor/axis-erp/backend/internal/debts"
	"github.com/tadbirkor/axis-erp/backend/internal/dispatches"
	"github.com/tadbirkor/axis-erp/backend/internal/expenses"
	"github.com/tadbirkor/axis-erp/backend/internal/field"
	"github.com/tadbirkor/axis-erp/backend/internal/goodsreceipts"
	"github.com/tadbirkor/axis-erp/backend/internal/health"
	"github.com/tadbirkor/axis-erp/backend/internal/income"
	"github.com/tadbirkor/axis-erp/backend/internal/inventorycounts"
	"github.com/tadbirkor/axis-erp/backend/internal/invoices"
	"github.com/tadbirkor/axis-erp/backend/internal/migration"
	"github.com/tadbirkor/axis-erp/backend/internal/notifications"
	"github.com/tadbirkor/axis-erp/backend/internal/onboarding"
	"github.com/tadbirkor/axis-erp/backend/internal/partnerledger"
	"github.com/tadbirkor/axis-erp/backend/internal/partners"
	"github.com/tadbirkor/axis-erp/backend/internal/payroll"
	"github.com/tadbirkor/axis-erp/backend/internal/picktasks"
	"github.com/tadbirkor/axis-erp/backend/internal/platform"
	"github.com/tadbirkor/axis-erp/backend/internal/pos"
	"github.com/tadbirkor/axis-erp/backend/internal/productmappings"
	"github.com/tadbirkor/axis-erp/backend/internal/products"
	"github.com/tadbirkor/axis-erp/backend/internal/reports"
	"github.com/tadbirkor/axis-erp/backend/internal/retailcustomers"
	"github.com/tadbirkor/axis-erp/backend/internal/retailreceivables"
	"github.com/tadbirkor/axis-erp/backend/internal/stock"
	"github.com/tadbirkor/axis-erp/backend/internal/storefront"
	"github.com/tadbirkor/axis-erp/backend/internal/support"
	"github.com/tadbirkor/axis-erp/backend/internal/tasks"
	"github.com/tadbirkor/axis-erp/backend/internal/telegram"
	"github.com/tadbirkor/axis-erp/backend/internal/uploads"
	"github.com/tadbirkor/axis-erp/backend/internal/users"
	"github.com/tadbirkor/axis-erp/backend/internal/variants"
	"github.com/tadbirkor/axis-erp/backend/internal/warehouseintake"
	"github.com/tadbirkor/axis-erp/backend/internal/warehouses"
	"github.com/tadbirkor/axis-erp/backend/internal/workflows"
	"github.com/tadbirkor/axis-erp/backend/pkg/httpx"
	"github.com/tadbirkor/axis-erp/backend/pkg/middleware"
)

func apiNotFound(w http.ResponseWriter, _ *http.Request) {
	httpx.Error(w, http.StatusNotFound, "Endpoint topilmadi")
}

type Deps struct {
	Config                   config.Config
	Pool                     *pgxpool.Pool
	AuthHandler              *auth.Handler
	DashboardHandler         *dashboard.Handler
	CompaniesHandler         *companies.Handler
	WarehousesHandler        *warehouses.Handler
	PosHandler               *pos.Handler
	ProductsHandler          *products.Handler
	CategoriesHandler        *categories.Handler
	VariantsHandler          *variants.Handler
	StockHandler             *stock.Handler
	NotificationsHandler     *notifications.Handler
	UsersHandler             *users.Handler
	SupportHandler           *support.Handler
	ExpensesHandler          *expenses.Handler
	GoodsReceiptsHandler     *goodsreceipts.Handler
	RetailCustomersHandler   *retailcustomers.Handler
	RetailReceivablesHandler *retailreceivables.Handler
	PartnersHandler          *partners.Handler
	B2BOrdersHandler         *b2borders.Handler
	IncomeHandler            *income.Handler
	ProductMappingsHandler   *productmappings.Handler
	DebtsHandler             *debts.Handler
	TasksHandler             *tasks.Handler
	WorkflowsHandler         *workflows.Handler
	AuditLogsHandler         *auditlogs.Handler
	UploadsHandler           *uploads.Handler
	PickTasksHandler         *picktasks.Handler
	DispatchesHandler        *dispatches.Handler
	OnboardingHandler        *onboarding.Handler
	PayrollHandler           *payroll.Handler
	ReportsHandler           *reports.Handler
	InventoryCountsHandler   *inventorycounts.Handler
	WarehouseIntakeHandler   *warehouseintake.Handler
	PartnerLedgerHandler     *partnerledger.Handler
	PlatformHandler          *platform.Handler
	FieldHandler             *field.Handler
	TelegramHandler          *telegram.Handler
	InvoicesHandler          *invoices.Handler
	StorefrontHandler        *storefront.Handler
	HealthHandler            *health.Handler
}

func New(d Deps) http.Handler {
	middleware.ConfigurePermissions(d.Pool)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   d.Config.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "x-storefront-token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	jwt := middleware.JWTAuth(d.Config.JWTSecret, d.Config.AuthCookieName)

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"ok":true,"service":"backend-go","version":"1.0.0","mode":"standalone"}`))
		})
		api.Get("/health/deep", d.HealthHandler.Deep)
		api.Get("/ping", func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("pong"))
		})
		api.Get("/migration/status", func(w http.ResponseWriter, _ *http.Request) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"strategy":  "strangler",
				"progress":  migration.Progress(),
				"goModules": migration.GoModules,
				"pending":   migration.PendingModules,
			})
		})

		api.Route("/system", func(sr chi.Router) {
			sr.With(jwt, middleware.RequirePermission("settings.manage")).Post("/init-modules", d.CompaniesHandler.InitModules)
			sr.NotFound(apiNotFound)
			sr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/auth", func(ar chi.Router) {
			ar.Post("/register", d.AuthHandler.Register)
			ar.Post("/register/start", d.AuthHandler.RegisterStart)
			ar.Get("/register/status", d.AuthHandler.RegisterStatus)
			ar.Post("/register/complete", d.AuthHandler.RegisterComplete)
			ar.Post("/login", d.AuthHandler.Login)
			ar.Post("/logout", d.AuthHandler.Logout)
			ar.Post("/password-reset/telegram-link", d.AuthHandler.PasswordResetTelegramLink)
			ar.With(jwt).Get("/me", d.AuthHandler.Me)
			ar.With(jwt, middleware.RequirePermission("users.manage")).Post("/invite", d.AuthHandler.Invite)
			ar.NotFound(apiNotFound)
			ar.MethodNotAllowed(apiNotFound)
		})

		api.Route("/dashboard", func(dr chi.Router) {
			dr.With(jwt, middleware.RequirePermission("reports.view")).Get("/stats", d.DashboardHandler.Stats)
			dr.NotFound(apiNotFound)
		})

		api.Route("/companies", func(cr chi.Router) {
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Get("/me", d.CompaniesHandler.Me)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/me", d.CompaniesHandler.UpdateMe)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/me/storefront-token", d.CompaniesHandler.RegenerateStorefrontToken)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Post("/me/telegram-link/init", d.CompaniesHandler.InitTelegramLink)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Get("/me/telegram-bindings", d.CompaniesHandler.GetTelegramBindings)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/me/telegram-bindings", d.CompaniesHandler.UpsertTelegramBinding)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Delete("/me/telegram-bindings", d.CompaniesHandler.RemoveTelegramBinding)
			cr.With(jwt).Get("/features", d.CompaniesHandler.Features)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/features", d.CompaniesHandler.UpdateFeatures)
			cr.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/features/warehouse-bundle", d.CompaniesHandler.UpdateWarehouseBundle)
			cr.With(jwt, middleware.RequirePermission("pos.view")).Get("/pos-settings", d.CompaniesHandler.PosSettings)
			cr.With(jwt, middleware.RequirePermission("pos.view")).Get("/pos-receipt-settings", d.CompaniesHandler.PosReceiptSettings)
			cr.With(jwt, middleware.RequirePermission("pos.view")).Patch("/pos-receipt-settings", d.CompaniesHandler.UpdatePosReceiptSettings)
			cr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/intake-settings", d.CompaniesHandler.IntakeSettings)
			cr.With(jwt, middleware.RequirePermission("warehouse.view")).Patch("/intake-settings", d.CompaniesHandler.UpdateIntakeSettings)
			cr.NotFound(apiNotFound)
			cr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/warehouses", func(wr chi.Router) {
			wr.With(jwt, middleware.RequirePermission("warehouse.create")).Post("/", d.WarehousesHandler.Create)
			wr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/", d.WarehousesHandler.List)
			wr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/{id}", d.WarehousesHandler.Get)
			wr.With(jwt, middleware.RequirePermission("warehouse.update")).Patch("/{id}", d.WarehousesHandler.Update)
			wr.With(jwt, middleware.RequirePermission("warehouse.delete")).Delete("/{id}", d.WarehousesHandler.Delete)
			wr.NotFound(apiNotFound)
			wr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/pos", func(pr chi.Router) {
			pr.With(jwt, middleware.RequirePermission("pos.view")).Get("/catalog", d.PosHandler.Catalog)
			pr.With(jwt, middleware.RequirePermission("pos.view")).Get("/quick-search", d.PosHandler.QuickSearch)
			pr.With(jwt, middleware.RequirePermission("pos.view")).Get("/summary/today", d.PosHandler.SummaryToday)
			pr.With(jwt, middleware.RequirePermission("pos.create")).Post("/sales", d.PosHandler.CreateSale)
			pr.With(jwt, middleware.RequirePermission("pos.create")).Post("/sales/quick-checkout", d.PosHandler.QuickCheckout)
			pr.With(jwt, middleware.RequirePermission("pos.view")).Get("/sales", d.PosHandler.ListSales)
			pr.With(jwt, middleware.RequirePermission("pos.view")).Get("/sales/{id}", d.PosHandler.GetSale)
			pr.With(jwt, middleware.RequirePermission("pos.create")).Patch("/sales/{id}", d.PosHandler.UpdateSale)
			pr.With(jwt, middleware.RequirePermission("pos.create")).Post("/sales/{id}/checkout", d.PosHandler.Checkout)
			pr.With(jwt, middleware.RequirePermission("pos.void")).Post("/sales/{id}/void", d.PosHandler.VoidSale)
			pr.With(jwt, middleware.RequirePermission("pos.create")).Delete("/sales/{id}", d.PosHandler.DeleteSale)
			pr.NotFound(apiNotFound)
			pr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/products", func(pr chi.Router) {
			pr.With(jwt, middleware.RequirePermission("products.view")).Get("/", d.ProductsHandler.List)
			pr.With(jwt, middleware.RequirePermission("products.view")).Get("/summary/stats", d.ProductsHandler.Summary)
			pr.With(jwt, middleware.RequirePermission("products.create")).Post("/import/preview", d.ProductsHandler.ImportPreview)
			pr.With(jwt, middleware.RequirePermission("products.create")).Post("/import/confirm", d.ProductsHandler.ImportConfirm)
			pr.With(jwt, middleware.RequirePermission("products.create")).Get("/import/jobs/{jobId}", d.ProductsHandler.ImportJobStatus)
			pr.With(jwt, middleware.RequirePermission("products.create")).Get("/import/jobs/{jobId}/failures", d.ProductsHandler.ImportJobFailures)
			pr.With(jwt, middleware.RequirePermission("products.create")).Post("/import/jobs/{jobId}/cancel", d.ProductsHandler.CancelImportJob)
			pr.With(jwt, middleware.RequirePermission("products.create")).Post("/", d.ProductsHandler.Create)
			pr.With(jwt, middleware.RequirePermission("products.view")).Get("/{id}", d.ProductsHandler.Get)
			pr.With(jwt, middleware.RequirePermission("products.update")).Patch("/{id}", d.ProductsHandler.Update)
			pr.With(jwt, middleware.RequirePermission("products.delete")).Delete("/{id}", d.ProductsHandler.Delete)
			pr.NotFound(apiNotFound)
			pr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/product-categories", func(cr chi.Router) {
			cr.With(jwt, middleware.RequirePermission("products.view")).Get("/", d.CategoriesHandler.List)
			cr.With(jwt, middleware.RequirePermission("products.create")).Post("/", d.CategoriesHandler.Create)
			cr.With(jwt, middleware.RequirePermission("products.view")).Get("/{id}", d.CategoriesHandler.Get)
			cr.With(jwt, middleware.RequirePermission("products.update")).Patch("/{id}", d.CategoriesHandler.Update)
			cr.With(jwt, middleware.RequirePermission("products.delete")).Delete("/{id}", d.CategoriesHandler.Delete)
			cr.NotFound(apiNotFound)
			cr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/product-variants", func(vr chi.Router) {
			vr.With(jwt, middleware.RequirePermission("products.view")).Get("/", d.VariantsHandler.List)
			vr.With(jwt, middleware.RequirePermission("products.view")).Get("/search", d.VariantsHandler.Search)
			vr.With(jwt, middleware.RequirePermission("products.create")).Post("/product/{productId}", d.VariantsHandler.Create)
			vr.With(jwt, middleware.RequirePermission("products.view")).Get("/{id}", d.VariantsHandler.Get)
			vr.With(jwt, middleware.RequirePermission("products.update")).Patch("/{id}", d.VariantsHandler.Update)
			vr.With(jwt, middleware.RequirePermission("products.update_price")).Patch("/{id}/price", d.VariantsHandler.UpdatePrice)
			vr.With(jwt, middleware.RequirePermission("products.update")).Patch("/{id}/publish", d.VariantsHandler.Publish)
			vr.With(jwt, middleware.RequirePermission("products.delete")).Delete("/{id}", d.VariantsHandler.Delete)
			vr.NotFound(apiNotFound)
			vr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/stock", func(sr chi.Router) {
			sr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/balances", d.StockHandler.Balances)
			sr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/movements", d.StockHandler.Movements)
			sr.With(jwt, middleware.RequirePermission("warehouse.view")).Post("/availability/batch", d.StockHandler.BatchAvailability)
			sr.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/availability/{variantId}", d.StockHandler.Availability)
			sr.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/movements/in", d.StockHandler.RecordIn)
			sr.With(jwt, middleware.RequirePermission("warehouse.dispatch")).Post("/movements/out", d.StockHandler.RecordOut)
			sr.With(jwt, middleware.RequirePermission("warehouse.adjust")).Post("/adjustments", d.StockHandler.Adjust)
			sr.With(jwt, middleware.RequirePermission("warehouse.transfer")).Post("/transfer", d.StockHandler.Transfer)
			sr.NotFound(apiNotFound)
			sr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/notifications", func(nr chi.Router) {
			nr.With(jwt).Get("/", d.NotificationsHandler.List)
			nr.With(jwt).Get("/unread-count", d.NotificationsHandler.UnreadCount)
			nr.With(jwt).Post("/{id}/read", d.NotificationsHandler.MarkRead)
			nr.With(jwt).Post("/read-all", d.NotificationsHandler.MarkAllRead)
			nr.NotFound(apiNotFound)
		})

		api.Route("/users", func(ur chi.Router) {
			ur.With(jwt).Get("/roles/catalog", d.UsersHandler.RolesCatalog)
			ur.With(jwt, middleware.RequirePermission("users.manage")).Get("/company", d.UsersHandler.CompanyMembers)
			ur.With(jwt, middleware.RequirePermission("users.manage")).Patch("/company/members/{membershipId}/role", d.UsersHandler.UpdateMemberRole)
			ur.With(jwt, middleware.RequirePermission("users.manage")).Patch("/company/members/{membershipId}/password", d.UsersHandler.ResetMemberPassword)
			ur.With(jwt, middleware.RequirePermission("users.manage")).Patch("/company/members/{membershipId}/phone", d.UsersHandler.UpdateMemberPhone)
			ur.With(jwt, middleware.RequirePermission("users.manage")).Delete("/company/members/{membershipId}", d.UsersHandler.RemoveMember)
			ur.With(jwt).Get("/me/warehouse-scope", d.UsersHandler.MyWarehouseScope)
			ur.With(jwt).Patch("/me/password", d.UsersHandler.UpdateMyPassword)
			ur.NotFound(apiNotFound)
		})

		api.Route("/support", func(sr chi.Router) {
			sr.With(jwt).Get("/context", d.SupportHandler.GetContext)
			sr.With(jwt).Post("/messages", d.SupportHandler.SubmitMessage)
			sr.Post("/public-messages", d.SupportHandler.SubmitPublicMessage)
			sr.NotFound(apiNotFound)
			sr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/expenses", func(er chi.Router) {
			er.With(jwt, middleware.RequirePermission("expenses.view")).Get("/categories", d.ExpensesHandler.ListCategories)
			er.With(jwt, middleware.RequirePermission("expenses.manage")).Post("/categories", d.ExpensesHandler.CreateCategory)
			er.With(jwt, middleware.RequirePermission("expenses.manage")).Patch("/categories/{id}", d.ExpensesHandler.UpdateCategory)

			er.With(jwt, middleware.RequirePermission("expenses.view")).Get("/summary", d.ExpensesHandler.Summary)
			er.With(jwt, middleware.RequirePermission("expenses.view")).Get("/", d.ExpensesHandler.FindAll)
			er.With(jwt, middleware.RequirePermission("expenses.view")).Get("/{id}", d.ExpensesHandler.FindOne)

			er.With(jwt, middleware.RequirePermission("expenses.create")).Post("/", d.ExpensesHandler.Create)
			er.With(jwt, middleware.RequirePermission("expenses.create")).Patch("/{id}", d.ExpensesHandler.Update)
			er.With(jwt, middleware.RequirePermission("expenses.create")).Delete("/{id}", d.ExpensesHandler.Remove)

			er.With(jwt, middleware.RequirePermission("expenses.approve")).Post("/{id}/approve", d.ExpensesHandler.Approve)
			er.With(jwt, middleware.RequirePermission("expenses.reject")).Post("/{id}/reject", d.ExpensesHandler.Reject)

			er.NotFound(apiNotFound)
			er.MethodNotAllowed(apiNotFound)
		})

		api.Route("/retail-customers", func(rc chi.Router) {
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/", d.RetailCustomersHandler.List)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/search", d.RetailCustomersHandler.Search)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/pos-picker", d.RetailCustomersHandler.PosPicker)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/summary", d.RetailCustomersHandler.Summary)
			rc.With(jwt, middleware.RequirePermission("pos.create")).Post("/", d.RetailCustomersHandler.Create)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/{id}/ledger/entries/{entryId}/sale-items", d.RetailCustomersHandler.LedgerSaleItems)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/{id}/ledger", d.RetailCustomersHandler.Ledger)
			rc.With(jwt, middleware.RequirePermission("pos.credit")).Post("/{id}/prepaid", d.RetailCustomersHandler.Prepaid)
			rc.With(jwt, middleware.RequirePermission("pos.credit")).Post("/{id}/withdraw", d.RetailCustomersHandler.Withdraw)
			rc.With(jwt, middleware.RequirePermission("pos.view")).Get("/{id}", d.RetailCustomersHandler.Get)
			rc.With(jwt, middleware.RequirePermission("pos.create")).Patch("/{id}", d.RetailCustomersHandler.Update)
			rc.NotFound(apiNotFound)
			rc.MethodNotAllowed(apiNotFound)
		})

		api.Route("/retail-receivables", func(rr chi.Router) {
			rr.With(jwt, middleware.RequirePermission("pos.view")).Get("/", d.RetailReceivablesHandler.List)
			rr.With(jwt, middleware.RequirePermission("pos.view")).Get("/{id}", d.RetailReceivablesHandler.Get)
			rr.With(jwt, middleware.RequirePermission("pos.credit")).Post("/{id}/payments", d.RetailReceivablesHandler.RecordPayment)
			rr.NotFound(apiNotFound)
			rr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/partners", func(pr chi.Router) {
			pr.With(jwt, middleware.RequirePermission("partners.view")).Get("/", d.PartnersHandler.List)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Get("/search-company/{tin}", d.PartnersHandler.SearchCompany)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Post("/request", d.PartnersHandler.Request)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Patch("/{id}/accept", d.PartnersHandler.Accept)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Patch("/{id}/reject", d.PartnersHandler.Reject)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Patch("/{id}/block", d.PartnersHandler.Block)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Patch("/{id}/warehouse-visibility", d.PartnersHandler.WarehouseVisibility)
			pr.With(jwt, middleware.RequirePermission("partners.manage")).Delete("/{id}", d.PartnersHandler.Delete)
			pr.With(jwt, middleware.RequirePermission("partners.view")).Get("/{id}", d.PartnersHandler.Get)
			pr.NotFound(apiNotFound)
			pr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/b2b-orders", func(or chi.Router) {
			or.With(jwt, middleware.RequirePermission("orders.create")).Post("/", d.B2BOrdersHandler.Create)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/hub/stats", d.B2BOrdersHandler.HubStats)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/stats", d.B2BOrdersHandler.BuyerStats)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/pricing/suggestion", d.B2BOrdersHandler.PricingSuggestion)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/seller-catalog", d.B2BOrdersHandler.SellerCatalog)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/", d.B2BOrdersHandler.FindAllBuyer)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/{id}/export/excel", d.B2BOrdersHandler.ExportExcel)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/{id}/items", d.B2BOrdersHandler.FindOrderItems)
			or.With(jwt, middleware.RequirePermission("orders.view")).Get("/{id}", d.B2BOrdersHandler.FindOne)
			or.With(jwt, middleware.RequirePermission("orders.send")).Post("/{id}/send", d.B2BOrdersHandler.Send)
			or.With(jwt, middleware.RequirePermission("orders.create")).Patch("/{id}", d.B2BOrdersHandler.UpdateDraft)
			or.With(jwt, middleware.RequirePermission("orders.create")).Post("/{id}/cancel", d.B2BOrdersHandler.Cancel)
			or.With(jwt, middleware.RequirePermission("orders.view")).Post("/{id}/close-remainder", d.B2BOrdersHandler.CloseRemainder)
			or.With(jwt, middleware.RequirePermission("orders.create")).Delete("/{id}", d.B2BOrdersHandler.Remove)
			or.NotFound(apiNotFound)
			or.MethodNotAllowed(apiNotFound)
		})

		api.Route("/incoming-orders", func(ir chi.Router) {
			ir.With(jwt, middleware.RequirePermission("orders.view")).Get("/stats", d.B2BOrdersHandler.IncomingStats)
			ir.With(jwt, middleware.RequirePermission("orders.view")).Get("/", d.B2BOrdersHandler.FindAllIncoming)
			ir.With(jwt, middleware.RequirePermission("orders.view")).Get("/{id}", d.B2BOrdersHandler.FindOne)
			ir.With(jwt, middleware.RequirePermission("orders.accept")).Post("/{id}/accept", d.B2BOrdersHandler.AcceptIncoming)
			ir.With(jwt, middleware.RequirePermission("orders.reject")).Post("/{id}/reject", d.B2BOrdersHandler.RejectIncoming)
			ir.With(jwt, middleware.RequirePermission("orders.accept")).Post("/{id}/close-remainder", d.B2BOrdersHandler.CloseIncomingRemainder)
			ir.With(jwt, middleware.RequirePermission("orders.accept")).Post("/{id}/items/{itemId}/map", d.B2BOrdersHandler.MapIncomingItem)
			ir.NotFound(apiNotFound)
			ir.MethodNotAllowed(apiNotFound)
		})

		api.Route("/income", func(ir chi.Router) {
			ir.With(jwt, middleware.RequirePermission("income.view")).Get("/categories", d.IncomeHandler.ListCategories)
			ir.With(jwt, middleware.RequirePermission("income.manage")).Post("/categories", d.IncomeHandler.CreateCategory)
			ir.With(jwt, middleware.RequirePermission("income.manage")).Patch("/categories/{id}", d.IncomeHandler.UpdateCategory)
			ir.With(jwt, middleware.RequirePermission("income.view")).Get("/", d.IncomeHandler.List)
			ir.With(jwt, middleware.RequirePermission("income.create")).Post("/", d.IncomeHandler.Create)
			ir.With(jwt, middleware.RequirePermission("income.view")).Get("/{id}", d.IncomeHandler.Get)
			ir.With(jwt, middleware.RequirePermission("income.create")).Patch("/{id}", d.IncomeHandler.Update)
			ir.With(jwt, middleware.RequirePermission("income.create")).Delete("/{id}", d.IncomeHandler.Delete)
			ir.NotFound(apiNotFound)
			ir.MethodNotAllowed(apiNotFound)
		})

		api.Route("/reports", func(rr chi.Router) {
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/monthly-overview", d.ReportsHandler.MonthlyOverview)
			rr.With(jwt, middleware.RequirePermission("pos.view")).Get("/pos/summary", d.ReportsHandler.PosSummary)
			rr.With(jwt, middleware.RequirePermission("pos.view")).Get("/pos/top-products", d.ReportsHandler.PosTopProducts)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/field-workers/installations", d.ReportsHandler.FieldWorkerInstallations)

			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/summary", d.ReportsHandler.Summary)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/summary/daily", d.ReportsHandler.SummaryDaily)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/summary/top-products", d.ReportsHandler.SummaryTopProducts)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/summary/export", d.ReportsHandler.SummaryExport)

			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/stock", d.ReportsHandler.Stock)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/stock-movements", d.ReportsHandler.StockMovements)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/debtors", d.ReportsHandler.Debtors)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/creditors", d.ReportsHandler.Creditors)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/partners-balance", d.ReportsHandler.PartnersBalance)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/b2b-orders", d.ReportsHandler.B2BOrders)

			rr.With(jwt, middleware.RequireAnyPermission("reports.view", "orders.view")).Get("/analytics/orders", d.ReportsHandler.AnalyticsOrders)
			rr.With(jwt, middleware.RequireAnyPermission("reports.view", "warehouse.view")).Get("/analytics/stock", d.ReportsHandler.AnalyticsStock)

			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/export/stock", d.ReportsHandler.ExportStock)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/export/stock/pdf", d.ReportsHandler.ExportStockPDF)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/export/products-import-format", d.ReportsHandler.ExportProductsImportFormat)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/templates/products", d.ReportsHandler.ProductTemplate)
			rr.With(jwt, middleware.RequirePermission("reports.view")).Get("/partners/{partnerCompanyId}/balance/pdf", d.ReportsHandler.PartnerBalancePDF)

			rr.NotFound(apiNotFound)
			rr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/product-mappings", func(pm chi.Router) {
			pm.With(jwt, middleware.RequirePermission("product_mappings.view")).Get("/", d.ProductMappingsHandler.List)
			pm.With(jwt, middleware.RequirePermission("product_mappings.view")).Get("/missing", d.ProductMappingsHandler.Missing)
			pm.With(jwt, middleware.RequirePermission("product_mappings.manage")).Post("/", d.ProductMappingsHandler.Create)
			pm.With(jwt, middleware.RequirePermission("product_mappings.view")).Get("/{id}", d.ProductMappingsHandler.Get)
			pm.With(jwt, middleware.RequirePermission("product_mappings.manage")).Patch("/{id}", d.ProductMappingsHandler.Update)
			pm.With(jwt, middleware.RequirePermission("product_mappings.manage")).Delete("/{id}", d.ProductMappingsHandler.Delete)
			pm.NotFound(apiNotFound)
			pm.MethodNotAllowed(apiNotFound)
		})

		api.Route("/tasks", func(tr chi.Router) {
			tr.With(jwt, middleware.RequirePermission("tasks.view")).Get("/", d.TasksHandler.FindAll)
			tr.With(jwt, middleware.RequirePermission("tasks.view")).Get("/my", d.TasksHandler.FindMy)
			tr.With(jwt, middleware.RequirePermission("tasks.manage")).Post("/", d.TasksHandler.Create)
			tr.With(jwt, middleware.RequirePermission("tasks.view")).Patch("/{id}/status", d.TasksHandler.UpdateStatus)
			tr.With(jwt, middleware.RequirePermission("tasks.assign")).Post("/{id}/assign", d.TasksHandler.Assign)

			tr.NotFound(apiNotFound)
			tr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/workflows", func(wr chi.Router) {
			wr.With(jwt, middleware.RequirePermission("settings.manage")).Get("/", d.WorkflowsHandler.FindAll)
			wr.With(jwt, middleware.RequirePermission("settings.manage")).Post("/", d.WorkflowsHandler.CreateDefinition)
			wr.With(jwt, middleware.RequirePermission("settings.manage")).Post("/{id}/steps", d.WorkflowsHandler.AddStep)
			wr.With(jwt, middleware.RequirePermission("tasks.manage")).Post("/execute/{eventKey}", d.WorkflowsHandler.ExecuteEvent)

			wr.NotFound(apiNotFound)
			wr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/audit-logs", func(al chi.Router) {
			al.With(jwt, middleware.RequirePermission("settings.manage")).Get("/", d.AuditLogsHandler.List)
			al.With(jwt, middleware.RequirePermission("settings.manage")).Get("/stats", d.AuditLogsHandler.Stats)
			al.With(jwt, middleware.RequirePermission("settings.manage")).Get("/{id}", d.AuditLogsHandler.Get)
			al.NotFound(apiNotFound)
			al.MethodNotAllowed(apiNotFound)
		})

		api.Route("/uploads", func(ur chi.Router) {
			ur.With(jwt, middleware.RequirePermission("settings.manage")).Get("/status", d.UploadsHandler.GetStatus)
			ur.With(jwt).Post("/image", d.UploadsHandler.UploadImage)
			ur.NotFound(apiNotFound)
			ur.MethodNotAllowed(apiNotFound)
		})

		api.Route("/pick-tasks", func(ptr chi.Router) {
			ptr.With(jwt, middleware.RequirePermission("warehouse.dispatch")).Get("/", d.PickTasksHandler.List)
			ptr.With(jwt, middleware.RequirePermission("warehouse.dispatch")).Get("/{id}", d.PickTasksHandler.FindOne)
			ptr.With(jwt, middleware.RequirePermission("warehouse.dispatch")).Patch("/{id}/scan", d.PickTasksHandler.Scan)
			ptr.With(jwt, middleware.RequirePermission("warehouse.dispatch")).Patch("/{id}/complete", d.PickTasksHandler.Complete)
			ptr.NotFound(apiNotFound)
			ptr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/dispatches", func(dr chi.Router) {
			dr.With(jwt, middleware.RequirePermission("dispatches.create")).Post("/", d.DispatchesHandler.Create)
			dr.With(jwt, middleware.RequireAllPermissions("dispatches.create", "dispatches.send")).Post("/create-and-send", d.DispatchesHandler.CreateAndSend)
			dr.With(jwt, middleware.RequirePermission("dispatches.view")).Get("/", d.DispatchesHandler.FindAll)
			dr.With(jwt, middleware.RequirePermission("dispatches.view")).Get("/{id}/pick-tasks", d.PickTasksHandler.ListForDispatch)
			dr.With(jwt, middleware.RequirePermission("dispatches.view")).Get("/{id}", d.DispatchesHandler.FindOne)
			dr.With(jwt, middleware.RequirePermission("dispatches.send")).Post("/{id}/send", d.DispatchesHandler.Send)
			dr.With(jwt, middleware.RequirePermission("dispatches.cancel")).Post("/{id}/cancel", d.DispatchesHandler.Cancel)
			dr.NotFound(apiNotFound)
			dr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/goods-receipts", func(gr chi.Router) {
			gr.With(jwt, middleware.RequirePermission("goods_receipts.view")).Get("/", d.GoodsReceiptsHandler.FindAll)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.view")).Get("/export/excel", d.GoodsReceiptsHandler.ExportAllExcel)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.view")).Get("/{id}/export/excel", d.GoodsReceiptsHandler.ExportExcel)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.view")).Get("/{id}/pdf", d.GoodsReceiptsHandler.DownloadPDF)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.view")).Get("/{id}", d.GoodsReceiptsHandler.FindOne)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.accept")).Post("/{id}/accept", d.GoodsReceiptsHandler.Accept)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.accept")).Post("/{id}/partial-accept", d.GoodsReceiptsHandler.PartialAccept)
			gr.With(jwt, middleware.RequirePermission("goods_receipts.reject")).Post("/{id}/reject", d.GoodsReceiptsHandler.Reject)
			gr.NotFound(apiNotFound)
			gr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/onboarding", func(or chi.Router) {
			or.With(jwt, middleware.RequirePermission("settings.manage")).Post("/company", d.OnboardingHandler.CreateCompany)
			or.With(jwt, middleware.RequirePermission("settings.manage")).Patch("/company", d.OnboardingHandler.UpdateCompany)
			or.With(jwt, middleware.RequirePermission("settings.manage")).Post("/business-answers", d.OnboardingHandler.SubmitAnswers)
			or.With(jwt, middleware.RequirePermission("settings.manage")).Post("/team", d.OnboardingHandler.AddTeamMember)
			or.With(jwt, middleware.RequirePermission("settings.manage")).Post("/complete", d.OnboardingHandler.CompleteOnboarding)
			or.With(jwt, middleware.RequirePermission("settings.manage")).Get("/status", d.OnboardingHandler.GetStatus)

			or.NotFound(apiNotFound)
			or.MethodNotAllowed(apiNotFound)
		})

		api.Route("/inventory-counts", func(ic chi.Router) {
			ic.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/", d.InventoryCountsHandler.List)
			ic.With(jwt, middleware.RequirePermission("warehouse.adjust")).Post("/", d.InventoryCountsHandler.Start)
			ic.With(jwt, middleware.RequirePermission("warehouse.adjust")).Patch("/items/{itemId}/count", d.InventoryCountsHandler.RecordCount)
			ic.With(jwt, middleware.RequirePermission("warehouse.manage")).Patch("/items/{itemId}/approve", d.InventoryCountsHandler.ApproveItem)
			ic.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/{id}", d.InventoryCountsHandler.FindOne)
			ic.With(jwt, middleware.RequirePermission("warehouse.adjust")).Post("/{id}/scan", d.InventoryCountsHandler.Scan)
			ic.With(jwt, middleware.RequirePermission("warehouse.manage")).Post("/{id}/complete", d.InventoryCountsHandler.Complete)
			ic.With(jwt, middleware.RequirePermission("warehouse.adjust")).Post("/{id}/cancel", d.InventoryCountsHandler.Cancel)
			ic.NotFound(apiNotFound)
			ic.MethodNotAllowed(apiNotFound)
		})

		api.Route("/payroll", func(pr chi.Router) {
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/settings", d.PayrollHandler.GetSettings)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/settings", d.PayrollHandler.UpdateSettings)

			pr.With(jwt, middleware.RequireAnyPermission("payroll.view", "payroll.manage")).Get("/leave-requests", d.PayrollHandler.ListLeaveRequests)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/leave-requests/pending-count", d.PayrollHandler.PendingLeaveCount)
			pr.With(jwt, middleware.RequireAnyPermission("payroll.view", "payroll.manage")).Post("/leave-requests", d.PayrollHandler.CreateLeaveRequest)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/leave-requests/{id}/approve", d.PayrollHandler.ApproveLeaveRequest)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/leave-requests/{id}/reject", d.PayrollHandler.RejectLeaveRequest)

			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/work-months/{companyUserId}/approved-leaves", d.PayrollHandler.ApprovedLeaves)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/work-months/{companyUserId}", d.PayrollHandler.GetWorkMonth)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/work-months/{companyUserId}", d.PayrollHandler.UpdateWorkMonth)

			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/members", d.PayrollHandler.ListMembers)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/members", d.PayrollHandler.CreatePayrollOnlyMember)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/members/{companyUserId}/leave-requests", d.PayrollHandler.ListMemberLeaveRequests)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/members/{companyUserId}/leave-requests", d.PayrollHandler.RecordMemberLeave)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/members/{companyUserId}/profile", d.PayrollHandler.GetMemberProfile)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/members/{companyUserId}/profile", d.PayrollHandler.UpsertPayrollProfile)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/members/{companyUserId}/employee", d.PayrollHandler.GetEmployeeExtra)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/members/{companyUserId}/employee", d.PayrollHandler.UpsertEmployeeExtra)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/members/{companyUserId}/roster", d.PayrollHandler.AddMemberToRoster)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/members/{companyUserId}/settlement", d.PayrollHandler.GetSettlement)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/members/{companyUserId}/settlement", d.PayrollHandler.UpsertSettlement)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Patch("/members/{companyUserId}/mark-left", d.PayrollHandler.MarkEmployeeLeft)

			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/compensations", d.PayrollHandler.ListCompensations)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/compensations", d.PayrollHandler.UpsertCompensation)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/employee-extras", d.PayrollHandler.ListEmployeeExtras)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/roster-candidates", d.PayrollHandler.ListRosterCandidates)

			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/advances", d.PayrollHandler.ListAdvances)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/advances", d.PayrollHandler.AddAdvance)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Post("/bonus", d.PayrollHandler.AddBonus)
			pr.With(jwt, middleware.RequirePermission("payroll.manage")).Get("/month-stats", d.PayrollHandler.GetMonthStats)

			pr.NotFound(apiNotFound)
			pr.MethodNotAllowed(apiNotFound)
		})

		api.Route("/warehouse-intake", func(wi chi.Router) {
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Get("/lookup", d.WarehouseIntakeHandler.LookupBarcode)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/", d.WarehouseIntakeHandler.Create)
			wi.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/", d.WarehouseIntakeHandler.List)
			wi.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/{id}/nakladnoy/pdf", d.WarehouseIntakeHandler.DownloadNakladnoy)
			wi.With(jwt, middleware.RequirePermission("warehouse.view")).Get("/{id}", d.WarehouseIntakeHandler.FindOne)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/{id}/lines", d.WarehouseIntakeHandler.AddLine)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/{id}/scan", d.WarehouseIntakeHandler.ScanLine)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/{id}/quick-product", d.WarehouseIntakeHandler.QuickProduct)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Patch("/{id}/lines/{lineId}", d.WarehouseIntakeHandler.UpdateLine)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Delete("/{id}/lines/{lineId}", d.WarehouseIntakeHandler.RemoveLine)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/{id}/complete", d.WarehouseIntakeHandler.Complete)
			wi.With(jwt, middleware.RequirePermission("warehouse.receive")).Post("/{id}/cancel", d.WarehouseIntakeHandler.Cancel)
			wi.NotFound(apiNotFound)
			wi.MethodNotAllowed(apiNotFound)
		})

		api.Route("/partner-ledger", func(pl chi.Router) {
			pl.With(jwt, middleware.RequireAnyPermission("partner_ledger.view", "partner_ledger.manage")).Get("/sale-order-template", d.PartnerLedgerHandler.SaleOrderTemplate)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Post("/contacts/{contactId}/sale-orders/preview-excel", d.PartnerLedgerHandler.PreviewSaleOrderExcel)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}/sale-orders/{batchId}/export/excel", d.PartnerLedgerHandler.ExportSaleOrderExcel)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/summary", d.PartnerLedgerHandler.Summary)
			pl.With(jwt, middleware.RequireAnyPermission("partner_ledger.view", "warehouse.view")).Get("/contacts/select", d.PartnerLedgerHandler.ListContactsForSelect)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts", d.PartnerLedgerHandler.ListContacts)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Post("/contacts", d.PartnerLedgerHandler.CreateContact)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}", d.PartnerLedgerHandler.GetContact)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Patch("/contacts/{contactId}", d.PartnerLedgerHandler.UpdateContact)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Delete("/contacts/{contactId}", d.PartnerLedgerHandler.DeleteContact)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}/operations/export/excel", d.PartnerLedgerHandler.ExportOperationsExcel)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}/operations", d.PartnerLedgerHandler.ListOperations)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}/balance-history", d.PartnerLedgerHandler.BalanceHistory)
			pl.With(jwt, middleware.RequireAnyPermission("partner_ledger.view", "warehouse.view")).Get("/sale-catalog", d.PartnerLedgerHandler.SaleCatalog)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/contacts/{contactId}/sale-orders/{batchId}/lines", d.PartnerLedgerHandler.GetSaleOrderLines)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Post("/contacts/{contactId}/sale-orders", d.PartnerLedgerHandler.CreateSaleOrder)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Post("/contacts/{contactId}/sale-orders/{batchId}/send", d.PartnerLedgerHandler.SendSaleOrderToPartner)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Post("/contacts/{contactId}/operations", d.PartnerLedgerHandler.CreateOperation)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/operations/{operationId}/lines", d.PartnerLedgerHandler.GetOperationLines)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.view")).Get("/operations/{operationId}/export/excel", d.PartnerLedgerHandler.ExportOperationExcel)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Patch("/operations/{operationId}", d.PartnerLedgerHandler.UpdateOperation)
			pl.With(jwt, middleware.RequirePermission("partner_ledger.manage")).Delete("/operations/{operationId}", d.PartnerLedgerHandler.DeleteOperation)
			pl.NotFound(apiNotFound)
			pl.MethodNotAllowed(apiNotFound)
		})

		api.Route("/debts", func(de chi.Router) {
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/entries/summary", d.DebtsHandler.EntriesSummary)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partner-groups", d.DebtsHandler.PartnerGroups)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partner-reports", d.DebtsHandler.PartnerReportArchive)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partner-groups/{partnerCompanyId}", d.DebtsHandler.PartnerGroupOne)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/entries", d.DebtsHandler.ListEntries)
			de.With(jwt, middleware.RequirePermission("debt.confirm_payment")).Get("/payment-records/pending", d.DebtsHandler.PendingPayments)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/entries/{id}", d.DebtsHandler.GetEntry)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partners/{partnerCompanyId}/ledger", d.DebtsHandler.PartnerLedger)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partners/{partnerCompanyId}/akt-sverka/pdf", d.DebtsHandler.AktSverkaPdf)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partners/{partnerCompanyId}/akt-sverka/excel", d.DebtsHandler.AktSverkaExcel)
			de.With(jwt, middleware.RequirePermission("debt.view")).Get("/partners/{partnerCompanyId}", d.DebtsHandler.PartnerBalance)
			de.With(jwt, middleware.RequirePermission("debt.create_payment")).Post("/partners/{partnerCompanyId}/record-bulk-payment", d.DebtsHandler.RecordBulkPayment)
			de.With(jwt, middleware.RequirePermission("debt.confirm_payment")).Post("/partners/{partnerCompanyId}/confirm-bulk-payments", d.DebtsHandler.ConfirmBulkPayments)
			de.With(jwt, middleware.RequirePermission("debt.confirm_payment")).Post("/entries/{id}/apply-payment", d.DebtsHandler.ApplyPayment)
			de.With(jwt, middleware.RequirePermission("debt.create_payment")).Post("/{debtEntryId}/payment-records", d.DebtsHandler.CreatePayment)
			de.With(jwt, middleware.RequirePermission("debt.confirm_payment")).Post("/payment-records/{id}/confirm", d.DebtsHandler.ConfirmPayment)
			de.With(jwt, middleware.RequirePermission("debt.reject_payment")).Post("/payment-records/{id}/reject", d.DebtsHandler.RejectPayment)
			de.NotFound(apiNotFound)
			de.MethodNotAllowed(apiNotFound)
		})

		api.Route("/platform", func(pl chi.Router) {
			pl.With(jwt).Post("/verify-pin", d.PlatformHandler.VerifyPin)
			pl.With(jwt).Get("/access", d.PlatformHandler.AccessInfo)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Get("/stats", d.PlatformHandler.Stats)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Get("/redis-health", d.PlatformHandler.RedisHealth)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Get("/companies", d.PlatformHandler.ListCompanies)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Patch("/companies/{companyId}", d.PlatformHandler.UpdateCompany)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Get("/users", d.PlatformHandler.ListUsers)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Patch("/users/{userId}", d.PlatformHandler.UpdateUser)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Post("/broadcast", d.PlatformHandler.Broadcast)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Get("/scheduled-jobs", d.PlatformHandler.ListScheduledJobs)
			pl.With(jwt, middleware.RequirePlatformAdmin(d.Pool)).Delete("/scheduled-jobs/{jobId}", d.PlatformHandler.CancelScheduledJob)
			pl.NotFound(apiNotFound)
			pl.MethodNotAllowed(apiNotFound)
		})

		api.Route("/field", func(fl chi.Router) {
			fl.With(jwt, middleware.RequirePermission("field_task.view_all")).Get("/tasks", d.FieldHandler.ListTasks)
			fl.With(jwt, middleware.RequirePermission("field_task.view_all")).Get("/tasks/{id}", d.FieldHandler.GetTask)
			fl.With(jwt, middleware.RequirePermission("field_task.create")).Post("/tasks", d.FieldHandler.CreateTask)
			fl.With(jwt, middleware.RequirePermission("field_task.approve")).Post("/tasks/{id}/approve", d.FieldHandler.ApproveTask)
			fl.With(jwt, middleware.RequirePermission("field_task.approve")).Post("/tasks/{id}/reject", d.FieldHandler.RejectTask)
			fl.With(jwt, middleware.RequirePermission("field_task.view_all")).Get("/workers/stock", d.FieldHandler.WorkerStock)
			fl.With(jwt, middleware.RequirePermission("field_task.view_all")).Get("/reports/kpi", d.FieldHandler.Kpi)
			fl.With(jwt, middleware.RequirePermission("field_task.view_own")).Get("/me/tasks", d.FieldHandler.MyTasks)
			fl.With(jwt, middleware.RequirePermission("field_task.view_own")).Get("/me/tasks/{id}", d.FieldHandler.MyTask)
			fl.With(jwt, middleware.RequirePermission("field_stock.view_own")).Get("/me/stock", d.FieldHandler.MyStock)
			fl.With(jwt, middleware.RequirePermission("field_task.view_own")).Get("/me/history", d.FieldHandler.MyHistory)
			fl.With(jwt, middleware.RequirePermission("field_task.accept")).Post("/tasks/{id}/accept", d.FieldHandler.AcceptTask)
			fl.With(jwt, middleware.RequirePermission("field_task.report")).Post("/tasks/{id}/report", d.FieldHandler.SubmitReport)
			fl.NotFound(apiNotFound)
			fl.MethodNotAllowed(apiNotFound)
		})

		api.Route("/telegram", func(tl chi.Router) {
			tl.Post("/webhook", d.TelegramHandler.Webhook)
			tl.NotFound(apiNotFound)
			tl.MethodNotAllowed(apiNotFound)
		})

		api.Route("/invoices", func(inv chi.Router) {
			inv.With(jwt, middleware.RequirePermission("orders.view")).Get("/{id}/pdf", d.InvoicesHandler.DownloadPDF)
			inv.NotFound(apiNotFound)
			inv.MethodNotAllowed(apiNotFound)
		})

		api.Route("/storefront", func(st chi.Router) {
			st.Get("/{companyId}/products", d.StorefrontHandler.GetProducts)
			st.NotFound(apiNotFound)
			st.MethodNotAllowed(apiNotFound)
		})

		api.Route("/websocket", func(ws chi.Router) {
			ws.NotFound(apiNotFound)
			ws.MethodNotAllowed(apiNotFound)
		})

		api.NotFound(apiNotFound)
		api.MethodNotAllowed(apiNotFound)
	})

	return r
}
