'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText, CheckCircle } from 'lucide-react';
import { SaleCurrency, saleCurrencySuffix } from '@/lib/currency';
import { formatStockQuantity } from '@/lib/product-units';

export type ReceiptData = {
  receiptNumber?: string;
  date: Date;
  cashierName: string;
  warehouseName: string;
  items: {
    name: string;
    quantity: number;
    unit?: string;
    price: number;
    amount: number;
  }[];
  total: number;
  currency: SaleCurrency;
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT';
  customerName?: string;
  cashReceived?: number;
  change?: number;
};

type Props = {
  open: boolean;
  data: ReceiptData | null;
  onClose: () => void;
  formatMoney: (v: number, currency?: SaleCurrency) => string;
};

export function PosReceiptPrintModal({ open, data, onClose, formatMoney }: Props) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = (format: 'thermal' | 'a4') => {
    if (!data) return;
    setPrinting(true);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const suffix = saleCurrencySuffix(data.currency);
    const dateStr = data.date.toLocaleString('uz-UZ', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    let htmlContent = '';

    if (format === 'thermal') {
      const itemsHtml = data.items.map(i => {
        const qtyText = formatStockQuantity(i.quantity, i.unit);
        return `
        <div class="flex">
          <div style="flex: 1; padding-right: 10px;">${i.name}</div>
          <div style="text-align: right; white-space: nowrap;">
            ${qtyText} x ${i.price.toLocaleString('en-US')}
            <br/><b>${i.amount.toLocaleString('en-US')} ${suffix}</b>
          </div>
        </div>
      `;
      }).join('');

      htmlContent = `
        <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 13px; color: #000; margin: 0; padding: 10px 10px 20px 10px; width: 80mm; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .flex { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            h2 { margin: 5px 0; font-size: 18px; text-transform: uppercase; }
            p { margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2>CHEK / RECEIPT</h2>
            <p>${data.warehouseName}</p>
          </div>
          <div class="divider"></div>
          <p><b>Sana:</b> ${dateStr}</p>
          <p><b>Chek №:</b> ${data.receiptNumber || 'N/A'}</p>
          <p><b>Kassir:</b> ${data.cashierName}</p>
          ${data.customerName ? `<p><b>Mijoz:</b> ${data.customerName}</p>` : ''}
          <p><b>To'lov turi:</b> ${data.paymentMethod === 'CASH' ? 'Naqd' : data.paymentMethod === 'CARD' ? 'Karta' : 'Nasiya'}</p>
          <div class="divider"></div>
          
          <div style="margin-bottom: 5px;" class="bold">Mahsulotlar:</div>
          ${itemsHtml}
          
          <div class="divider"></div>
          <div class="flex bold" style="font-size: 16px;">
            <span>JAMI:</span>
            <span>${formatMoney(data.total, data.currency)}</span>
          </div>
          
          ${data.paymentMethod === 'CASH' ? `
            <div class="flex" style="margin-top: 5px;">
              <span>To'landi:</span>
              <span>${formatMoney(data.cashReceived || 0, data.currency)}</span>
            </div>
            <div class="flex">
              <span>Qaytim:</span>
              <span>${formatMoney(data.change || 0, data.currency)}</span>
            </div>
          ` : ''}
          
          <div class="divider"></div>
          <div class="center">
            <p>Xaridingiz uchun rahmat!</p>
            <p style="font-size: 10px; margin-top: 10px;">AXIS ERP bilan avtomatlashtirilgan</p>
          </div>
        </body>
        </html>
      `;
    } else {
      const itemsHtml = data.items.map((i, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${i.name}</td>
          <td class="center">${formatStockQuantity(i.quantity, i.unit)}</td>
          <td class="right">${i.price.toLocaleString('en-US')}</td>
          <td class="right bold">${i.amount.toLocaleString('en-US')}</td>
        </tr>
      `).join('');

      htmlContent = `
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0 auto; padding: 40px; width: 210mm; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            h1 { margin: 0 0 10px 0; font-size: 28px; color: #111; text-transform: uppercase; letter-spacing: 2px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .info-box p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 12px; }
            th { background: #f5f5f5; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #555; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .totals { width: 300px; margin-left: auto; background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .flex { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .total-row { font-size: 18px; font-weight: bold; color: #111; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ccc; }
            .footer { margin-top: 50px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>INVOYS / CHEK</h1>
              <p style="margin:0; font-size: 16px; color: #666;">${data.warehouseName}</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0 0 5px 0;">№ ${data.receiptNumber || 'N/A'}</h2>
              <p style="margin:0; color: #666;">Sana: ${dateStr}</p>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <p class="bold" style="margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Mijoz ma'lumotlari</p>
              <p>Mijoz: ${data.customerName || "Noma'lum"}</p>
            </div>
            <div class="info-box">
              <p class="bold" style="margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">To'lov ma'lumotlari</p>
              <p>Kassir: ${data.cashierName}</p>
              <p>To'lov turi: ${data.paymentMethod === 'CASH' ? 'Naqd' : data.paymentMethod === 'CARD' ? 'Plastik karta' : 'Nasiya'}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th class="center" style="width: 50px;">T/r</th>
                <th>Mahsulot nomi</th>
                <th class="center" style="width: 80px;">Soni</th>
                <th class="right" style="width: 120px;">Narxi (${suffix})</th>
                <th class="right" style="width: 150px;">Summa (${suffix})</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="flex total-row">
              <span>JAMI TO'LOV:</span>
              <span>${formatMoney(data.total, data.currency)}</span>
            </div>
            ${data.paymentMethod === 'CASH' ? `
              <div class="flex" style="margin-top: 10px; font-size: 13px; color: #555;">
                <span>Qabul qilindi:</span>
                <span>${formatMoney(data.cashReceived || 0, data.currency)}</span>
              </div>
              <div class="flex" style="font-size: 13px; color: #555;">
                <span>Qaytim:</span>
                <span>${formatMoney(data.change || 0, data.currency)}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>Xaridingiz uchun rahmat!</p>
            <p>AXIS ERP tizimi orqali avtomatlashtirilgan (tadbirkor.net)</p>
          </div>
        </body>
        </html>
      `;
    }

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setPrinting(false);
          // Auto close after successful print trigger
          onClose();
        }, 1000);
      }, 500); // Give it half a second to render
    } else {
      setPrinting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && data && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-6"
          data-revert-theme="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-[var(--pos-panel)] border border-[var(--pos-border)] rounded-[2rem] p-8 relative shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none" />
            
            <button
              type="button"
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/50 text-gray-500 hover:text-white transition-all z-10"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-emerald-500/10 text-[var(--pos-money)] rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Sotuv bajarildi!</h2>
              <p className="text-gray-400 text-sm">
                Xaridorga chek berish uchun quyidagi formatlardan birini tanlang.
              </p>
            </div>

            <div className="space-y-3 relative z-10">
              <button
                type="button"
                disabled={printing}
                onClick={() => handlePrint('thermal')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--pos-border)] bg-slate-800/50 hover:bg-white/10 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-blue-500/10 text-cyan-300 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Printer size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-0.5">Termal Chek (58/80mm)</h3>
                  <p className="text-xs text-gray-500">Do'kon printerlari uchun ixcham chek</p>
                </div>
              </button>

              <button
                type="button"
                disabled={printing}
                onClick={() => handlePrint('a4')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--pos-border)] bg-slate-800/50 hover:bg-white/10 hover:border-purple-500/50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-0.5">A4 Invoys Format</h3>
                  <p className="text-xs text-gray-500">Standart A4 o'lchamdagi to'liq hisobot</p>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--pos-border)] relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 text-sm font-bold text-gray-400 hover:text-white transition-colors"
              >
                Cheksiz davom etish
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
