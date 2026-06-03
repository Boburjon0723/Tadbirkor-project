'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { formatStockQuantity } from '@/lib/product-units';

interface ImportPreviewVirtualTableProps {
  rows: any[];
}

export function ImportPreviewVirtualTable({ rows }: ImportPreviewVirtualTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const itemHeight = 76; // fixed approximate row height in pixels
  const overscan = 5;    // extra rows to render to prevent flickering

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    };
    const el = containerRef.current;
    el?.addEventListener('scroll', handleScroll, { passive: true });
    return () => el?.removeEventListener('scroll', handleScroll);
  }, []);

  const totalHeight = rows.length * itemHeight;

  const { startIndex, visibleRows } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(rows.length, Math.ceil((scrollTop + 400) / itemHeight) + overscan); // ~400px scroll viewport height
    
    return {
      startIndex: start,
      visibleRows: rows.slice(start, end).map((row, idx) => ({
        row,
        index: start + idx
      }))
    };
  }, [rows, scrollTop]);

  return (
    <div
      ref={containerRef}
      className="glass-card rounded-[2rem] overflow-x-auto overflow-y-auto border border-white/5 max-h-[40vh] relative custom-scrollbar"
      style={{ height: rows.length > 0 ? 'auto' : '200px' }}
    >
      <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
        <table className="w-full text-left border-collapse absolute top-0 left-0 right-0">
          <thead className="sticky top-0 bg-[#0d0d0d] z-10">
            <tr className="border-b border-white/5 bg-[#0a0a0a]">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 w-[35%]">
                Mahsulot / Variant
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 w-[20%]">
                SKU / Barkod
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 w-[15%]">
                Narx (S / K)
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 w-[15%]">
                Qoldiq
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 w-[15%]">
                Status
              </th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-white/5 text-sm"
            style={{
              transform: `translateY(${startIndex * itemHeight}px)`,
            }}
          >
            {visibleRows.map(({ row, index }) => (
              <tr
                key={index}
                className={`hover:bg-white/[0.02] ${row.errors.length > 0 ? 'bg-red-500/5' : ''}`}
                style={{ height: `${itemHeight}px` }}
              >
                <td className="px-6 py-3">
                  <p className="font-bold text-white truncate max-w-[220px]">{row.name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[220px]">
                    {row.color && (
                      <>
                        <span className="text-gray-600">Rang: </span>
                        {row.color}
                      </>
                    )}
                    {row.variant && (
                      <>
                        {row.color ? ' · ' : null}
                        <span className="text-gray-600">Variant: </span>
                        {row.variant}
                      </>
                    )}
                    {!row.color && !row.variant ? '—' : null}
                  </p>
                </td>
                <td className="px-6 py-3">
                  <p className="text-gray-400 font-mono text-xs truncate max-w-[120px]">
                    {row.sku || '—'}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono truncate max-w-[120px]">{row.barcode}</p>
                </td>
                <td className="px-6 py-3">
                  <p className="text-gray-500 text-[10px]">
                    K: {row.purchasePrice ?? 0}
                  </p>
                  <p className="text-emerald-400 font-bold">
                    S: {row.salePrice} {row.currency || 'UZS'}
                  </p>
                </td>
                <td className="px-6 py-3 text-gray-400">
                  {(() => {
                    const unit = row.unit || row.previousUnit || 'dona';
                    const qty = row.rowAction === 'skip'
                      ? row.previousStock
                      : row.initialStockRaw ?? row.initialStock;
                    
                    if (row.rowAction === 'skip') {
                      return (
                        <span className="text-amber-400/80">
                          {qty != null ? formatStockQuantity(qty, unit) : '—'} (o‘tkazildi)
                        </span>
                      );
                    }
                    return (
                      <span>
                        {row.previousStock != null && (
                          <span className="text-gray-500 line-through mr-1">
                            {formatStockQuantity(row.previousStock, row.previousUnit || unit)}
                          </span>
                        )}
                        <span className="text-white font-bold">
                          {qty != null ? formatStockQuantity(qty, unit) : '—'}
                        </span>
                      </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-3">
                  {row.errors.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-red-500 text-[10px] font-bold uppercase">
                        Xato
                      </span>
                      {row.errors.map((msg: string, errIdx: number) => (
                        <p
                          key={errIdx}
                          className="text-[10px] text-red-400/90 leading-snug max-w-[150px] truncate"
                          title={msg}
                        >
                          {msg}
                        </p>
                      ))}
                    </div>
                  ) : row.rowAction === 'skip' ? (
                    <span className="text-amber-500 text-[10px] font-bold uppercase">
                      O‘tkazildi
                    </span>
                  ) : row.rowAction === 'update' ? (
                    <span className="text-blue-400 text-[10px] font-bold uppercase">
                      Yangilash
                      {row.hasStockInWarehouse === false && (
                        <span className="block text-[9px] font-bold text-blue-300/80 normal-case mt-0.5">
                          Katalogda bor, omborda qoldiq yo‘q
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-emerald-500 text-[10px] font-bold uppercase">
                      Yangi
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
