package reports

import (
	"strconv"
	"strings"
	"time"
)

type currencyBucket struct {
	UZS float64 `json:"UZS"`
	USD float64 `json:"USD"`
}

func newBucket() currencyBucket {
	return currencyBucket{UZS: 0, USD: 0}
}

func normCurrency(v string) string {
	if strings.EqualFold(strings.TrimSpace(v), "USD") {
		return "USD"
	}
	return "UZS"
}

func bucketAdd(bucket *currencyBucket, currency string, amount float64) {
	if normCurrency(currency) == "USD" {
		bucket.USD += amount
		return
	}
	bucket.UZS += amount
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func roundedBucket(b currencyBucket) currencyBucket {
	return currencyBucket{
		UZS: round2(b.UZS),
		USD: round2(b.USD),
	}
}

func firstNonEmpty(values ...*string) *string {
	for _, v := range values {
		if v == nil {
			continue
		}
		if strings.TrimSpace(*v) != "" {
			return v
		}
	}
	return nil
}

func ptrTrimmed(v string) *string {
	s := strings.TrimSpace(v)
	if s == "" {
		return nil
	}
	return &s
}

func parseIntOrDefault(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return n
}

func parseDateForFilter(v *string, endOfDay bool) *time.Time {
	t := parseDateInput(v)
	if t.IsZero() {
		return nil
	}
	if endOfDay {
		x := endOfUTCDay(t)
		return &x
	}
	x := startOfUTCDay(t)
	return &x
}
