package reports

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

const msPerDay = 24 * time.Hour

type ParsedDateRange struct {
	DateFrom  string
	DateTo    string
	GTE       time.Time
	LTE       time.Time
	Days      int
	Capped    bool
	Defaulted bool
}

func getReportDefaultRangeDays() int {
	return envIntInRange("REPORT_DEFAULT_RANGE_DAYS", 90, 7, 365)
}

func getReportMaxRangeDays() int {
	return envIntInRange("REPORT_MAX_RANGE_DAYS", 366, 30, 730)
}

func getReportMaxMovementRows() int {
	return envIntInRange("REPORT_MAX_MOVEMENT_ROWS", 25000, 1000, 200000)
}

func envIntInRange(key string, fallback, min, max int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < min || n > max {
		return fallback
	}
	return n
}

func parseReportDateRange(query ReportQueryInput) (ParsedDateRange, error) {
	maxDays := getReportMaxRangeDays()
	defaultDays := getReportDefaultRangeDays()

	to := parseDateInput(query.DateTo)
	from := parseDateInput(query.DateFrom)
	defaulted := false
	capped := false

	switch {
	case to.IsZero() && from.IsZero():
		to = time.Now().UTC()
		from = to.AddDate(0, 0, -defaultDays)
		defaulted = true
	case to.IsZero():
		to = time.Now().UTC()
	case from.IsZero():
		from = to.AddDate(0, 0, -defaultDays)
		defaulted = true
	}

	if from.After(to) {
		return ParsedDateRange{}, errors.New("dateFrom dateTo dan katta bo'lishi mumkin emas")
	}

	gte := startOfUTCDay(from)
	lte := endOfUTCDay(to)
	spanDays := int(lte.Sub(gte)/msPerDay) + 1

	if spanDays > maxDays {
		gte = startOfUTCDay(lte.AddDate(0, 0, -(maxDays - 1)))
		capped = true
	}

	days := int(lte.Sub(gte)/msPerDay) + 1
	return ParsedDateRange{
		DateFrom:  gte.Format("2006-01-02"),
		DateTo:    lte.Format("2006-01-02"),
		GTE:       gte,
		LTE:       lte,
		Days:      days,
		Capped:    capped,
		Defaulted: defaulted,
	}, nil
}

func parseDateInput(v *string) time.Time {
	if v == nil {
		return time.Time{}
	}
	raw := strings.TrimSpace(*v)
	if raw == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC()
	}
	if t, err := time.Parse("2006-01-02", strings.Split(raw, "T")[0]); err == nil {
		return t.UTC()
	}
	return time.Time{}
}

func startOfUTCDay(t time.Time) time.Time {
	x := t.UTC()
	return time.Date(x.Year(), x.Month(), x.Day(), 0, 0, 0, 0, time.UTC)
}

func endOfUTCDay(t time.Time) time.Time {
	x := t.UTC()
	return time.Date(x.Year(), x.Month(), x.Day(), 23, 59, 59, int(time.Millisecond*999), time.UTC)
}
