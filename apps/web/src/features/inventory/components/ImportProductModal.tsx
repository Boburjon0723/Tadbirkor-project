'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productsService } from '@/services/products.service';
import { waitForImportJob } from '@/lib/import-job-wait';
import { reportsService } from '@/services/reports.service';
import { toast, formatApiError } from '@/lib/toast';
import { IMPORT_STATUS_LEGEND } from '@/lib/product-import-guide';
import { ImportGuide } from './ImportGuide';
import { ImportPreviewVirtualTable } from './ImportPreviewVirtualTable';
import { PartnerLedgerContactSelect } from '@/features/partner-ledger/PartnerLedgerContactSelect';

interface ImportProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouseId?: string;
  warehouseName?: string;
}

type ImportMode = 'set' | 'add' | 'subtract';

function countConfirmableRows(preview: any): number {
  if (typeof preview?.confirmable === 'number') return preview.confirmable;
  if (!preview?.rows?.length) return Number(preview?.valid ?? 0);
  return preview.rows.filter(
    (r: any) =>
      r.errors.length === 0 &&
      (r.rowAction !== 'skip' ||
        (r.fileStockMode === 'with_stock' &&
          Number.isFinite(Number(r.initialStockRaw ?? r.initialStock)) &&
          Number(r.initialStockRaw ?? r.initialStock) > 0)),
  ).length;
}

