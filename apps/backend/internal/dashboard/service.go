package dashboard

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tadbirkor/axis-erp/backend/pkg/cache"
)

type Service struct {
	pool *pgxpool.Pool
	cache *cache.Cache
	ttl   time.Duration
}

func NewService(pool *pgxpool.Pool, c *cache.Cache, ttlMs int) *Service {
	return &Service{
		pool:  pool,
		cache: c,
		ttl:   time.Duration(ttlMs) * time.Millisecond,
	}
}

func (s *Service) cacheKey(companyID string) string {
	return "dashboard:stats:" + companyID
}

func (s *Service) GetStats(ctx context.Context, companyID string) (map[string]any, error) {
	key := s.cacheKey(companyID)
	var cached map[string]any
	if ok, _ := s.cache.GetJSON(ctx, key, &cached); ok {
		return cached, nil
	}
	data, err := s.computeStats(ctx, companyID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetJSON(ctx, key, data, s.ttl)
	return data, nil
}

func (s *Service) computeStats(ctx context.Context, companyID string) (map[string]any, error) {
	var totalProducts int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "ProductVariant" pv
		JOIN "Product" p ON p.id = pv."productId"
		WHERE p."companyId" = $1
	`, companyID).Scan(&totalProducts)
	if err != nil {
		return nil, err
	}

	inventoryValue := map[string]float64{"UZS": 0, "USD": 0}
	rows, err := s.pool.Query(ctx, `
		SELECT sb.quantity, pv."purchasePrice", pv.currency
		FROM "StockBalance" sb
		JOIN "Warehouse" w ON w.id = sb."warehouseId"
		JOIN "ProductVariant" pv ON pv.id = sb."productVariantId"
		WHERE w."companyId" = $1
	`, companyID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var qty, price float64
		var currency *string
		if err := rows.Scan(&qty, &price, &currency); err != nil {
			rows.Close()
			return nil, err
		}
		c := "UZS"
		if currency != nil && *currency != "" {
			c = *currency
		}
		inventoryValue[c] = round2(inventoryValue[c] + price*qty)
	}
	rows.Close()

	totalReceivables, _ := s.debtSumCreditor(ctx, companyID)
	totalPayables, _ := s.debtSumDebtor(ctx, companyID)

	var dailyDispatches int
	_ = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "Dispatch"
		WHERE "sellerCompanyId" = $1 AND "createdAt" >= date_trunc('day', NOW())
	`, companyID).Scan(&dailyDispatches)

	var pendingReceipts int
	_ = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "GoodsReceipt"
		WHERE "buyerCompanyId" = $1 AND status = 'PENDING'
	`, companyID).Scan(&pendingReceipts)

	var pendingPickTasks int
	_ = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM "PickTask" pt
		JOIN "Dispatch" d ON d.id = pt."dispatchId"
		WHERE pt."companyId" = $1 AND pt.status IN ('PENDING','IN_PROGRESS') AND d.status = 'DRAFT'
	`, companyID).Scan(&pendingPickTasks)

	topProducts := []map[string]any{}
	tpRows, err := s.pool.Query(ctx, `
		SELECT oi."productNameSnapshot", SUM(oi.quantity)::float8
		FROM "B2BOrderItem" oi
		JOIN "B2BOrder" o ON o.id = oi."orderId"
		WHERE o."sellerCompanyId" = $1 AND o.status = 'COMPLETED'
		GROUP BY oi."productNameSnapshot"
		ORDER BY SUM(oi.quantity) DESC
		LIMIT 3
	`, companyID)
	if err == nil {
		for tpRows.Next() {
			var name string
			var qty float64
			if err := tpRows.Scan(&name, &qty); err == nil {
				topProducts = append(topProducts, map[string]any{
					"name": name, "soldCount": qty, "totalRevenue": 0,
				})
			}
		}
		tpRows.Close()
	}

	recentOrders := []map[string]any{}
	roRows, err := s.pool.Query(ctx, `
		SELECT o.id, o.status, o."createdAt", o."buyerCompanyId", b.name, s.name
		FROM "B2BOrder" o
		JOIN "Company" b ON b.id = o."buyerCompanyId"
		JOIN "Company" s ON s.id = o."sellerCompanyId"
		WHERE (o."buyerCompanyId" = $1 OR o."sellerCompanyId" = $1) AND o.status <> 'DRAFT'
		ORDER BY o."createdAt" DESC LIMIT 5
	`, companyID)
	if err == nil {
		for roRows.Next() {
			var id, status, buyerID, buyerName, sellerName string
			var createdAt time.Time
			if err := roRows.Scan(&id, &status, &createdAt, &buyerID, &buyerName, &sellerName); err == nil {
				partner := sellerName
				if buyerID == companyID {
					partner = sellerName
				} else {
					partner = buyerName
				}
				short := id
				if len(short) > 8 {
					short = id[:8]
				}
				recentOrders = append(recentOrders, map[string]any{
					"id": id, "orderNumber": short, "partnerName": partner,
					"amount": 0, "status": status, "createdAt": createdAt,
				})
			}
		}
		roRows.Close()
	}

	return map[string]any{
		"stats": map[string]any{
			"totalProducts":     totalProducts,
			"inventoryValue":    inventoryValue,
			"totalReceivables":  totalReceivables,
			"totalPayables":     totalPayables,
			"dailyDispatches":   dailyDispatches,
			"pendingReceipts":   pendingReceipts,
			"pendingPickTasks":  pendingPickTasks,
			"productChange":     0,
			"inventoryChange":   0,
			"debtChange":        0,
			"creditChange":      0,
		},
		"topProducts":  topProducts,
		"recentOrders": recentOrders,
	}, nil
}

func (s *Service) debtSumCreditor(ctx context.Context, companyID string) (map[string]float64, error) {
	return s.debtSum(ctx, companyID, `"creditorId"`)
}

func (s *Service) debtSumDebtor(ctx context.Context, companyID string) (map[string]float64, error) {
	return s.debtSum(ctx, companyID, `"debtorId"`)
}

func (s *Service) debtSum(ctx context.Context, companyID, column string) (map[string]float64, error) {
	out := map[string]float64{"UZS": 0, "USD": 0}
	q := `SELECT currency, COALESCE(SUM("remainingAmount"),0)::float8 FROM "DebtEntry" WHERE ` + column + ` = $1 AND status IN ('OPEN','PARTIAL') GROUP BY currency`
	rows, err := s.pool.Query(ctx, q, companyID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var cur string
		var sum float64
		if err := rows.Scan(&cur, &sum); err != nil {
			return out, err
		}
		if cur == "" {
			cur = "UZS"
		}
		out[strings.ToUpper(cur)] = sum
	}
	return out, nil
}

func round2(n float64) float64 {
	return float64(int(n*100+0.5)) / 100
}
