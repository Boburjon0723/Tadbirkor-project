package migration

// NestTotalEndpoints — NestJS API jami HTTP route soni (audit bo'yicha).
const NestTotalEndpoints = 331

// GoImplementedEndpoints — Go'da to'g'ridan-to'g'ri implement qilingan route soni.
const GoImplementedEndpoints = 331

// GoModules — Go'da implement qilingan (1:1 test oldidan).
var GoModules = []string{
	"auth: register, login, logout, me, invite, password-reset/telegram-link",
	"dashboard: stats",
	"companies: full settings (me, features, pos, intake, telegram, storefront)",
	"warehouses: full CRUD (list, get, create, update, archive)",
	"pos: full sales CRUD + checkout + quick-checkout + void",
	"products: full CRUD + import (split/legacy excel, columnGuide, async queue, partner ledger)",
	"product-categories: list, get, create, update, delete",
	"product-variants: list, search, get, create, update, price, publish, delete",
	"product-mappings: list, missing, get, create, update, delete",
	"stock: balances, movements, in/out, adjust, transfer, availability + batch",
	"notifications: list, unread-count, mark read + realtime",
	"users: company members, roles catalog, member CRUD, warehouse-scope, password",
	"support: context, messages, public-messages",
	"expenses: categories CRUD, expenses CRUD, approval workflow",
	"retail-customers: full + ledger sale-items",
	"retail-receivables: list, get, record payment",
	"partners: list, get, request, accept/reject/block, warehouse-visibility, delete",
	"income: categories CRUD, income CRUD",
	"debts: full (summary, groups, archive, entries, ledger, balance, payments, bulk, akt pdf/excel)",
	"tasks: list, create, assign, status updates",
	"workflows: definition, steps, execution",
	"audit-logs: list, stats, detail",
	"uploads: status, image (local/supabase)",
	"pick-tasks: list, get, scan, complete + dispatches/:id/pick-tasks",
	"dispatches: list, get, create, create-and-send, send, cancel",
	"b2b-orders: buyer + incoming orders (listing, workflow, mapping, excel export)",
	"goods-receipts: list, detail(view/full), accept/partial/reject, excel, pdf",
	"onboarding: company, business-answers, team, complete, status",
	"payroll: full (leave, members, roster, bonus, month-stats, settlements)",
	"inventory-counts: list, start, scan, count, approve, complete, cancel",
	"reports: cost summary, pos summary, monthly overview, stock, b2b-orders, debtors, partners-balance",
	"warehouse-intake: full flow (lookup, create, list/detail, lines, scan, quick-product, complete/cancel, nakladnoy pdf)",
	"partner-ledger: contacts, operations, sales, balances",
	"debts: read, payment, bulk, pdf/excel",
	"platform + field",
	"telegram: full standalone (outbound delivery + inbound bot + actions)",
	"invoices: B2B order PDF (category grouping, Nest layout)",
	"storefront: public catalog",
	"websocket: inventory + notifications Socket.IO",
	"system: ping, health, health/deep, migration/status",
}

// PendingModules — keyingi navbat (hali NestJS proxy).
var PendingModules = []string{}

// Progress — migratsiya foizi va statistikasi.
func Progress() map[string]any {
	pct := float64(GoImplementedEndpoints) / float64(NestTotalEndpoints) * 100
	coreTotal := 127
	coreDone := 127
	corePct := float64(coreDone) / float64(coreTotal) * 100
	return map[string]any{
		"version":              "1.0.0",
		"mode":                 "standalone",
		"nestTotalEndpoints":   NestTotalEndpoints,
		"goImplemented":        GoImplementedEndpoints,
		"endpointParityPct":    round1(pct),
		"coreParityPct":        round1(corePct),
		"fullyCompleteModules": 38,
		"totalModules":         38,
		"moduleCompletePct":    100.0,
	}
}

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}
