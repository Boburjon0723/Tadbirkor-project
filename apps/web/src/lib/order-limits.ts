/** API bilan mos: bitta buyurtmadagi maksimal mahsulot qatorlari (Railway: B2B_ORDER_MAX_LINE_ITEMS). */
const raw = Number(process.env.NEXT_PUBLIC_B2B_ORDER_MAX_LINE_ITEMS || 1000);

export const ORDER_MAX_LINE_ITEMS = Math.min(
  Math.max(Number.isFinite(raw) ? raw : 1000, 1),
  2000,
);

/** Tafsilot modali: bir sahifada ko‘rsatiladigan qatorlar. */
export const ORDER_ITEMS_PAGE_SIZE = 50;

/** Shu qatordan ko‘p bo‘lsa API sahifalab yuboradi. */
export const ORDER_ITEMS_INLINE_MAX = 80;
