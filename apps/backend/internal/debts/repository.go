package debts

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// TODO: Complex db operations for Debts will be placed here.

func (r *Repository) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}
