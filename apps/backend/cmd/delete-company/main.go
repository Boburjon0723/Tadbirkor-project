package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/tadbirkor/axis-erp/backend/pkg/db"
)

func main() {
	_ = godotenv.Overload()
	if len(os.Args) < 2 {
		fmt.Println("Ishlatish: go run ./cmd/delete-company <company_id>")
		fmt.Println("Ro'yxat:   go run ./cmd/list-companies")
		os.Exit(1)
	}
	companyID := strings.TrimSpace(os.Args[1])

	ctx := context.Background()
	pool, err := db.NewPool(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	var name string
	if err := pool.QueryRow(ctx, `SELECT name FROM "Company" WHERE id = $1`, companyID).Scan(&name); err != nil {
		panic(fmt.Sprintf("Kompaniya topilmadi: %v", err))
	}
	fmt.Printf("O'chirilmoqda: %s (%s)\n", name, companyID)

	tx, err := pool.Begin(ctx)
	if err != nil {
		panic(err)
	}
	defer tx.Rollback(ctx)

	exec := func(label, q string, args ...any) {
		tag, err := tx.Exec(ctx, q, args...)
		if err != nil {
			panic(fmt.Sprintf("%s: %w", label, err))
		}
		if n := tag.RowsAffected(); n > 0 {
			fmt.Printf("  %s: %d qator\n", label, n)
		}
	}

	// Bildirishnomalar, audit
	exec(`NotificationDelivery`, `DELETE FROM "NotificationDelivery" WHERE "companyId" = $1`, companyID)
	exec(`Notification`, `DELETE FROM "Notification" WHERE "userId" IN (SELECT "userId" FROM "CompanyUser" WHERE "companyId" = $1)`, companyID)
	exec(`AuditLog`, `DELETE FROM "AuditLog" WHERE "companyId" = $1`, companyID)
	exec(`Task`, `DELETE FROM "Task" WHERE "companyId" = $1`, companyID)
	exec(`TelegramActionRecord`, `DELETE FROM "TelegramActionRecord" WHERE "companyId" = $1`, companyID)
	exec(`TelegramChatBinding`, `DELETE FROM "TelegramChatBinding" WHERE "companyId" = $1`, companyID)

	// Payroll / leave
	exec(`EmployeePayrollSettlement`, `DELETE FROM "EmployeePayrollSettlement" WHERE "companyId" = $1`, companyID)
	exec(`EmployeePayrollAdvance`, `DELETE FROM "EmployeePayrollAdvance" WHERE "companyId" = $1`, companyID)
	exec(`EmployeeCompensation`, `DELETE FROM "EmployeeCompensation" WHERE "companyId" = $1`, companyID)
	exec(`EmployeeWorkMonth`, `DELETE FROM "EmployeeWorkMonth" WHERE "companyId" = $1`, companyID)
	exec(`EmployeeLeaveRequest`, `DELETE FROM "EmployeeLeaveRequest" WHERE "companyId" = $1`, companyID)
	exec(`EmployeePayrollProfile`, `DELETE FROM "EmployeePayrollProfile" WHERE "companyUserId" IN (SELECT id FROM "CompanyUser" WHERE "companyId" = $1)`, companyID)
	exec(`PayrollCompanySettings`, `DELETE FROM "PayrollCompanySettings" WHERE "companyId" = $1`, companyID)

	// Field
	exec(`FieldTaskApproval`, `DELETE FROM "FieldTaskApproval" WHERE "fieldTaskId" IN (SELECT id FROM "FieldTask" WHERE "companyId" = $1)`, companyID)
	exec(`FieldTaskReport`, `DELETE FROM "FieldTaskReport" WHERE "fieldTaskId" IN (SELECT id FROM "FieldTask" WHERE "companyId" = $1)`, companyID)
	exec(`FieldTask`, `DELETE FROM "FieldTask" WHERE "companyId" = $1`, companyID)

	// Retail / POS
	exec(`RetailReceivablePayment`, `DELETE FROM "RetailReceivablePayment" WHERE "receivableId" IN (SELECT id FROM "RetailReceivable" WHERE "companyId" = $1)`, companyID)
	exec(`RetailReceivable`, `DELETE FROM "RetailReceivable" WHERE "companyId" = $1`, companyID)
	exec(`RetailCustomerLedgerEntry`, `DELETE FROM "RetailCustomerLedgerEntry" WHERE "companyId" = $1`, companyID)
	exec(`PosPayment`, `DELETE FROM "PosPayment" WHERE "saleId" IN (SELECT id FROM "PosSale" WHERE "companyId" = $1)`, companyID)
	exec(`PosSaleItem`, `DELETE FROM "PosSaleItem" WHERE "saleId" IN (SELECT id FROM "PosSale" WHERE "companyId" = $1)`, companyID)
	exec(`PosSale`, `DELETE FROM "PosSale" WHERE "companyId" = $1`, companyID)
	exec(`RetailCustomer`, `DELETE FROM "RetailCustomer" WHERE "companyId" = $1`, companyID)

	// Partner ledger
	exec(`PartnerLedgerSaleOrderStatus`, `DELETE FROM "PartnerLedgerSaleOrderStatus" WHERE "companyId" = $1`, companyID)
	exec(`PartnerLedgerOperation`, `DELETE FROM "PartnerLedgerOperation" WHERE "companyId" = $1`, companyID)
	exec(`PartnerLedgerContact`, `DELETE FROM "PartnerLedgerContact" WHERE "companyId" = $1`, companyID)

	// Moliya
	exec(`Expense`, `DELETE FROM "Expense" WHERE "companyId" = $1`, companyID)
	exec(`ExpenseCategory`, `DELETE FROM "ExpenseCategory" WHERE "companyId" = $1`, companyID)
	exec(`Income`, `DELETE FROM "Income" WHERE "companyId" = $1`, companyID)
	exec(`IncomeCategory`, `DELETE FROM "IncomeCategory" WHERE "companyId" = $1`, companyID)
	exec(`DebtPaymentRecord`, `DELETE FROM "DebtPaymentRecord" WHERE "debtEntryId" IN (SELECT id FROM "DebtEntry" WHERE "debtorId" = $1 OR "creditorId" = $1)`, companyID)
	exec(`DebtEntry`, `DELETE FROM "DebtEntry" WHERE "debtorId" = $1 OR "creditorId" = $1`, companyID)

	// B2B / logistika
	exec(`Invoice`, `DELETE FROM "Invoice" WHERE "orderId" IN (SELECT id FROM "B2BOrder" WHERE "buyerCompanyId" = $1 OR "sellerCompanyId" = $1)`, companyID)
	exec(`GoodsReceiptItem`, `DELETE FROM "GoodsReceiptItem" WHERE "receiptId" IN (SELECT id FROM "GoodsReceipt" WHERE "buyerCompanyId" = $1 OR "sellerCompanyId" = $1)`, companyID)
	exec(`GoodsReceipt`, `DELETE FROM "GoodsReceipt" WHERE "buyerCompanyId" = $1 OR "sellerCompanyId" = $1`, companyID)
	exec(`PickTask`, `DELETE FROM "PickTask" WHERE "companyId" = $1`, companyID)
	exec(`DispatchItem`, `DELETE FROM "DispatchItem" WHERE "dispatchId" IN (SELECT id FROM "Dispatch" WHERE "sellerCompanyId" = $1 OR "buyerCompanyId" = $1)`, companyID)
	exec(`Dispatch`, `DELETE FROM "Dispatch" WHERE "sellerCompanyId" = $1 OR "buyerCompanyId" = $1`, companyID)
	exec(`B2BOrderItem`, `DELETE FROM "B2BOrderItem" WHERE "orderId" IN (SELECT id FROM "B2BOrder" WHERE "buyerCompanyId" = $1 OR "sellerCompanyId" = $1)`, companyID)
	exec(`B2BOrder`, `DELETE FROM "B2BOrder" WHERE "buyerCompanyId" = $1 OR "sellerCompanyId" = $1`, companyID)

	// Ombor / mahsulot
	exec(`ProductImportStagingRow`, `DELETE FROM "ProductImportStagingRow" WHERE "jobId" IN (SELECT id FROM "ProductImportJob" WHERE "companyId" = $1)`, companyID)
	exec(`ProductImportJob`, `DELETE FROM "ProductImportJob" WHERE "companyId" = $1`, companyID)
	exec(`ProductMapping`, `DELETE FROM "ProductMapping" WHERE "companyId" = $1`, companyID)
	exec(`UserStock`, `DELETE FROM "UserStock" WHERE "companyId" = $1`, companyID)
	exec(`StockMovement`, `DELETE FROM "StockMovement" WHERE "companyId" = $1`, companyID)
	exec(`StockBalance`, `DELETE FROM "StockBalance" WHERE "companyId" = $1`, companyID)
	exec(`ProductVariant`, `DELETE FROM "ProductVariant" WHERE "companyId" = $1`, companyID)
	exec(`Product`, `DELETE FROM "Product" WHERE "companyId" = $1`, companyID)
	exec(`ProductCategory`, `DELETE FROM "ProductCategory" WHERE "companyId" = $1`, companyID)
	exec(`InventoryCountItem`, `DELETE FROM "InventoryCountItem" WHERE "inventoryCountId" IN (SELECT id FROM "InventoryCount" WHERE "companyId" = $1)`, companyID)
	exec(`InventoryCount`, `DELETE FROM "InventoryCount" WHERE "companyId" = $1`, companyID)
	exec(`WarehouseIntakeLine`, `DELETE FROM "WarehouseIntakeLine" WHERE "intakeId" IN (SELECT id FROM "WarehouseIntake" WHERE "companyId" = $1)`, companyID)
	exec(`WarehouseIntake`, `DELETE FROM "WarehouseIntake" WHERE "companyId" = $1`, companyID)
	exec(`StockBlock`, `DELETE FROM "StockBlock" WHERE "companyId" = $1`, companyID)

	// Workflow / features
	exec(`WorkflowStep`, `DELETE FROM "WorkflowStep" WHERE "workflowDefinitionId" IN (SELECT id FROM "WorkflowDefinition" WHERE "companyId" = $1)`, companyID)
	exec(`WorkflowDefinition`, `DELETE FROM "WorkflowDefinition" WHERE "companyId" = $1`, companyID)
	exec(`CompanyFeature`, `DELETE FROM "CompanyFeature" WHERE "companyId" = $1`, companyID)

	exec(`Partner`, `DELETE FROM "Partner" WHERE "ownerCompanyId" = $1 OR "partnerCompanyId" = $1`, companyID)
	exec(`Warehouse`, `DELETE FROM "Warehouse" WHERE "companyId" = $1`, companyID)

	// Foydalanuvchilar — faqat shu kompaniyaga tegishli bo'lsa
	userIDs, err := collectOrphanUserIDs(ctx, tx, companyID)
	if err != nil {
		panic(err)
	}
	exec(`CompanyUser`, `DELETE FROM "CompanyUser" WHERE "companyId" = $1`, companyID)
	exec(`Company`, `DELETE FROM "Company" WHERE id = $1`, companyID)
	for _, uid := range userIDs {
		exec(`User `+uid, `DELETE FROM "User" WHERE id = $1`, uid)
	}

	if err := tx.Commit(ctx); err != nil {
		panic(err)
	}
	fmt.Println("Tayyor — kompaniya va bog'liq foydalanuvchilar o'chirildi.")
}

func collectOrphanUserIDs(ctx context.Context, tx pgx.Tx, companyID string) ([]string, error) {
	rows, err := tx.Query(ctx, `SELECT DISTINCT "userId" FROM "CompanyUser" WHERE "companyId" = $1`, companyID)
	if err != nil {
		return nil, err
	}
	var candidates []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		candidates = append(candidates, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var ids []string
	for _, id := range candidates {
		var other int
		err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM "CompanyUser" WHERE "userId" = $1 AND "companyId" <> $2`, id, companyID).Scan(&other)
		if err != nil {
			return nil, err
		}
		if other == 0 {
			ids = append(ids, id)
		}
	}
	return ids, nil
}
