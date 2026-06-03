'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { productsService } from '@/services/products.service';
import {
  useProductsInfinite,
  flattenProductsPages,
  useProductActions,
  useCategories,
} from '@/hooks/products/use-products';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInventoryRealtime } from '@/hooks/inventory/use-inventory-realtime';
import { useWarehouses, useInventoryActions } from '@/hooks/warehouse/use-warehouse';
import { ProductModal } from '@/components/ProductModal';
import { CategoryModal } from '@/components/CategoryModal';
import { ImportProductModal } from '@/components/ImportProductModal';
import { QuickStockModal } from '@/features/inventory/components/QuickStockModal';
import { CreateWarehouseModal } from '@/components/CreateWarehouseModal';
import { WarehouseFieldConfigModal } from '@/components/WarehouseFieldConfigModal';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { InventoryPageHeader } from '@/features/inventory/InventoryPageHeader';
import { InventoryToolbar } from '@/features/inventory/InventoryToolbar';
import { InventoryProductsTable } from '@/features/inventory/InventoryProductsTable';
import { InventoryProductsMobileList } from '@/features/inventory/InventoryProductsMobileList';
import {
  warehouseFieldConfig,
  filterProductsForWarehouse,
  summarizeWarehouseCatalog,
} from '@/features/inventory/inventory-utils';
import { useSession } from '@/hooks/use-session';
import {
  isInventoryCatalogReadOnly,
  maskWarehouseCatalogFieldConfig,
} from '@/lib/warehouse-role';

