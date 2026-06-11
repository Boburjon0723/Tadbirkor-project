package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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
	"github.com/tadbirkor/axis-erp/backend/internal/realtime"
	"github.com/tadbirkor/axis-erp/backend/internal/reports"
	"github.com/tadbirkor/axis-erp/backend/internal/retailcustomers"
	"github.com/tadbirkor/axis-erp/backend/internal/retailreceivables"
	"github.com/tadbirkor/axis-erp/backend/internal/router"
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
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
	"github.com/tadbirkor/axis-erp/backend/pkg/db"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL majburiy")
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET majburiy")
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("DB ulanish: %v", err)
	}
	defer pool.Close()

	c := cache.New(cfg.RedisURL)
	defer c.Close()

	rt := realtime.New(cfg)
	hub := rt.Hub()

	authRepo := auth.NewRepository(pool)
	authSvc := auth.NewService(authRepo, c, cfg)
	authHandler := auth.NewHandler(authSvc, cfg)

	dashSvc := dashboard.NewService(pool, c, cfg.DashboardCacheTTL)
	dashHandler := dashboard.NewHandler(dashSvc)

	companiesSvc := companies.NewService(pool, c, cfg.TelegramBotUsername)
	companiesHandler := companies.NewHandler(companiesSvc)

	warehousesSvc := warehouses.NewService(pool, c)
	warehousesHandler := warehouses.NewHandler(warehousesSvc)

	posSvc := pos.NewService(pool, c, hub)
	posHandler := pos.NewHandler(posSvc)

	productsSvc := products.NewService(pool, c, hub)
	productsHandler := products.NewHandler(productsSvc)

	categoriesSvc := categories.NewService(pool, c)
	categoriesHandler := categories.NewHandler(categoriesSvc)

	variantsSvc := variants.NewService(pool, c)
	variantsHandler := variants.NewHandler(variantsSvc)

	stockSvc := stock.NewService(pool, hub, c)
	stockHandler := stock.NewHandler(stockSvc, companiesSvc)

	notificationsSvc := notifications.NewService(pool, hub)
	notificationsHandler := notifications.NewHandler(notificationsSvc)

	usersSvc := users.NewService(pool, c)
	usersHandler := users.NewHandler(usersSvc)

	supportRepo := support.NewRepository(pool)
	supportSvc := support.NewService(supportRepo, cfg)
	supportHandler := support.NewHandler(supportSvc)

	expensesRepo := expenses.NewRepository(pool)
	expensesSvc := expenses.NewService(expensesRepo)
	expensesHandler := expenses.NewHandler(expensesSvc)

	goodsReceiptsRepo := goodsreceipts.NewRepository(pool)
	goodsReceiptsSvc := goodsreceipts.NewService(pool, goodsReceiptsRepo, notificationsSvc, hub, c)
	goodsReceiptsHandler := goodsreceipts.NewHandler(goodsReceiptsSvc)

	incomeRepo := income.NewRepository(pool)
	incomeSvc := income.NewService(incomeRepo)
	incomeHandler := income.NewHandler(incomeSvc)

	retailCustomersSvc := retailcustomers.NewService(pool, c)
	retailCustomersHandler := retailcustomers.NewHandler(retailCustomersSvc)

	retailReceivablesSvc := retailreceivables.NewService(pool, c)
	retailReceivablesHandler := retailreceivables.NewHandler(retailReceivablesSvc)

	partnersSvc := partners.NewService(pool, notificationsSvc)
	partnersHandler := partners.NewHandler(partnersSvc)

	b2bOrdersRepo := b2borders.NewRepository(pool)
	b2bOrdersSvc := b2borders.NewService(pool, b2bOrdersRepo, hub, notificationsSvc, c)
	b2bOrdersHandler := b2borders.NewHandler(b2bOrdersSvc)

	productMappingsSvc := productmappings.NewService(pool)
	productMappingsHandler := productmappings.NewHandler(productMappingsSvc)

	debtsSvc := debts.NewService(pool, notificationsSvc, hub, c)

	tasksRepo := tasks.NewRepository(pool)
	tasksSvc := tasks.NewService(tasksRepo)
	tasksHandler := tasks.NewHandler(tasksSvc)

	workflowsRepo := workflows.NewRepository(pool)
	workflowsSvc := workflows.NewService(workflowsRepo)
	workflowsHandler := workflows.NewHandler(workflowsSvc)

	auditLogsSvc := auditlogs.NewService(pool)
	auditLogsHandler := auditlogs.NewHandler(auditLogsSvc)

	uploadsSvc := uploads.NewService(cfg)
	uploadsHandler := uploads.NewHandler(uploadsSvc)

	pickTasksRepo := picktasks.NewRepository(pool)
	pickTasksSvc := picktasks.NewService(pickTasksRepo, notificationsSvc)
	pickTasksHandler := picktasks.NewHandler(pickTasksSvc, companiesSvc)

	dispatchesRepo := dispatches.NewRepository(pool)
	dispatchesSvc := dispatches.NewService(pool, dispatchesRepo, pickTasksSvc, notificationsSvc, hub, c)
	dispatchesHandler := dispatches.NewHandler(dispatchesSvc)

	onboardingSvc := onboarding.NewService(pool, c)
	onboardingHandler := onboarding.NewHandler(onboardingSvc)

	payrollRepo := payroll.NewRepository(pool)
	payrollLeaveSvc := payroll.NewLeaveService(payrollRepo, companiesSvc, notificationsSvc)
	payrollDataSvc := payroll.NewDataService(payrollRepo, payrollLeaveSvc, companiesSvc)
	payrollHandler := payroll.NewHandler(payrollLeaveSvc, payrollDataSvc)

	reportsSvc := reports.NewService(pool, companiesSvc, incomeSvc, expensesSvc, payrollDataSvc)
	reportsHandler := reports.NewHandler(reportsSvc)
	debtsHandler := debts.NewHandler(debtsSvc, reportsSvc)

	inventoryCountsSvc := inventorycounts.NewService(pool, notificationsSvc, hub, c)
	inventoryCountsHandler := inventorycounts.NewHandler(inventoryCountsSvc, companiesSvc)

	warehouseIntakeRepo := warehouseintake.NewRepository(pool)
	warehouseIntakeSvc := warehouseintake.NewService(pool, warehouseIntakeRepo, companiesSvc, hub, c)
	warehouseIntakeHandler := warehouseintake.NewHandler(warehouseIntakeSvc)

	partnerLedgerRepo := partnerledger.NewRepository(pool)
	partnerLedgerSvc := partnerledger.NewService(pool, partnerLedgerRepo, notificationsSvc, hub, c)
	partnerLedgerHandler := partnerledger.NewHandler(partnerLedgerSvc)

	platformRepo := platform.NewRepository(pool)
	platformSvc := platform.NewService(pool, platformRepo, c, hub)
	platformHandler := platform.NewHandler(platformSvc)

	fieldRepo := field.NewRepository(pool)
	fieldSvc := field.NewService(pool, fieldRepo, companiesSvc, notificationsSvc, hub, c)
	fieldHandler := field.NewHandler(fieldSvc)

	telegramRepo := telegram.NewRepository(pool)
	telegramSvc := telegram.NewService(telegramRepo, cfg)
	deliverySvc := notifications.NewDeliveryService(pool, telegramSvc)
	notificationsSvc.SetDelivery(deliverySvc)
	workerCtx, workerCancel := context.WithCancel(context.Background())
	platformSvc.StartScheduler(workerCtx)
	deliverySvc.StartRetryWorker(workerCtx)
	telegramSvc.BindBots(payrollLeaveSvc, payrollDataSvc, fieldSvc)
	telegramHandler := telegram.NewHandler(telegramSvc)

	invoicesHandler := invoices.NewHandler(b2bOrdersSvc)
	storefrontHandler := storefront.NewHandler(variantsSvc)

	startTime := time.Now()
	healthHandler := &health.Handler{Pool: pool, Cache: c, StartTime: startTime}

	apiHandler := router.New(router.Deps{
		Config:                   cfg,
		Pool:                     pool,
		HealthHandler:            healthHandler,
		AuthHandler:              authHandler,
		DashboardHandler:         dashHandler,
		CompaniesHandler:         companiesHandler,
		WarehousesHandler:        warehousesHandler,
		PosHandler:               posHandler,
		ProductsHandler:          productsHandler,
		CategoriesHandler:        categoriesHandler,
		VariantsHandler:          variantsHandler,
		StockHandler:             stockHandler,
		NotificationsHandler:     notificationsHandler,
		UsersHandler:             usersHandler,
		SupportHandler:           supportHandler,
		ExpensesHandler:          expensesHandler,
		GoodsReceiptsHandler:     goodsReceiptsHandler,
		RetailCustomersHandler:   retailCustomersHandler,
		RetailReceivablesHandler: retailReceivablesHandler,
		PartnersHandler:          partnersHandler,
		B2BOrdersHandler:         b2bOrdersHandler,
		IncomeHandler:            incomeHandler,
		ProductMappingsHandler:   productMappingsHandler,
		DebtsHandler:             debtsHandler,
		TasksHandler:             tasksHandler,
		WorkflowsHandler:         workflowsHandler,
		AuditLogsHandler:         auditLogsHandler,
		UploadsHandler:           uploadsHandler,
		PickTasksHandler:         pickTasksHandler,
		DispatchesHandler:        dispatchesHandler,
		OnboardingHandler:        onboardingHandler,
		PayrollHandler:           payrollHandler,
		ReportsHandler:           reportsHandler,
		InventoryCountsHandler:   inventoryCountsHandler,
		WarehouseIntakeHandler:   warehouseIntakeHandler,
		PartnerLedgerHandler:     partnerLedgerHandler,
		PlatformHandler:          platformHandler,
		FieldHandler:             fieldHandler,
		TelegramHandler:          telegramHandler,
		InvoicesHandler:          invoicesHandler,
		StorefrontHandler:        storefrontHandler,
	})

	handler := rt.Wrap(apiHandler)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Go backend v1.0 (standalone): http://localhost:%s/api", cfg.Port)
		log.Printf("Socket.IO: /socket.io (/inventory, /notifications)")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	workerCancel()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
