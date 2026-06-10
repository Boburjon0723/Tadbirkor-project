package platform

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type companySubRow struct {
	SubscriptionStatus string
	TrialEndsAt        *time.Time
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

func resolveSubscriptionAccess(c companySubRow) map[string]any {
	status := strings.ToUpper(c.SubscriptionStatus)
	if status != "ACTIVE" && status != "EXPIRED" {
		status = "TRIAL"
	}
	trialActive := c.TrialEndsAt != nil && time.Now().Before(*c.TrialEndsAt)
	if status == "ACTIVE" {
		return map[string]any{"status": "ACTIVE", "canWrite": true, "trialActive": false, "labelUz": "Faol obuna"}
	}
	if status == "TRIAL" && trialActive {
		return map[string]any{"status": "TRIAL", "canWrite": true, "trialActive": true, "labelUz": "Bepul sinov"}
	}
	return map[string]any{"status": "EXPIRED", "canWrite": false, "trialActive": false, "labelUz": "Sinov tugagan"}
}