export default function InventoryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const catalogReadOnly = isInventoryCatalogReadOnly(session?.role);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isQuickStockOpen, setIsQuickStockOpen] = useState(false);
  const [quickStockProduct, setQuickStockProduct] = useState<any | null>(null);
  const [isCreateWarehouseOpen, setIsCreateWarehouseOpen] = useState(false);
  const [isWarehouseConfigOpen, setIsWarehouseConfigOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const queryClient = useQueryClient();

  const listParams = useMemo(
    () => ({
      search: debouncedSearch,
      categoryId: selectedCategoryId,
      warehouseId: selectedWarehouseId,
      sortBy,
      sortOrder,
      limit: 80,
    }),
    [
      debouncedSearch,
      selectedCategoryId,
      selectedWarehouseId,
      sortBy,
      sortOrder,
    ],
  );

  const {
    data: productPages,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductsInfinite(listParams, {
    enabled: !!selectedWarehouseId,
    placeholderData: true,
  });

  useInventoryRealtime(
    !!selectedWarehouseId && !isModalOpen && !isQuickStockOpen,
    selectedWarehouseId,
  );

  const products = flattenProductsPages(productPages);
  const { data: warehouses } = useWarehouses();
  const { deleteWarehouse } = useInventoryActions();

  useEffect(() => {
    if (!selectedWarehouseId && warehouses?.length) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  useEffect(() => {
    setSelectedCategoryId('');
  }, [selectedWarehouseId]);
  const { data: categories } = useCategories(selectedWarehouseId, {
    enabled: !!selectedWarehouseId,
  });
  const { deleteProduct } = useProductActions();

  const refreshCurrentInventory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['product-categories', selectedWarehouseId],
      }),
      queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
      queryClient.invalidateQueries({
        queryKey: ['stock-balances', { warehouseId: selectedWarehouseId }],
      }),
      refetch(),
    ]);
  };

  const handleDelete = async (id: string) => {
    if (
      !(await confirmAction("Ushbu mahsulotni o'chirishni xohlaysizmi?", {
        variant: 'danger',
        confirmLabel: "Ha, o'chirish",
      }))
    ) {
      return;
    }
    try {
      const result = await deleteProduct.mutateAsync(id);
      if (result?.action === 'archived' || result?.status === 'ARCHIVED') {
        toast.warning(
          result?.message ||
            "Mahsulot arxivlandi (to'liq o'chirilmadi — tarix saqlanadi).",
        );
      } else {
        toast.success(result?.message || "Mahsulot o'chirildi.");
      }
      refetch();
    } catch (err: unknown) {
      toast.error(formatApiError(err, "Mahsulotni o'chirishda xatolik"));
    }
  };

  const handleQuickStock = (product?: any) => {
    if (!selectedWarehouseId) {
      toast.error('Avval omborni tanlang.');
      return;
    }
    setQuickStockProduct(product ?? null);
    setIsQuickStockOpen(true);
  };

  const handleEdit = (product: any) => {
    if (catalogReadOnly) {
      router.push(
        `/dashboard/inventory/${product.id}${selectedWarehouseId ? `?warehouseId=${selectedWarehouseId}` : ''}`,
      );
      return;
    }
    setEditingProduct(null);
    setProductDetailLoading(true);
    setIsModalOpen(true);
    void productsService
      .getProduct(product.id, selectedWarehouseId || undefined)
      .then((full) => setEditingProduct(full))
      .catch(() => {
        setEditingProduct(product);
      })
      .finally(() => setProductDetailLoading(false));
  };

  const handleDeleteWarehouse = async (warehouse: any) => {
    if (
      !(await confirmAction(`"${warehouse.name}" omborini o'chirishni tasdiqlaysizmi?`, {
        variant: 'danger',
        confirmLabel: "Ha, o'chirish",
      }))
    ) {
      return;
    }
    try {
      const result = await deleteWarehouse.mutateAsync(warehouse.id);
      if (result?.action === 'archived') {
        toast.warning(result?.message || 'Ombor arxivlandi (to‘liq o‘chirilmadi).');
      } else {
        toast.success(result?.message || 'Ombor o‘chirildi.');
      }
      if (selectedWarehouseId === warehouse.id) {
        setSelectedWarehouseId('');
      }
      setIsWarehouseOpen(false);
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Omborni o'chirishda xatolik yuz berdi.";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const activeWarehouse = warehouses?.find((w: any) => w.id === selectedWarehouseId);
  const activeConfig = maskWarehouseCatalogFieldConfig(
    warehouseFieldConfig(activeWarehouse),
    session?.role,
  );
  const displayedProducts = filterProductsForWarehouse(products, selectedWarehouseId);
  const catalogStats = useMemo(() => {
    const fromPage = productPages?.pages?.[0]?.summary;
    if (fromPage) {
      return {
        productCount: fromPage.productCount,
        variantCount: fromPage.variantCount,
      };
    }
    return summarizeWarehouseCatalog(displayedProducts);
  }, [productPages?.pages, displayedProducts]);

  return (
    <div className="space-y-10 pb-20">
      <InventoryPageHeader
        catalogReadOnly={catalogReadOnly}
        selectedWarehouseId={selectedWarehouseId}
        selectedWarehouseName={activeWarehouse?.name}
        productCount={catalogStats.productCount}
        variantCount={catalogStats.variantCount}
        isLoading={isLoading}
        onOpenCategories={() => {
          if (!selectedWarehouseId) {
            toast.error('Avval omborni tanlang.');
            return;
          }
          setIsCategoryModalOpen(true);
        }}
        onOpenImport={() => {
          if (!selectedWarehouseId) {
            toast.error('Avval omborni tanlang.');
            return;
          }
          setIsImportModalOpen(true);
        }}
        onOpenQuickStock={() => handleQuickStock()}
        onOpenNewProduct={() => {
          setEditingProduct(null);
          setIsModalOpen(true);
        }}
      />

      <InventoryToolbar
        catalogReadOnly={catalogReadOnly}
        warehouses={warehouses}
        categories={categories}
        selectedWarehouseId={selectedWarehouseId}
        selectedCategoryId={selectedCategoryId}
        searchTerm={searchTerm}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isWarehouseOpen={isWarehouseOpen}
        isFilterOpen={isFilterOpen}
        isSortOpen={isSortOpen}
        deleteWarehousePending={deleteWarehouse.isPending}
        onSearchChange={setSearchTerm}
        onWarehouseOpenToggle={() => setIsWarehouseOpen(!isWarehouseOpen)}
        onWarehouseClose={() => setIsWarehouseOpen(false)}
        onSelectWarehouse={(id) => {
          setSelectedWarehouseId(id);
          setIsWarehouseOpen(false);
        }}
        onDeleteWarehouse={handleDeleteWarehouse}
        onOpenCreateWarehouse={() => setIsCreateWarehouseOpen(true)}
        onOpenWarehouseConfig={() => setIsWarehouseConfigOpen(true)}
        onFilterOpenToggle={() => setIsFilterOpen(!isFilterOpen)}
        onFilterClose={() => setIsFilterOpen(false)}
        onSelectCategory={(id) => {
          setSelectedCategoryId(id);
          setIsFilterOpen(false);
        }}
        onSortOpenToggle={() => setIsSortOpen(!isSortOpen)}
        onSortClose={() => setIsSortOpen(false)}
        onSelectSort={(sort, order) => {
          setSortBy(sort);
          setSortOrder(order);
          setIsSortOpen(false);
        }}
      />

      <div className="glass-card rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/5 bg-white/[0.01]">
        <InventoryProductsTable
          products={displayedProducts}
          selectedWarehouseId={selectedWarehouseId}
          activeConfig={activeConfig}
          catalogReadOnly={catalogReadOnly}
          isLoading={isLoading}
          isError={isError}
          onEdit={handleEdit}
          onQuickStock={handleQuickStock}
          onDelete={handleDelete}
          onOpenDetail={(id) =>
            router.push(
              `/dashboard/inventory/${id}${selectedWarehouseId ? `?warehouseId=${selectedWarehouseId}` : ''}`,
            )
          }
        />
        <InventoryProductsMobileList
          products={displayedProducts}
          selectedWarehouseId={selectedWarehouseId}
          activeConfig={activeConfig}
          catalogReadOnly={catalogReadOnly}
          isLoading={isLoading}
          onEdit={handleEdit}
          onQuickStock={handleQuickStock}
          onDelete={handleDelete}
          onOpenDetail={(id) =>
            router.push(
              `/dashboard/inventory/${id}${selectedWarehouseId ? `?warehouseId=${selectedWarehouseId}` : ''}`,
            )
          }
        />
        {hasNextPage && (
          <div className="p-6 border-t border-white/5 flex justify-center">
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
              className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-black text-gray-300 disabled:opacity-50"
            >
              {isFetchingNextPage
                ? 'Yuklanmoqda...'
                : `Yana yuklash (${displayedProducts.length} / ${catalogStats.productCount})`}
            </button>
          </div>
        )}
      </div>

      {!catalogReadOnly && (
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
          setProductDetailLoading(false);
        }}
        defaultWarehouseId={selectedWarehouseId}
        warehouseContext={activeWarehouse || null}
        product={editingProduct}
        detailLoading={productDetailLoading}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
          setProductDetailLoading(false);
          void queryClient.invalidateQueries({ queryKey: ['products'] });
        }}
      />
      )}
      {!catalogReadOnly && (
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        warehouseId={selectedWarehouseId}
        warehouseName={activeWarehouse?.name}
      />
      )}
      {!catalogReadOnly && (
      <ImportProductModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        warehouseId={selectedWarehouseId}
        warehouseName={activeWarehouse?.name}
        onSuccess={async () => {
          setIsImportModalOpen(false);
          await refreshCurrentInventory();
        }}
      />
      )}
      {!catalogReadOnly && (
      <QuickStockModal
        isOpen={isQuickStockOpen}
        onClose={() => {
          setIsQuickStockOpen(false);
          setQuickStockProduct(null);
        }}
        warehouseId={selectedWarehouseId}
        warehouseName={activeWarehouse?.name}
        initialProduct={quickStockProduct}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['products'] });
        }}
      />
      )}
      {!catalogReadOnly && (
        <>
          <CreateWarehouseModal
            isOpen={isCreateWarehouseOpen}
            onClose={() => setIsCreateWarehouseOpen(false)}
          />
          <WarehouseFieldConfigModal
            key={activeWarehouse?.id || 'no-warehouse-selected'}
            isOpen={isWarehouseConfigOpen}
            onClose={() => setIsWarehouseConfigOpen(false)}
            warehouse={activeWarehouse || null}
          />
        </>
      )}
    </div>
  );
}
