package telegram

import (
	"encoding/json"
	"fmt"
	"strings"
)

var skipDetailKeys = map[string]bool{
	"paymentIds": true, "allocations": true, "payload": true, "newData": true, "oldData": true,
	"entityId": true, "targetId": true, "userId": true, "companyId": true, "partnerCompanyId": true, "debtEntryId": true,
}

var detailLabels = map[string]string{
	"appliedTotal": "Summa", "confirmedTotal": "Tasdiqlangan summa", "amount": "Summa",
	"remainingAmount": "Qolgan qarz", "currency": "Valyuta", "debtor": "Qarzdor", "creditor": "Haqdor",
	"seller": "Sotuvchi", "buyer": "Xaridor", "hamkor": "Hamkor", "orderId": "Buyurtma", "status": "Holat",
	"batchId": "Buyurtma raqami", "totalQty": "Miqdor", "totals": "Jami",
}

func formatTelegramMessage(title, message, ntype string, details map[string]any, hasActions bool) string {
	emoji := "🔔"
	switch strings.ToUpper(ntype) {
	case "ERROR":
		emoji = "❗️"
	case "WARNING":
		emoji = "⚠️"
	case "SUCCESS":
		emoji = "✅"
	}
	lines := []string{emoji + " " + title, "", message}
	if extra := formatDetailLines(details); len(extra) > 0 {
		lines = append(lines, "", "────────────")
		lines = append(lines, extra...)
	}
	if hasActions {
		lines = append(lines, "", "👇 Quyidagi tugmalardan harakat tanlang.")
	}
	return strings.Join(lines, "\n")
}

func formatDetailLines(details map[string]any) []string {
	if len(details) == 0 {
		return nil
	}
	lines := []string{}
	for k, v := range details {
		if skipDetailKeys[k] || v == nil {
			continue
		}
		label := detailLabels[k]
		if label == "" {
			label = k
		}
		switch val := v.(type) {
		case string:
			if val != "" {
				lines = append(lines, "• "+label+": "+val)
			}
		case float64, int, int64:
			lines = append(lines, "• "+label+": "+fmt.Sprint(val))
		default:
			if b, err := json.Marshal(val); err == nil {
				s := string(b)
				if s != "null" && s != "{}" && s != "[]" {
					lines = append(lines, "• "+label+": "+s)
				}
			}
		}
	}
	return lines
}

func formatTelegramMoney(amount float64, currency string) string {
	cur := strings.ToUpper(currency)
	if cur == "" {
		cur = "UZS"
	}
	if cur == "USD" {
		return fmt.Sprintf("%.2f USD", amount)
	}
	return formatMoneyUZS(amount)
}
