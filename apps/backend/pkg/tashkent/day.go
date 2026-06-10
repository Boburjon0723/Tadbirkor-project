package tashkent

import (
	"fmt"
	"time"
)

const offset = 5 * time.Hour

type DayRange struct {
	Start     time.Time
	End       time.Time
	DateLabel string
}

func DayRangeNow() DayRange {
	ref := time.Now().UTC().Add(offset)
	y, m, d := ref.Date()
	start := time.Date(y, m, d, 0, 0, 0, 0, time.UTC).Add(-offset)
	end := time.Date(y, m, d, 23, 59, 59, 999999999, time.UTC).Add(-offset)
	return DayRange{
		Start:     start,
		End:       end,
		DateLabel: fmt.Sprintf("%02d.%02d.%d", d, int(m), y),
	}
}
