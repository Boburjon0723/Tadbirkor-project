/**
 * Bo‘lim nomlari — menyu, sahifa sarlavhalari va modul sozlamalari uchun yagona manba.
 * Foydalanuvchi tushunadigan, funksiyaga mos o‘zbekcha nomlar.
 */
export const SECTION = {
  dashboard: 'Asosiy',
  posKassa: 'Kassa',
  posCenter: 'Kassa boshqaruvi',
  inventory: 'Katalog va qoldiq',
  warehouseIntake: 'Skaner kirimi',
  warehouseIntakeSettings: 'Kirim qoidalari',
  warehouseHistory: 'Ombor harakatlari',
  warehouseBalances: 'Ombor qoldiqlari',
  warehouseList: 'Omborlar ro‘yxati',
  activity: 'Tizim jurnali',
  picking: 'Buyurtma yig‘ish',
  warehouseAtp: 'Sotuvga tayyor zaxira',
  inventoryCount: 'Sanoq va tekshiruv',
  partners: 'B2B hamkorlar',
  productMapping: 'Mahsulot moslashuvi',
  orders: 'B2B buyurtmalar',
  receipts: 'Yuk qabul qilish',
  debts: 'B2B qarzlar',
  partnerLedger: 'Qo‘lda hisob daftari',
  expenses: 'Ichki xarajatlar',
  income: 'Boshqa tushumlar',
  payroll: 'Ish haqi',
  field: 'Dala vazifalari',
  reports: 'Savdo hisoboti',
  reportsMonthly: 'Oylik foyda-zarar',
  storefront: 'Onlayn do‘kon',
  team: 'Jamoa',
  integrations: 'Telegram va ulanishlar',
  settings: 'Sozlamalar',
  help: 'Yordam',
} as const;

export const GROUP = {
  general: 'Umumiy',
  pos: 'Chakana savdo',
  warehouse: 'Ombor',
  b2b: 'B2B savdo',
  finance: 'Moliya va hisob',
  field: 'Dala xizmati',
  reports: 'Hisobotlar',
  company: 'Kompaniya',
  system: 'Tizim',
} as const;

/** Mobil pastki menyu — qisqa yozuvlar */
export function mobileNavShortLabel(menuLabel: string): string {
  const map: Record<string, string> = {
    [SECTION.dashboard]: 'Asosiy',
    [SECTION.posKassa]: 'Kassa',
    [SECTION.posCenter]: 'Kassa+',
    [SECTION.inventory]: 'Katalog',
    [SECTION.warehouseIntake]: 'Kirim',
    [SECTION.warehouseIntakeSettings]: 'Qoida',
    [SECTION.warehouseHistory]: 'Harakat',
    [SECTION.activity]: 'Jurnal',
    [SECTION.picking]: 'Yig‘ish',
    [SECTION.warehouseAtp]: 'Zaxira',
    [SECTION.inventoryCount]: 'Sanoq',
    [SECTION.partners]: 'Hamkor',
    [SECTION.productMapping]: 'Moslash',
    [SECTION.orders]: 'Buyurtma',
    [SECTION.receipts]: 'Yuklar',
    [SECTION.debts]: 'Qarzlar',
    [SECTION.partnerLedger]: 'Daftar',
    [SECTION.expenses]: 'Xarajat',
    [SECTION.income]: 'Tushum',
    [SECTION.payroll]: 'Oylik',
    [SECTION.field]: 'Dala',
    [SECTION.reports]: 'Hisobot',
    [SECTION.reportsMonthly]: 'Oy mol.',
    [SECTION.storefront]: 'Do‘kon',
    [SECTION.team]: 'Jamoa',
    [SECTION.integrations]: 'Ulanish',
    [SECTION.settings]: 'Sozlama',
    [SECTION.help]: 'Yordam',
  };
  if (map[menuLabel]) return map[menuLabel];
  if (menuLabel.length > 11) return menuLabel.split(' ')[0] ?? menuLabel;
  return menuLabel;
}
