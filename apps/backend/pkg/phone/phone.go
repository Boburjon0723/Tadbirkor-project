package phone

import (
	"regexp"
	"strings"
)

var digitsOnly = regexp.MustCompile(`\D`)

// NormalizeUzPhone — NestJS normalizeUzPhone bilan 1:1.
func NormalizeUzPhone(raw string) string {
	digits := digitsOnly.ReplaceAllString(strings.TrimSpace(raw), "")
	if digits == "" {
		return ""
	}
	normalized := digits
	if strings.HasPrefix(normalized, "998") {
		normalized = normalized[3:]
	} else if strings.HasPrefix(normalized, "8") && len(normalized) >= 10 {
		normalized = normalized[1:]
	}
	if len(normalized) == 9 {
		return "+998" + normalized
	}
	if len(normalized) == 12 && strings.HasPrefix(normalized, "998") {
		return "+" + normalized
	}
	return ""
}
