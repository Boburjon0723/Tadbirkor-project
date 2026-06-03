'use client';

import React, { useState } from 'react';
import { IMPORT_EXCEL_COLUMNS, IMPORT_EXCEL_TIPS } from '@/lib/product-import-guide';

export function ImportGuide() {
  const [showGuide, setShowGuide] = useState(true);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setShowGuide((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors focus:outline-none"
      >
        <span className="text-sm font-black text-white">
          Excel qanday to‘ldiriladi? (muhim)
        </span>
        <span className="text-xs text-gray-500">{showGuide ? 'Yashirish' : 'Ko‘rsatish'}</span>
      </button>
      {showGuide && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5">
          <ul className="space-y-2 text-xs text-gray-400 leading-relaxed pt-3">
            {IMPORT_EXCEL_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="text-blue-500 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/5 text-gray-500">
                  <th className="px-3 py-2 font-bold">Ustun</th>
                  <th className="px-3 py-2 font-bold">Nomi</th>
                  <th className="px-3 py-2 font-bold">Misol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {IMPORT_EXCEL_COLUMNS.map((col) => (
                  <tr key={col.letter}>
                    <td className="px-3 py-2 font-mono font-bold text-blue-400">
                      {col.letter}
                    </td>
                    <td className="px-3 py-2">
                      {col.header}
                      {col.required && <span className="ml-1 text-red-400">*</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{col.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
