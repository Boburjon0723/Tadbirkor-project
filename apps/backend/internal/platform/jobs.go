package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) InsertScheduledJob(ctx context.Context, kind string, runAt time.Time, payload map[string]any, createdByID string) (map[string]any, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	var status string
	var createdAt time.Time
	var outRaw []byte
	err = r.pool.QueryRow(ctx, `
		INSERT INTO "PlatformScheduledJob" (id, kind, status, "runAt", payload, "createdById", "createdAt")
		VALUES ($1, $2, 'pending', $3, $4::jsonb, NULLIF($5,''), NOW())
		RETURNING id, kind, status, "runAt", payload, "createdAt"
	`, id, kind, runAt, raw, createdByID).Scan(&id, &kind, &status, &runAt, &outRaw, &createdAt)
	if err != nil {
		return nil, err
	}
	var payloadMap map[string]any
	_ = json.Unmarshal(outRaw, &payloadMap)
	return map[string]any{
		"id": id, "kind": kind, "status": status, "runAt": runAt, "payload": payloadMap, "createdAt": createdAt,
	}, nil
}

func (r *Repository) ListScheduledJobs(ctx context.Context, status string, page, limit int) (map[string]any, error) {
	where := `status = $1`
	args := []any{"pending"}
	if status == "all" {
		where = `TRUE`
		args = nil
	} else if status != "" && status != "pending" {
		where = `status = $1`
		args = []any{status}
	}
	skip := (page - 1) * limit

	var total int
	countQ := `SELECT COUNT(*)::int FROM "PlatformScheduledJob" WHERE ` + where
	if len(args) > 0 {
		_ = r.pool.QueryRow(ctx, countQ, args...).Scan(&total)
	} else {
		_ = r.pool.QueryRow(ctx, countQ).Scan(&total)
	}

	listArgs := append(args, limit, skip)
	n := len(listArgs)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT id, kind, status, "runAt", payload, "createdAt", "processedAt", "errorMessage"
		FROM "PlatformScheduledJob"
		WHERE %s
		ORDER BY "runAt" ASC
		LIMIT $%d OFFSET $%d
	`, where, n-1, n), listArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, kind, st string
		var runAt, createdAt time.Time
		var processedAt *time.Time
		var errMsg *string
		var raw []byte
		if err := rows.Scan(&id, &kind, &st, &runAt, &raw, &createdAt, &processedAt, &errMsg); err != nil {
			return nil, err
		}
		var payload map[string]any
		_ = json.Unmarshal(raw, &payload)
		items = append(items, map[string]any{
			"id": id, "kind": kind, "status": st, "runAt": runAt, "payload": payload,
			"createdAt": createdAt, "processedAt": processedAt, "errorMessage": errMsg,
		})
	}
	return map[string]any{
		"items": items, "page": page, "limit": limit, "total": total,
		"hasMore": skip+len(items) < total,
	}, rows.Err()
}

func (r *Repository) CancelScheduledJob(ctx context.Context, jobID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE "PlatformScheduledJob" SET status = 'cancelled', "processedAt" = NOW()
		WHERE id = $1 AND status = 'pending'
	`, jobID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrJobNotFound
	}
	return nil
}

func (r *Repository) ClaimDueJobs(ctx context.Context, limit int) ([]scheduledJobRow, error) {
	if limit < 1 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		UPDATE "PlatformScheduledJob" j
		SET status = 'processing'
		WHERE j.id IN (
			SELECT id FROM "PlatformScheduledJob"
			WHERE status = 'pending' AND "runAt" <= NOW()
			ORDER BY "runAt" ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING j.id, j.kind, j.payload
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []scheduledJobRow{}
	for rows.Next() {
		var row scheduledJobRow
		var raw []byte
		if err := rows.Scan(&row.ID, &row.Kind, &raw); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &row.Payload)
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) MarkJobDone(ctx context.Context, jobID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE "PlatformScheduledJob" SET status = 'done', "processedAt" = NOW() WHERE id = $1
	`, jobID)
	return err
}

func (r *Repository) MarkJobFailed(ctx context.Context, jobID string, msg string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE "PlatformScheduledJob" SET status = 'failed', "processedAt" = NOW(), "errorMessage" = $2 WHERE id = $1
	`, jobID, msg)
	return err
}

type scheduledJobRow struct {
	ID      string
	Kind    string
	Payload map[string]any
}

func (r *Repository) GetJob(ctx context.Context, jobID string) (*scheduledJobRow, error) {
	var row scheduledJobRow
	var raw []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, kind, payload FROM "PlatformScheduledJob" WHERE id = $1
	`, jobID).Scan(&row.ID, &row.Kind, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrJobNotFound
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(raw, &row.Payload)
	return &row, nil
}
