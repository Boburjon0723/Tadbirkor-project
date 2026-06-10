package b2borders

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("Buyurtma topilmadi")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type orderHeadRecord struct {
	ID                   string
	BuyerCompanyID       string
	SellerCompanyID      string
	Status               string
	ExpectedDeliveryDate *time.Time
	Note                 *string
	CreatedBy            string
	CreatedAt            time.Time
	UpdatedAt            time.Time
	BuyerName            string
	BuyerTin             *string
	BuyerPhone           *string
	BuyerAddress         *string
	SellerName           string
	SellerTin            *string
	SellerPhone          *string
	SellerAddress        *string
}

type orderItemRecord struct {
	ID                  string
	OrderID             string
	Quantity            float64
	ExpectedPrice       float64
	ExpectedCurrency    string
	ProductNameSnapshot string
	ProductVariantID    *string
	MappingStatus       string
	VariantName         *string
	VariantSKU          *string
	VariantBarcode      *string
	ProductName         *string
}

func (r *Repository) EnsureActivePartner(ctx context.Context, companyID, partnerCompanyID string) ([]byte, error) {
	var visibility []byte
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE("warehouseVisibilityConfig", '{}'::jsonb)
		FROM "Partner"
		WHERE status = 'ACTIVE' AND (
		  ("ownerCompanyId" = $1 AND "partnerCompanyId" = $2)
		  OR
		  ("ownerCompanyId" = $2 AND "partnerCompanyId" = $1)
		)
		LIMIT 1
	`, companyID, partnerCompanyID).Scan(&visibility)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("Faol hamkor topilmadi")
	}
	return visibility, err
}

func (r *Repository) FindOrderHead(ctx context.Context, id, companyID string) (*orderHeadRecord, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT o.id, o."buyerCompanyId", o."sellerCompanyId", o.status, o."expectedDeliveryDate", o.note, o."createdBy", o."createdAt", o."updatedAt",
		       b.name, b.tin, b.phone, b.address,
		       s.name, s.tin, s.phone, s.address
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" s ON s.id = o."sellerCompanyId"
		WHERE o.id = $1 AND (o."buyerCompanyId" = $2 OR o."sellerCompanyId" = $2)
	`, id, companyID)
	var out orderHeadRecord
	err := row.Scan(
		&out.ID, &out.BuyerCompanyID, &out.SellerCompanyID, &out.Status, &out.ExpectedDeliveryDate, &out.Note, &out.CreatedBy, &out.CreatedAt, &out.UpdatedAt,
		&out.BuyerName, &out.BuyerTin, &out.BuyerPhone, &out.BuyerAddress,
		&out.SellerName, &out.SellerTin, &out.SellerPhone, &out.SellerAddress,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *Repository) FindOrderHeadForSeller(ctx context.Context, id, sellerCompanyID string) (*orderHeadRecord, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT o.id, o."buyerCompanyId", o."sellerCompanyId", o.status, o."expectedDeliveryDate", o.note, o."createdBy", o."createdAt", o."updatedAt",
		       b.name, b.tin, b.phone, b.address,
		       s.name, s.tin, s.phone, s.address
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" s ON s.id = o."sellerCompanyId"
		WHERE o.id = $1 AND o."sellerCompanyId" = $2
	`, id, sellerCompanyID)
	var out orderHeadRecord
	err := row.Scan(
		&out.ID, &out.BuyerCompanyID, &out.SellerCompanyID, &out.Status, &out.ExpectedDeliveryDate, &out.Note, &out.CreatedBy, &out.CreatedAt, &out.UpdatedAt,
		&out.BuyerName, &out.BuyerTin, &out.BuyerPhone, &out.BuyerAddress,
		&out.SellerName, &out.SellerTin, &out.SellerPhone, &out.SellerAddress,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *Repository) ListOrderItems(ctx context.Context, orderID string) ([]orderItemRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i."orderId", i.quantity, COALESCE(i."expectedPrice", 0)::float8,
		       COALESCE(i."expectedCurrency", 'UZS'), i."productNameSnapshot", i."productVariantId",
		       COALESCE(i."mappingStatus", 'PENDING'),
		       pv.name, pv.sku, pv.barcode, p.name
		FROM "B2BOrderItem" i
		LEFT JOIN "ProductVariant" pv ON pv.id = i."productVariantId"
		LEFT JOIN "Product" p ON p.id = pv."productId"
		WHERE i."orderId" = $1
		ORDER BY i.id ASC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]orderItemRecord, 0)
	for rows.Next() {
		var row orderItemRecord
		if err := rows.Scan(
			&row.ID, &row.OrderID, &row.Quantity, &row.ExpectedPrice, &row.ExpectedCurrency,
			&row.ProductNameSnapshot, &row.ProductVariantID, &row.MappingStatus,
			&row.VariantName, &row.VariantSKU, &row.VariantBarcode, &row.ProductName,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) CountOrderItems(ctx context.Context, orderID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "B2BOrderItem" WHERE "orderId" = $1`, orderID).Scan(&count)
	return count, err
}
