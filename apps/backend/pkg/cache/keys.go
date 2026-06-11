package cache

import (
	"fmt"
	"strings"
)

func DashboardStatsKey(companyID string) string {
	return "dashboard:stats:" + strings.TrimSpace(companyID)
}

// PosCatalogPrefix — pos:catalog:{company}:{warehouse}: yoki warehouse bo‘sh bo‘lsa butun kompaniya.
func PosCatalogPrefix(companyID, warehouseID string) string {
	cid := strings.TrimSpace(companyID)
	wid := strings.TrimSpace(warehouseID)
	if wid != "" {
		return fmt.Sprintf("pos:catalog:%s:%s:", cid, wid)
	}
	return fmt.Sprintf("pos:catalog:%s:", cid)
}

func CategoriesPrefix(companyID string) string {
	return fmt.Sprintf("categories:%s:", strings.TrimSpace(companyID))
}

func OrdersHubStatsKey(companyID string) string {
	return "orders:hub:" + strings.TrimSpace(companyID)
}

func OrdersListPrefix(companyID string) string {
	return "orders:list:" + strings.TrimSpace(companyID) + ":"
}

func InventoryCountsListKey(companyID, warehouseID, status string) string {
	cid := strings.TrimSpace(companyID)
	wh := strings.TrimSpace(warehouseID)
	if wh == "" {
		wh = "_"
	}
	st := strings.ToUpper(strings.TrimSpace(status))
	if st == "" {
		st = "_"
	}
	return fmt.Sprintf("inv-counts:%s:%s:%s", cid, wh, st)
}

func InventoryCountsListPrefix(companyID string) string {
	return "inv-counts:" + strings.TrimSpace(companyID) + ":"
}

func RetailSummaryKey(companyID string) string {
	return "retail-summary:" + strings.TrimSpace(companyID)
}

func RetailLedgerKey(companyID, customerID string) string {
	return fmt.Sprintf("retail-ledger:%s:%s", strings.TrimSpace(companyID), strings.TrimSpace(customerID))
}

func ActiveWarehouseCountKey(companyID string) string {
	return "company:" + strings.TrimSpace(companyID) + ":active-warehouse-count"
}

func CompanyFeaturesKey(companyID string) string {
	return "company:features:" + strings.TrimSpace(companyID)
}

func ProductsListPrefix(companyID string) string {
	return "products:list:" + strings.TrimSpace(companyID) + ":"
}

func WarehousesListPrefix(companyID string) string {
	return "warehouses:list:" + strings.TrimSpace(companyID) + ":"
}

func VariantsSearchPrefix(companyID string) string {
	return "variants:search:" + strings.TrimSpace(companyID) + ":"
}
