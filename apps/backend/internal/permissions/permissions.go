package permissions

import "strings"

// NestJS Permission enum bilan 1:1 (role-permissions.ts)
var allPermissions = []string{
	"products.view", "products.create", "products.update", "products.delete",
	"products.view_price", "products.update_price",
	"warehouse.view", "warehouse.create", "warehouse.update", "warehouse.delete",
	"warehouse.receive", "warehouse.dispatch", "warehouse.adjust", "warehouse.transfer", "warehouse.manage",
	"partners.view", "partners.manage",
	"product_mappings.view", "product_mappings.manage",
	"orders.view", "orders.create", "orders.send", "orders.accept", "orders.reject",
	"dispatches.view", "dispatches.create", "dispatches.send", "dispatches.cancel",
	"goods_receipts.view", "goods_receipts.accept", "goods_receipts.reject",
	"debt.view", "debt.create_payment", "debt.confirm_payment", "debt.reject_payment",
	"expenses.view", "expenses.create", "expenses.manage", "expenses.approve", "expenses.reject",
	"income.view", "income.create", "income.manage",
	"partner_ledger.view", "partner_ledger.manage",
	"reports.view", "reports.export",
	"tasks.view", "tasks.manage", "tasks.assign",
	"settings.manage", "users.manage",
	"pos.view", "pos.create", "pos.void", "pos.change_price", "pos.override_price", "pos.credit",
	"payroll.view", "payroll.manage",
	"field.task.create", "field.task.assign", "field.task.approve", "field.task.view_all",
	"field.stock.view_all", "field.task.view_own", "field.task.accept", "field.task.report", "field.stock.view_own",
}

var fieldManagerPerms = []string{
	"field.task.create", "field.task.assign", "field.task.approve", "field.task.view_all", "field.stock.view_all",
}

var rolePermissions = map[string][]string{
	"OWNER": allPermissions,
	"MANAGER": append(concat(
		"products.view", "products.create", "products.update",
		"warehouse.view", "warehouse.receive", "warehouse.dispatch",
		"partners.view", "partners.manage",
		"product_mappings.view", "product_mappings.manage",
		"orders.view", "orders.create", "orders.send", "orders.accept",
		"dispatches.view", "dispatches.create", "dispatches.send",
		"goods_receipts.view", "goods_receipts.accept",
		"debt.view",
		"expenses.view", "expenses.create", "expenses.manage", "expenses.approve", "expenses.reject",
		"income.view", "income.create", "income.manage",
		"partner_ledger.view", "partner_ledger.manage",
		"reports.view",
		"tasks.view", "tasks.manage", "tasks.assign",
		"pos.view", "pos.create", "pos.void", "pos.change_price", "pos.override_price", "pos.credit",
		"users.manage",
		"payroll.view", "payroll.manage",
	), fieldManagerPerms...),
	"WAREHOUSE": concat(
		"products.view", "warehouse.view", "warehouse.receive", "warehouse.dispatch", "warehouse.adjust",
		"goods_receipts.view", "goods_receipts.accept",
		"tasks.view",
		"field.task.create", "field.task.assign", "field.task.view_all", "field.stock.view_all",
		"payroll.view",
	),
	"ACCOUNTANT": concat(
		"products.view", "warehouse.view", "debt.view", "debt.confirm_payment",
		"expenses.view", "expenses.create", "expenses.approve", "expenses.reject",
		"income.view", "income.create", "income.manage",
		"partner_ledger.view", "partner_ledger.manage",
		"reports.view", "reports.export",
		"tasks.view", "pos.view",
		"payroll.view", "payroll.manage",
	),
	"SALES": concat(
		"products.view", "warehouse.view",
		"orders.view", "orders.create",
		"tasks.view",
		"pos.view", "pos.create",
		"payroll.view",
	),
	"FIELD_WORKER": concat(
		"field.task.view_own", "field.task.accept", "field.task.report", "field.stock.view_own",
		"products.view", "warehouse.view", "payroll.view",
	),
	"WORKER": {"products.view", "tasks.view", "payroll.view"},
}

func concat(items ...any) []string {
	out := []string{}
	for _, item := range items {
		switch v := item.(type) {
		case string:
			out = append(out, v)
		case []string:
			out = append(out, v...)
		}
	}
	return out
}

func Effective(role string, grant, deny []string) []string {
	base := map[string]struct{}{}
	for _, p := range rolePermissions[strings.ToUpper(role)] {
		base[p] = struct{}{}
	}
	for _, p := range deny {
		delete(base, p)
	}
	allSet := map[string]struct{}{}
	for _, p := range allPermissions {
		allSet[p] = struct{}{}
	}
	for _, p := range grant {
		if _, ok := allSet[p]; ok {
			base[p] = struct{}{}
		}
	}
	out := make([]string, 0, len(base))
	for p := range base {
		out = append(out, p)
	}
	return out
}

func RoleAllowsAllWarehouses(role string) bool {
	switch strings.ToUpper(role) {
	case "OWNER", "MANAGER", "ACCOUNTANT":
		return true
	default:
		return false
	}
}