export const ImportProductModal: React.FC<ImportProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  warehouseId,
  warehouseName,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [partnerLedgerContactId, setPartnerLedgerContactId] = useState('');
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    successRows?: number;
    failedRows?: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    successRows: number;
    failedRows: number;
    total: number;
    status: string;
    errorMessage?: string | null;
    jobId?: string;
    errors?: Array<{
      index?: number;
      rowNumber?: number;
      message: string;
      name?: string;
      sku?: string;
      barcode?: string;
    }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCancelledRef = useRef(false);
  const importInFlightRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setPartnerLedgerContactId('');
    importCancelledRef.current = false;
    activeJobIdRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleStopImport = async () => {
    importCancelledRef.current = true;
    const jobId = activeJobIdRef.current;
    if (jobId) {
      try {
        await productsService.cancelImportJob(jobId);
      } catch (err) {
        console.error(err);
      }
    }
    setImporting(false);
    setImportProgress(null);
    activeJobIdRef.current = null;
    toast.info('Import bekor qilindi. Allaqachon ishlangan qatorlar saqlangan bo‘lishi mumkin.');
    reset();
    onClose();
  };

  const handleClose = () => {
    if (importing) {
      void handleStopImport();
      return;
    }
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await handlePreview(selectedFile);
    }
  };

  const runPreview = useCallback(
    async (selectedFile: File, mode: ImportMode, applyDefaultMode = false) => {
      if (!warehouseId) {
        toast.error('Avval inventarda omborni tanlang.');
        return;
      }
      setLoading(true);
      try {
        const data = await productsService.importPreview(selectedFile, {
          warehouseId,
          importMode: mode,
        });
        setPreview(data);
        if (applyDefaultMode && data?.defaultImportMode) {
          setImportMode(data.defaultImportMode as ImportMode);
        }
      } catch (err) {
        console.error(err);
        toast.error(formatApiError(err, "Faylni o'qishda xatolik yuz berdi."));
      } finally {
        setLoading(false);
      }
    },
    [warehouseId],
  );

  const handlePreview = (selectedFile: File) =>
    runPreview(selectedFile, importMode, true);

  const confirmableCount = useMemo(
    () => (preview ? countConfirmableRows(preview) : 0),
    [preview],
  );

  const handleImport = async () => {
    if (!preview || confirmableCount === 0 || importing || importInFlightRef.current) {
      return;
    }

    importInFlightRef.current = true;
    importCancelledRef.current = false;
    setImporting(true);
    setImportProgress(null);
    setImportResult(null);
    try {
      const hasImportableStock = (r: any) =>
        r.fileStockMode === 'with_stock' &&
        Number.isFinite(Number(r.initialStockRaw ?? r.initialStock)) &&
        Number(r.initialStockRaw ?? r.initialStock) > 0;

      const validRows = preview.rows
        .filter(
          (r: any) =>
            r.errors.length === 0 &&
            (r.rowAction !== 'skip' || hasImportableStock(r)),
        )
        .map((r: any) => ({
          ...r,
          warehouseId: r.warehouseId || warehouseId,
        }));
      const queued = await productsService.importConfirm(validRows, {
        importMode,
        stockPolicy: 'apply_all',
        warehouseId,
        ...(partnerLedgerContactId ? { partnerLedgerContactId } : {}),
      });

      if (queued?.sync) {
        const ok = Number(queued?.successRows ?? validRows.length);
        const bad = Number(queued?.failedRows ?? 0);
        const total = Number(queued?.totalRows ?? validRows.length);
        setImportResult({
          successRows: ok,
          failedRows: bad,
          total,
          status: String(queued?.status || 'COMPLETED'),
          errorMessage: (queued?.errorMessage as string) || null,
          errors: Array.isArray(queued?.errors) ? queued.errors : [],
        });
        if (queued?.status === 'COMPLETED_WITH_ERRORS' || bad > 0) {
          const firstErr = queued?.errors?.[0]?.message || queued?.errorMessage;
          toast.warning(
            `${ok}/${total} ta import qilindi. ${bad} ta qatorda xato.${firstErr ? ` ${firstErr}` : ''}`,
            { duration: 14_000 },
          );
        } else {
          toast.success(`${ok} ta qator import qilindi.`);
        }
        onSuccess();
        return;
      }

      const jobId = queued?.jobId as string | undefined;
      if (!jobId) {
        throw new Error('Import job yaratilmadi.');
      }
      activeJobIdRef.current = jobId;

      let lastJob: Record<string, unknown>;
      try {
        lastJob = await waitForImportJob(
          jobId,
          validRows.length,
          (update) => setImportProgress(update),
          () => importCancelledRef.current,
        );
      } catch (waitErr) {
        if ((waitErr as Error).message === 'cancelled') {
          toast.info('Import bekor qilindi.');
          return;
        }
        throw waitErr;
      }

      if (importCancelledRef.current) return;

      const status = String(lastJob?.status || '');
      const successRows = Number(lastJob?.successRows || 0);
      const failedRows = Number(lastJob?.failedRows || 0);
      const totalRows = Number(lastJob?.totalRows || validRows.length);

      setImportResult({
        successRows,
        failedRows,
        total: totalRows,
        status,
        errorMessage: (lastJob?.errorMessage as string) || null,
        jobId,
      });

      if (status === 'COMPLETED') {
        toast.success(`${successRows} ta qator import qilindi.`);
        onSuccess();
        return;
      }

      if (status === 'COMPLETED_WITH_ERRORS') {
        toast.warning(
          `${successRows}/${totalRows} ta import qilindi. ${failedRows} ta qatorda xato — inventarda faqat muvaffaqiyatli qatorlar ko‘rinadi.`,
          { duration: 12_000 },
        );
        onSuccess();
        return;
      }

      if (status === 'FAILED' && successRows > 0) {
        toast.warning(
          `Import to‘xtadi: ${successRows}/${totalRows} ta saqlandi, ${failedRows} ta xato.`,
          { duration: 12_000 },
        );
        onSuccess();
        return;
      }

      throw new Error(
        (lastJob?.errorMessage as string) ||
          `Import yakunida xatolik (${failedRows} ta qator bajarilmadi).`,
      );
    } catch (err) {
      if (!importCancelledRef.current) {
        console.error(err);
        toast.error(formatApiError(err, 'Import qilishda xatolik yuz berdi.'));
      }
    } finally {
      importInFlightRef.current = false;
      if (!importCancelledRef.current) {
        setImporting(false);
        setImportProgress(null);
        activeJobIdRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                Excel <span className="text-emerald-400">kirim</span>
              </h2>
              <p className="text-gray-500 text-sm font-medium">
                Mahsulotlar va ombor zaxirasini bir fayldan yuklash
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-3 hover:bg-white/5 rounded-2xl text-gray-500 hover:text-white transition-all focus:outline-none"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {!preview ? (
            <div className="space-y-6 py-4">
              {warehouseName && (
                <p className="text-sm text-blue-200 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3">
                  <strong>Ombor:</strong> {warehouseName} — import shu omborga yoziladi.
                </p>
              )}

              {/* Refactored Guide Section */}
              <ImportGuide />

              <div className="flex flex-col items-center text-center space-y-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-md p-12 border-2 border-dashed border-white/10 rounded-[2.5rem] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                >
                  <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    Excel faylni tanlang
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Faylni shu yerga bosing yoki tanlang.
                    <br /> Faqat .xlsx formatidagi fayllar qabul qilinadi.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx"
                    className="hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => reportsService.getProductTemplate()}
                    className="flex items-center gap-3 px-6 py-3 bg-emerald-600/15 border border-emerald-500/30 rounded-xl text-xs font-black hover:bg-emerald-600/25 transition-all text-emerald-400"
                  >
                    <Download size={16} />
                    Bo‘sh shablon (.xlsx)
                  </button>
                  {warehouseId && (
                    <button
                      type="button"
                      onClick={() =>
                        reportsService.exportProductsForImport(
                          warehouseId,
                          warehouseName,
                          'with_stock',
                        )
                      }
                      className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black hover:bg-white/10 transition-all text-blue-400"
                    >
                      <Download size={16} />
                      Joriy ombor (qoldiq bilan)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Preview Header & Stats */}
              <div className="space-y-3">
                {warehouseName && (
                  <p className="text-sm text-blue-200 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3">
                    <strong>Ombor:</strong> {warehouseName}. Barcha kirim shu omborga yoziladi.
                  </p>
                )}
                {preview.fileStockMode === 'without_stock' && (
                  <p className="text-sm text-amber-100 bg-amber-500/15 border border-amber-500/35 rounded-xl px-4 py-3">
                    <strong>Diqqat:</strong> Faylda zaxira ustuni topilmadi yoki barcha qatorlar bo‘sh.
                    Mahsulotlar yaratiladi/yangilanadi, lekin <strong>omborga kirim yozilmaydi</strong>.
                    Shablonni «Kirim / Qoldiq» ustuni bilan to‘ldiring.
                  </p>
                )}
                {preview.fileStockMode === 'with_stock' && (
                  <p className="text-sm text-emerald-100 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                    <strong>Kirim rejimi:</strong> {preview.stockApplyCount ?? 0} ta qatorda zaxira
                    qo‘llanadi. Tavsiya — <strong>Qo‘shish</strong> (mavjud qoldiq + Excel).
                  </p>
                )}
                {preview.worksheetName && (
                  <p className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    Fayl: <strong className="text-gray-300">{preview.worksheetName}</strong>
                    {preview.excelFormat === 'legacy' ? (
                      <span className="text-amber-400 ml-2">
                        (eski format — yangi shablonni tavsiya qilamiz)
                      </span>
                    ) : (
                      <span className="text-emerald-400 ml-2">(yangi format ✓)</span>
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {IMPORT_STATUS_LEGEND.map((s) => (
                    <span
                      key={s.label}
                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400"
                      title={s.desc}
                    >
                      <strong className="text-gray-300">{s.label}:</strong> {s.desc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick statistics */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Jami</p>
                  <p className="text-xl font-black text-white">{preview.total}</p>
                </div>
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Tasdiqlash</p>
                  <p className="text-xl font-black text-emerald-400">{confirmableCount}</p>
                </div>
                <div className="p-4 bg-teal-500/10 rounded-2xl border border-teal-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-1">Kirim zaxira</p>
                  <p className="text-xl font-black text-teal-300">{preview.stockApplyCount ?? 0}</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">O‘tkazildi</p>
                  <p className="text-xl font-black text-amber-300">{preview.skipped ?? 0}</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Yangi / Yangilash</p>
                  <p className="text-sm font-black text-blue-300">
                    {preview.create ?? 0} / {preview.update ?? 0}
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Xato</p>
                  <p className="text-xl font-black text-red-400">{preview.invalid}</p>
                </div>
              </div>

              {confirmableCount > 0 && !importing && (
                <div className="p-5 sm:p-6 bg-gradient-to-b from-blue-500/[0.06] to-transparent border border-blue-500/20 rounded-2xl">
                  <PartnerLedgerContactSelect
                    compact
                    value={partnerLedgerContactId}
                    onChange={setPartnerLedgerContactId}
                    hint="Faqat kirim (zaxira oshishi) bo‘lgan qatorlar tanlangan hamkor daftariga bitta yig‘ma yozuv sifatida tushadi. Tanlamasangiz — faqat ombor yangilanadi."
                  />
                </div>
              )}

              {/* Import Mode Radio Selectors */}
              {preview.fileStockMode === 'with_stock' && confirmableCount > 0 && !importing && (
                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Ombor qoldig‘i qanday hisoblansin?
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        ['set', 'Almashtirish', 'Excel = yangi qoldiq (kamayishi mumkin)'],
                        ['add', "Qo'shish (kirim)", 'Mavjud qoldiq + Excel miqdori'],
                        ['subtract', 'Ayirish', 'Mavjud − Excel'],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <label
                        key={mode}
                        className={`flex-1 min-w-[140px] cursor-pointer px-4 py-3 rounded-xl border text-left transition-all ${
                          importMode === mode
                            ? 'border-blue-500 bg-blue-600/20 text-white'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          className="sr-only"
                          checked={importMode === mode}
                          onChange={() => {
                            setImportMode(mode);
                            if (file) void runPreview(file, mode, false);
                          }}
                        />
                        <span className="text-sm font-black block">{label}</span>
                        <span className="text-[10px] opacity-70">{hint}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress UI */}
              {importing && importProgress && (
                <div className="space-y-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <div className="flex justify-between text-xs font-bold text-gray-400">
                    <span>Import jarayoni</span>
                    <span>
                      {importProgress.processed}/{importProgress.total} qator
                    </span>
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (importProgress.processed / Math.max(importProgress.total, 1)) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Muvaffaqiyatli:{' '}
                    <span className="text-emerald-400 font-bold">
                      {importProgress.successRows ?? 0}
                    </span>
                    {typeof importProgress.failedRows === 'number' &&
                    importProgress.failedRows > 0 ? (
                      <>
                        {' '}
                        · Xato:{' '}
                        <span className="text-red-400 font-bold">
                          {importProgress.failedRows}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              )}

              {/* Results Alerts */}
              {importResult && !importing && (
                <div
                  className={`text-sm rounded-xl px-4 py-3 border ${
                    importResult.failedRows > 0
                      ? 'text-amber-100 bg-amber-500/10 border-amber-500/30'
                      : 'text-emerald-100 bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <p className="font-black">
                    {importResult.successRows}/{importResult.total} ta import qilindi
                    {importResult.failedRows > 0 ? `, ${importResult.failedRows} ta xato` : ''}.
                  </p>
                  {importResult.errorMessage && (
                    <p className="text-xs mt-1 opacity-80">{importResult.errorMessage}</p>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-3 space-y-2 text-xs">
                      {importResult.errors.map((err, i) => (
                        <li
                          key={`${err.index ?? i}-${err.message}`}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100"
                        >
                          <span className="font-black">
                            Qator {err.rowNumber ?? (err.index != null ? err.index + 1 : i + 1)}
                          </span>
                          {err.name ? ` · ${err.name}` : ''}
                          {err.sku ? ` · SKU: ${err.sku}` : ''}
                          {err.barcode ? ` · ${err.barcode}` : ''}
                          <p className="mt-1 opacity-90">{err.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {importResult.failedRows > 0 && importResult.jobId && (
                    <p className="text-[10px] mt-2 opacity-70">
                      Xato qatorlar serverda saqlangan — qayta import qilishdan oldin Excelni tekshiring.
                    </p>
                  )}
                </div>
              )}

              {importing && (
                <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                  Katta fayllar fon rejimida ishlaydi — modalni yopmasangiz progress ko‘rinadi.
                </p>
              )}

              {/* Refactored virtualized table */}
              <ImportPreviewVirtualTable rows={preview.rows} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={reset}
            disabled={importing}
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl text-sm font-black transition-all disabled:opacity-40"
          >
            Faylni almashtirish
          </button>

          <div className="flex items-center gap-4">
            {importing ? (
              <button
                type="button"
                onClick={() => void handleStopImport()}
                className="px-8 py-4 bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 rounded-2xl text-sm font-black transition-all"
              >
                Importni bekor qilish
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-8 py-4 text-gray-500 hover:text-white text-sm font-black transition-all focus:outline-none"
              >
                Bekor qilish
              </button>
            )}
            <button
              type="button"
              disabled={!preview || confirmableCount === 0 || importing}
              onClick={() => void handleImport()}
              className={`flex items-center gap-3 px-10 py-4 rounded-[1.5rem] text-sm font-black transition-all ${
                !preview || confirmableCount === 0 || importing
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/30 active:scale-95'
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  {importProgress
                    ? `${importProgress.processed}/${importProgress.total}${
                        importProgress.failedRows
                          ? ` (${importProgress.failedRows} xato)`
                          : ''
                      }`
                    : 'Kutilmoqda...'}
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Kirimni tasdiqlash ({confirmableCount})
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6"
            >
              <Loader2 className="animate-spin text-blue-500" size={60} />
              <p className="text-white font-black text-xl">Excel fayl tahlil qilinmoqda</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
