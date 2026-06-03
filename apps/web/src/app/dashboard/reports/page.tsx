'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useReportsBundle, ReportsFilterParams } from '@/hooks/reports/use-cost-reports';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { ReportsPageHeader } from '@/features/reports/ReportsPageHeader';
import { ReportsFilterBar } from '@/features/reports/ReportsFilterBar';
import { ReportsStatsCards } from '@/features/reports/ReportsStatsCards';
import { ReportsDailyChart } from '@/features/reports/ReportsDailyChart';
import { ReportsFieldWorkersSection } from '@/features/reports/ReportsFieldWorkersSection';
import { ReportsTopProductsSection } from '@/features/reports/ReportsTopProductsSection';
import { ReportsCountsAndNote } from '@/features/reports/ReportsCountsAndNote';
import {
  type CostSummary,
  type DailyPoint,
  type TopProduct,
  type FieldWorkerInstallRow,
  todayStr,
  monthStartStr,
  buildReportStats,
} from '@/features/reports/reports-types';

export default function ReportsPage() {
  const { data: warehouses } = useWarehouses();
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [warehouseId, setWarehouseId] = useState('');
  const [filters, setFilters] = useState<ReportsFilterParams>({
    dateFrom: monthStartStr(),
    dateTo: todayStr(),
    warehouseId: '',
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whDropdownOpen, setWhDropdownOpen] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<'UZS' | 'USD'>('UZS');

  const {
    data: reportBundle,
    isPending,
    isFetching,
    error: queryError,
    refetch,
  } = useReportsBundle(filters);

  const summary = (reportBundle?.summary as CostSummary | undefined) ?? null;
  const daily = (reportBundle?.daily as DailyPoint[]) ?? [];
  const top = (reportBundle?.top as TopProduct[]) ?? [];
  const loading = isPending && !reportBundle;

  const fieldRes = reportBundle?.fieldRes;
  const fieldModuleOff =
    fieldRes && !fieldRes.ok && [400, 403].includes((fieldRes.err as any)?.response?.status);
  const fieldInstalls: FieldWorkerInstallRow[] | null = fieldModuleOff
    ? null
    : fieldRes?.ok
      ? fieldRes.data?.workers || []
      : reportBundle
        ? []
        : null;

  const buildParams = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.dateTo = end.toISOString();
    }
    if (warehouseId) params.warehouseId = warehouseId;
    return params;
  };

  const applyFilters = () => {
    setError(null);
    setFilters({ dateFrom, dateTo, warehouseId });
  };

  useEffect(() => {
    if (!queryError) return;
    const err = queryError as any;
    const msg = err?.response?.data?.message || err?.message || 'Hisobotni yuklashda xatolik';
    setError(Array.isArray(msg) ? msg.join('\n') : String(msg));
  }, [queryError]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await api.get<Blob>('/reports/summary/export', {
        params: buildParams(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisobot-${todayStr()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error(err);
      setError('Excel yuklab olishda xatolik');
    } finally {
      setExporting(false);
    }
  };

  const selectedWarehouseName = useMemo(() => {
    if (!warehouseId) return 'Hamma omborlar';
    return warehouses?.find((w: any) => w.id === warehouseId)?.name || 'Tanlangan ombor';
  }, [warehouses, warehouseId]);

  const stats = useMemo(() => (summary ? buildReportStats(summary) : null), [summary]);

  const chartData = useMemo(
    () =>
      daily.map((d) => ({
        date: d.date.slice(5),
        Kirim: d.purchase[chartCurrency],
        Sotuv: d.sales[chartCurrency],
        Foyda: d.profit[chartCurrency],
      })),
    [daily, chartCurrency],
  );

  const fieldTotalInstalled = (fieldInstalls || []).reduce((s, w) => s + w.usedQty, 0);

  if (loading && !summary) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <PageSkeleton rows={2} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
      <ReportsPageHeader
        exporting={exporting}
        isFetching={isFetching}
        onExport={() => void handleExport()}
        onRefresh={() => {
          setError(null);
          void refetch();
        }}
      />

      <ReportsFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        warehouseId={warehouseId}
        warehouses={warehouses}
        selectedWarehouseName={selectedWarehouseName}
        whDropdownOpen={whDropdownOpen}
        isFetching={isFetching}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onWarehouseIdChange={(id) => {
          setWarehouseId(id);
          setWhDropdownOpen(false);
        }}
        onWhDropdownToggle={() => setWhDropdownOpen((p) => !p)}
        onWhDropdownClose={() => setWhDropdownOpen(false)}
        onApply={applyFilters}
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-sm font-bold text-rose-300">
          {error}
        </div>
      )}

      <ReportsStatsCards stats={stats} loading={loading} />

      <ReportsDailyChart
        loading={loading}
        chartData={chartData}
        chartCurrency={chartCurrency}
        onChartCurrencyChange={setChartCurrency}
      />

      {!fieldModuleOff && (
        <ReportsFieldWorkersSection
          loading={loading}
          fieldInstalls={fieldInstalls}
          fieldTotalInstalled={fieldTotalInstalled}
        />
      )}

      <ReportsTopProductsSection loading={loading} top={top} />

      <ReportsCountsAndNote summary={summary} />
    </div>
  );
}
