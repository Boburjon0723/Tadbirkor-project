'use client';

import React, { useState, useMemo } from 'react';
import {
  useOrdersInfinite,
  flattenOrdersPages,
  useOrdersHubStats,
  useOrderActions,
  useOrderDetail,
} from '@/hooks/orders/use-orders';
import { useProducts } from '@/hooks/products/use-products';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useOrdersRealtime } from '@/hooks/orders/use-orders-realtime';
import { CreateOrderModal } from '@/components/CreateOrderModal';
import { CreateDispatchModal } from '@/components/CreateDispatchModal';
import { toast } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { invoicesService } from '@/services/invoices.service';
import { OrdersPageHeader } from '@/features/orders/OrdersPageHeader';
import { OrdersStatsCards } from '@/features/orders/OrdersStatsCards';
import { OrdersTabsSearch } from '@/features/orders/OrdersTabsSearch';
import { OrdersListTable } from '@/features/orders/OrdersListTable';
import { OrdersListMobile } from '@/features/orders/OrdersListMobile';
import { OrdersPartnerDrawer } from '@/features/orders/OrdersPartnerDrawer';
import { OrderDetailsModal } from '@/features/orders/OrderDetailsModal';
import {
  buildOrderStatsFromHub,
  groupOrdersByPartner,
  orderHasUnmappedItems,
  orderItemsLackMappingFields,
  orderCanCloseRemainder,
  type PartnerOrderGroup,
} from '@/features/orders/orders-utils';
import { ordersService } from '@/services/orders.service';

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'my' | 'incoming'>('my');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<any>(null);
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
  const [mappingPrices, setMappingPrices] = useState<Record<string, string>>({});
  const [mappingCurrencies, setMappingCurrencies] = useState<Record<string, 'UZS' | 'USD'>>({});
  const [detailPartnerGroup, setDetailPartnerGroup] = useState<PartnerOrderGroup | null>(null);

  useOrdersRealtime(true);

  const debouncedSearch = useDebouncedValue(searchTerm, 280);
  const listParams = useMemo(
    () => ({ search: debouncedSearch, limit: 30 }),
    [debouncedSearch],
  );

  const {
    data: myPages,
    isLoading: loadingMy,
    fetchNextPage: fetchNextMy,
    hasNextPage: hasNextMy,
    isFetchingNextPage: fetchingNextMy,
  } = useOrdersInfinite('my', listParams, { enabled: activeTab === 'my' });

  const {
    data: incomingPages,
    isLoading: loadingIncoming,
    fetchNextPage: fetchNextIncoming,
    hasNextPage: hasNextIncoming,
    isFetchingNextPage: fetchingNextIncoming,
  } = useOrdersInfinite('incoming', listParams, { enabled: activeTab === 'incoming' });

  const { data: hubStats } = useOrdersHubStats();
  const {
    acceptIncoming,
    rejectIncoming,
    sendOrder,
    cancelOrder,
    deleteOrder,
    mapIncomingItem,
    closeRemainder,
  } = useOrderActions();
  const selectedOrderId = selectedOrder?.id ?? null;
  const { data: orderDetail, isLoading: orderDetailLoading } = useOrderDetail(
    selectedOrderId,
    showDetailsModal,
  );
  const displayOrder = orderDetail ?? selectedOrder;
  const { data: ownProducts } = useProducts(undefined, {
    enabled: showDetailsModal && activeTab === 'incoming',
  });

  const myOrders = flattenOrdersPages(myPages);
  const incomingOrders = flattenOrdersPages(incomingPages);
  const rawOrders = activeTab === 'my' ? myOrders : incomingOrders;
  const listLoading = activeTab === 'my' ? loadingMy : loadingIncoming;
  const orders = rawOrders;
  const partnerGroups = useMemo(
    () => groupOrdersByPartner(orders, activeTab),
    [orders, activeTab],
  );
  const stats = useMemo(() => buildOrderStatsFromHub(hubStats), [hubStats]);
  const hasNextPage = activeTab === 'my' ? hasNextMy : hasNextIncoming;
  const isFetchingNextPage = activeTab === 'my' ? fetchingNextMy : fetchingNextIncoming;
  const fetchNextPage = activeTab === 'my' ? fetchNextMy : fetchNextIncoming;

  const handleAction = async (
    action: 'accept' | 'acceptPartial' | 'reject' | 'send' | 'cancel' | 'delete',
    id: string,
  ) => {
    try {
      if (action === 'accept' || action === 'acceptPartial') {
        let order =
          displayOrder?.id === id
            ? displayOrder
            : selectedOrder?.id === id
              ? selectedOrder
              : incomingOrders?.find((o: any) => o.id === id);

        if (orderHasUnmappedItems(order)) {
          order = await ordersService.getOrderDetail(id);
        }

        if (orderHasUnmappedItems(order)) {
          toast.error(
            "Qo'lda yozilgan mahsulotlar uchun avval mapping qiling (katalogdan buyurtmada shart emas).",
          );
          return;
        }
        const allowPartial = action === 'acceptPartial';
        const result = await acceptIncoming.mutateAsync({ id, allowPartial });
        const nextStatus = result?.status || (allowPartial ? 'PARTIAL_ACCEPTED' : 'ACCEPTED');
        setSelectedOrder((prev: any) => (prev?.id === id ? { ...prev, status: nextStatus } : prev));
      } else if (action === 'reject') {
        await rejectIncoming.mutateAsync(id);
        setSelectedOrder((prev: any) => (prev?.id === id ? { ...prev, status: 'REJECTED' } : prev));
      } else if (action === 'send') {
        await sendOrder.mutateAsync(id);
        setSelectedOrder((prev: any) => (prev?.id === id ? { ...prev, status: 'SENT' } : prev));
      } else if (action === 'cancel') {
        if (
          !(await confirmAction('Buyurtmani bekor qilishni tasdiqlaysizmi?', {
            variant: 'danger',
            confirmLabel: 'Ha, bekor qilish',
          }))
        ) {
          return;
        }
        await cancelOrder.mutateAsync(id);
        setSelectedOrder((prev: any) => (prev?.id === id ? { ...prev, status: 'CANCELLED' } : prev));
      } else if (action === 'delete') {
        if (
          !(await confirmAction("Buyurtmani butunlay o'chirishni tasdiqlaysizmi?", {
            variant: 'danger',
            confirmLabel: "Ha, o'chirish",
          }))
        ) {
          return;
        }
        await deleteOrder.mutateAsync(id);
        setShowDetailsModal(false);
        setSelectedOrder(null);
      }
      setShowDetailsModal(false);
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Amalni bajarishda xatolik yuz berdi.';
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const handleCloseRemainder = async (orderId: string) => {
    const ok = await confirmAction(
      activeTab === 'my'
        ? 'Sotuvchiga qolgan mahsulotni yubormaslik kerakligi xabar qilinadi. Bu amalni qaytarib bo‘lmaydi.'
        : 'Xaridorga qolgan qism yetkazilmaydi deb belgilanadi. Bu amalni qaytarib bo‘lmaydi.',
      {
        title:
          activeTab === 'my' ? 'Qolgan qismni kutmayapsizmi?' : "Qolganini jo'natmaslik?",
        confirmLabel: 'Ha, yopish',
        cancelLabel: 'Bekor qilish',
        variant: 'danger',
      },
    );
    if (!ok) return;
    try {
      await closeRemainder.mutateAsync({ id: orderId, role: activeTab });
      toast.success('Qolgan qism yopildi.');
      setShowDetailsModal(false);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Amal bajarilmadi';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  };

  const handleMapItem = async (orderId: string, itemId: string) => {
    const selectedVariantId = mappingSelections[itemId];
    if (!selectedVariantId) {
      toast.error('Avval mahsulot variantini tanlang.');
      return;
    }
    try {
      const priceRaw = mappingPrices[itemId];
      const payload: {
        orderId: string;
        itemId: string;
        ownProductVariantId: string;
        sellerPrice?: number;
        sellerCurrency?: 'UZS' | 'USD';
      } = {
        orderId,
        itemId,
        ownProductVariantId: selectedVariantId,
      };
      if (priceRaw && Number(priceRaw) > 0) {
        payload.sellerPrice = Number(priceRaw);
      }
      if (mappingCurrencies[itemId]) {
        payload.sellerCurrency = mappingCurrencies[itemId];
      }
      await mapIncomingItem.mutateAsync(payload);
      setMappingSelections((prev) => ({ ...prev, [itemId]: '' }));
      setMappingPrices((prev) => ({ ...prev, [itemId]: '' }));
      toast.success('Mapping saqlandi.');
    } catch (err) {
      console.error(err);
      toast.error('Mapping saqlashda xato yuz berdi.');
    }
  };

  const openOrder = (order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const orderActionProps = {
    onSelectOrder: openOrder,
    onReject: (id: string) => handleAction('reject', id),
    onAccept: (id: string) => handleAction('accept', id),
    onDispatch: (order: any) => {
      const full = displayOrder?.id === order?.id ? displayOrder : order;
      setDispatchOrder(full);
      setIsDispatchModalOpen(true);
    },
    onEdit: (order: any) => {
      setEditOrderId(order.id);
      setIsCreateModalOpen(true);
    },
    onCancel: (id: string) => handleAction('cancel', id),
    onDelete: (id: string) => handleAction('delete', id),
    onPrintInvoice: (order: any) => void invoicesService.printInvoice(order),
    onExportPdf: (order: any) => void invoicesService.exportOrderPdf(order.id),
    onExportExcel: (order: any) => void invoicesService.exportOrderExcel(order.id),
  };

  const listProps = {
    partnerGroups,
    isLoading: listLoading,
    onOpenPartner: (group: PartnerOrderGroup) => setDetailPartnerGroup(group),
  };

  return (
    <div className="space-y-10 pb-20">
      <OrdersPageHeader
        onNewOrder={() => {
          setEditOrderId(null);
          setIsCreateModalOpen(true);
        }}
      />

      <OrdersStatsCards stats={stats} />

      <OrdersTabsSearch
        activeTab={activeTab}
        incomingCount={Number(hubStats?.incoming?.sent ?? incomingOrders.length)}
        searchTerm={searchTerm}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setDetailPartnerGroup(null);
        }}
        onSearchChange={setSearchTerm}
      />

      <div className="glass-card rounded-[2rem] md:rounded-[3rem] border border-white/5 bg-white/[0.01] overflow-visible">
        <OrdersListTable {...listProps} />
        <OrdersListMobile {...listProps} />
        {hasNextPage && (
          <div className="p-6 border-t border-white/5 flex justify-center">
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
              className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-black text-gray-300 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Yuklanmoqda...' : `Yana yuklash (${partnerGroups.length} hamkor)`}
            </button>
          </div>
        )}
      </div>

      <OrdersPartnerDrawer
        group={detailPartnerGroup}
        activeTab={activeTab}
        onClose={() => setDetailPartnerGroup(null)}
        {...orderActionProps}
      />

      <OrderDetailsModal
        isOpen={showDetailsModal}
        order={displayOrder}
        isLoadingDetail={orderDetailLoading && !orderDetail}
        activeTab={activeTab}
        ownProducts={ownProducts}
        mappingSelections={mappingSelections}
        mappingPrices={mappingPrices}
        mappingCurrencies={mappingCurrencies}
        onClose={() => setShowDetailsModal(false)}
        onMappingSelect={(itemId, variantId, variant) => {
          setMappingSelections((prev) => ({ ...prev, [itemId]: variantId }));
          if (variant) {
            setMappingPrices((prev) => ({ ...prev, [itemId]: String(variant.salePrice || '') }));
            setMappingCurrencies((prev) => ({
              ...prev,
              [itemId]: (variant.currency || 'UZS') as 'UZS' | 'USD',
            }));
          }
        }}
        onMappingPrice={(itemId, value) =>
          setMappingPrices((prev) => ({ ...prev, [itemId]: value }))
        }
        onMappingCurrency={(itemId, currency) =>
          setMappingCurrencies((prev) => ({ ...prev, [itemId]: currency }))
        }
        onMapItem={handleMapItem}
        onAction={handleAction}
        onOpenDispatch={(order) => {
          const full =
            displayOrder?.id === order?.id ? displayOrder : order;
          setDispatchOrder(full);
          setIsDispatchModalOpen(true);
        }}
        onCloseRemainder={
          displayOrder && orderCanCloseRemainder(displayOrder)
            ? handleCloseRemainder
            : undefined
        }
      />

      <CreateOrderModal
        isOpen={isCreateModalOpen}
        editOrderId={editOrderId}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditOrderId(null);
        }}
      />

      {dispatchOrder && (
        <CreateDispatchModal
          isOpen={isDispatchModalOpen}
          onClose={() => {
            setIsDispatchModalOpen(false);
            setDispatchOrder(null);
          }}
          order={dispatchOrder}
        />
      )}
    </div>
  );
}
