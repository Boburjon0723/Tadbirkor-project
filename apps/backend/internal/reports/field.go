package reports

import (
	"context"
	"encoding/json"
	"sort"
)

type fieldReportItem struct {
	UsedQty     float64 `json:"usedQty"`
	ReturnedQty float64 `json:"returnedQty"`
	LostQty     float64 `json:"lostQty"`
}

func (s *Service) GetFieldWorkerInstallations(
	ctx context.Context,
	companyID string,
	query ReportQueryInput,
) (map[string]any, error) {
	enabled, err := s.companies.IsModuleEnabled(ctx, companyID, "FIELD_SERVICE")
	if err != nil {
		return nil, err
	}
	if !enabled {
		return map[string]any{
			"period":  map[string]any{"from": query.DateFrom, "to": query.DateTo},
			"workers": []map[string]any{},
		}, nil
	}

	rng, err := parseReportDateRange(query)
	if err != nil {
		return nil, err
	}

	type workerAgg struct {
		UserID      string
		Name        string
		TasksTotal  int
		Approved    int
		UsedQty     float64
		ReturnedQty float64
		LostQty     float64
	}

	agg := map[string]*workerAgg{}
	workersRows, err := s.pool.Query(ctx, `
		SELECT cu."userId", u."fullName"
		FROM "CompanyUser" cu
		JOIN "User" u ON u.id = cu."userId"
		WHERE cu."companyId" = $1
		  AND cu.role = 'FIELD_WORKER'
	`, companyID)
	if err == nil {
		for workersRows.Next() {
			var userID, fullName string
			if err := workersRows.Scan(&userID, &fullName); err == nil {
				agg[userID] = &workerAgg{
					UserID: userID,
					Name:   fullName,
				}
			}
		}
		workersRows.Close()
	}

	rows, err := s.pool.Query(ctx, `
		SELECT ft."assigneeId",
		       u."fullName",
		       fr.items
		FROM "FieldTask" ft
		JOIN "User" u ON u.id = ft."assigneeId"
		LEFT JOIN "FieldTaskReport" fr ON fr."fieldTaskId" = ft.id
		WHERE ft."companyId" = $1
		  AND ft.status = 'APPROVED'
		  AND ft."approvedAt" >= $2
		  AND ft."approvedAt" <= $3
	`, companyID, rng.GTE, rng.LTE)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID, fullName string
		var itemsRaw []byte
		if err := rows.Scan(&userID, &fullName, &itemsRaw); err != nil {
			return nil, err
		}
		row, ok := agg[userID]
		if !ok {
			row = &workerAgg{UserID: userID, Name: fullName}
			agg[userID] = row
		}
		row.TasksTotal++
		row.Approved++

		var items []fieldReportItem
		if len(itemsRaw) > 0 {
			_ = json.Unmarshal(itemsRaw, &items)
		}
		for _, item := range items {
			row.UsedQty += item.UsedQty
			row.ReturnedQty += item.ReturnedQty
			row.LostQty += item.LostQty
		}
	}

	out := make([]map[string]any, 0, len(agg))
	for _, row := range agg {
		out = append(out, map[string]any{
			"userId":      row.UserID,
			"name":        row.Name,
			"tasksTotal":  row.TasksTotal,
			"approved":    row.Approved,
			"usedQty":     round2(row.UsedQty),
			"returnedQty": round2(row.ReturnedQty),
			"lostQty":     round2(row.LostQty),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i]["usedQty"].(float64) > out[j]["usedQty"].(float64)
	})

	return map[string]any{
		"period": map[string]any{
			"from": rng.DateFrom,
			"to":   rng.DateTo,
		},
		"workers": out,
	}, nil
}
