import { BadRequestException } from '@nestjs/common';

/** Bitta buyurtmadagi maksimal qatorlar (mahsulot pozitsiyalari). */
const raw = Number(process.env.B2B_ORDER_MAX_LINE_ITEMS || 500);

export const B2B_ORDER_MAX_LINE_ITEMS = Math.min(Math.max(Number.isFinite(raw) ? raw : 500, 1), 2000);

export function assertOrderLineCount(count: number): void {
  if (count > B2B_ORDER_MAX_LINE_ITEMS) {
    throw new BadRequestException(
      `Bitta buyurtmada ${B2B_ORDER_MAX_LINE_ITEMS} tadan ortiq mahsulot qo‘shib bo‘lmaydi (hozir ${count} ta).`,
    );
  }
}
