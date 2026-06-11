package cache

import "context"

// InvalidateStockCaches — POS katalog, mahsulotlar ro‘yxati, dashboard (ombor o‘zgarishi).
func (c *Cache) InvalidateStockCaches(ctx context.Context, companyID, warehouseID string) {
	if c == nil {
		return
	}
	c.DelByPrefix(ctx, PosCatalogPrefix(companyID, warehouseID))
	c.InvalidateProductsList(ctx, companyID)
	c.InvalidateVariantsSearch(ctx, companyID)
	c.Del(ctx, DashboardStatsKey(companyID))
}

// InvalidateAuthMe — /auth/me keshi.
func (c *Cache) InvalidateAuthMe(ctx context.Context, userID, companyID string) {
	if c == nil {
		return
	}
	c.Del(ctx, c.AuthMeKey(userID, companyID))
}

// InvalidateActiveWarehouseCount — bitta faol ombor optimizatsiyasi.
func (c *Cache) InvalidateActiveWarehouseCount(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.Del(ctx, ActiveWarehouseCountKey(companyID))
}

// InvalidateProductsList — inventar mahsulotlar ro‘yxati.
func (c *Cache) InvalidateProductsList(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.DelByPrefix(ctx, ProductsListPrefix(companyID))
}

// InvalidateWarehousesList — omborlar ro‘yxati.
func (c *Cache) InvalidateWarehousesList(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.DelByPrefix(ctx, WarehousesListPrefix(companyID))
}

// InvalidateVariantsSearch — variant qidiruv.
func (c *Cache) InvalidateVariantsSearch(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.DelByPrefix(ctx, VariantsSearchPrefix(companyID))
}

// InvalidateDashboardStats — dashboard stats keshi.
func (c *Cache) InvalidateDashboardStats(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.Del(ctx, DashboardStatsKey(companyID))
}

// InvalidateOrderCaches — B2B buyurtmalar ro‘yxati va hub stats.
func (c *Cache) InvalidateOrderCaches(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.Del(ctx, OrdersHubStatsKey(companyID))
	c.DelByPrefix(ctx, OrdersListPrefix(companyID))
	c.InvalidateDashboardStats(ctx, companyID)
}

// InvalidateInventoryCountsList — inventarizatsiya ro‘yxati.
func (c *Cache) InvalidateInventoryCountsList(ctx context.Context, companyID string) {
	if c == nil {
		return
	}
	c.DelByPrefix(ctx, InventoryCountsListPrefix(companyID))
}
