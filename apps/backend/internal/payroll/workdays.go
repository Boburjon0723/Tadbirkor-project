package payroll

import (
	"fmt"
	"time"
)

func countWeekdaysInMonth(year, month int) int {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	count := 0
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		wd := d.Weekday()
		if wd != time.Saturday && wd != time.Sunday {
			count++
		}
	}
	return count
}

func parseDateOnly(input string) (time.Time, error) {
	s := input
	if len(s) > 10 {
		s = s[:10]
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, fmt.Errorf("noto'g'ri sana")
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
}

func addDaysUTC(d time.Time, days int) time.Time {
	next := d.AddDate(0, 0, days)
	return time.Date(next.Year(), next.Month(), next.Day(), 0, 0, 0, 0, time.UTC)
}

func endDateFromStartAndDays(start time.Time, daysCount int) time.Time {
	if daysCount < 1 {
		daysCount = 1
	}
	return addDaysUTC(start, daysCount-1)
}

func countWeekdaysInclusive(start, end time.Time) int {
	a := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	b := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	if b.Before(a) {
		return 0
	}
	count := 0
	for d := a; !d.After(b); d = d.AddDate(0, 0, 1) {
		wd := d.Weekday()
		if wd != time.Saturday && wd != time.Sunday {
			count++
		}
	}
	return count
}

func countLeaveWeekdaysInMonth(start, end time.Time, year, month int) int {
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	a := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	b := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	from := a
	if monthStart.After(from) {
		from = monthStart
	}
	to := b
	if monthEnd.Before(to) {
		to = monthEnd
	}
	if to.Before(from) {
		return 0
	}
	return countWeekdaysInclusive(from, to)
}

func monthsTouchedByRange(start, end time.Time) []struct{ Year, Month int } {
	a := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	b := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	out := []struct{ Year, Month int }{}
	y, m := a.Year(), int(a.Month())
	endY, endM := b.Year(), int(b.Month())
	for y < endY || (y == endY && m <= endM) {
		out = append(out, struct{ Year, Month int }{y, m})
		m++
		if m > 12 {
			m = 1
			y++
		}
	}
	return out
}

func defaultYearMonth(year, month int) (int, int) {
	now := time.Now().UTC()
	if year <= 0 {
		year = now.Year()
	}
	if month <= 0 {
		month = int(now.Month())
	}
	return year, month
}

func dateOnlyString(t time.Time) string {
	return t.Format("2006-01-02")
}
