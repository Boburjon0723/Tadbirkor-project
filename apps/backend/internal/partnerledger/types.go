package partnerledger

import "math"

var OperationTypes = []string{
	"MATERIAL_IN", "SALE_OUT", "RECEIPT_FROM_PARTNER", "PAYMENT_TO_PARTNER",
}

var OperationTypeLabels = map[string]string{
	"MATERIAL_IN":          "Kirim (xomashyo)",
	"SALE_OUT":             "Sotish / chiqim",
	"RECEIPT_FROM_PARTNER": "Hamkordan tushum",
	"PAYMENT_TO_PARTNER":   "Hamkorga to'lov",
}

var SettlementLabels = map[string]string{
	"on_credit": "Qarzga (keyin to'lov)",
	"cash":      "Naqd pul",
	"card":      "Karta / o'tkazma",
	"barter":    "Bartar (boshqa tovar yoki almashtirish)",
	"partial":   "Qisman to'lov",
	"promised":  "Kelishilgan muddat / va'da",
}

func NormalizeCurrency(currency string) string {
	if currency == "USD" {
		return "USD"
	}
	return "UZS"
}

// BalanceDelta — musbat = ular bizga qarz; manfiy = biz ularga qarz.
func BalanceDelta(opType string, amount float64) float64 {
	n := math.Abs(amount)
	switch opType {
	case "MATERIAL_IN", "RECEIPT_FROM_PARTNER":
		return -n
	case "SALE_OUT", "PAYMENT_TO_PARTNER":
		return n
	default:
		return 0
	}
}

func computeBalances(ops []opBalanceRow) map[string]float64 {
	totals := map[string]float64{}
	for _, op := range ops {
		cur := NormalizeCurrency(op.Currency)
		totals[cur] += BalanceDelta(op.Type, op.Amount)
	}
	return totals
}

func balanceSide(totals map[string]float64) string {
	uzs := totals["UZS"]
	usd := totals["USD"]
	if math.Abs(uzs) < 0.01 && math.Abs(usd) < 0.01 {
		return "settled"
	}
	if uzs < 0 || usd < 0 {
		return "we_owe"
	}
	if uzs > 0 || usd > 0 {
		return "they_owe"
	}
	return "settled"
}

type opBalanceRow struct {
	Type     string
	Amount   float64
	Currency string
}

type amountLine struct {
	Amount   float64
	Currency string
}
