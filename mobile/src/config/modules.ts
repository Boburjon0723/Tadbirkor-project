// DB Module key lari bilan mos kelishi SHART
// Barcha DB modullar (migratsiyalardan):
//   POS, EMPLOYEES, STOREFRONT, EXPENSES, REPORTS, INTEGRATIONS, FIELD_SERVICE, PARTNER_LEDGER
//
// Eslatma: WAREHOUSE, B2B, DEBT, PARTNERS, PRODUCT_MAPPING — DB da Module jadvalida yo'q,
// ular asosiy funksionallik sifatida doim mavjud bo'ladi (feature-gate qilinmagan).

export type ModuleCatalogItem = {
  id:
    | 'POS'
    | 'DEBT'
    | 'B2B'
    | 'WAREHOUSE'
    | 'FIELD_SERVICE'
    | 'REPORTS'
    | 'PARTNER_LEDGER'
    | 'EXPENSES'
    | 'EMPLOYEES'
    | 'STOREFRONT'
    | 'INTEGRATIONS';
  name: string;
  desc: string;
};

export const MODULE_CATALOG: ModuleCatalogItem[] = [
  // --- Savdo ---
  {
    id: 'POS',
    name: 'POS Kassa',
    desc: 'Chakana savdo va cheklar',
  },
  {
    id: 'B2B',
    name: 'B2B buyurtmalar',
    desc: 'Ulgurji savdo hisob-kitoblari',
  },

  // --- Ombor ---
  {
    id: 'WAREHOUSE',
    name: 'Ombor va zaxiralar',
    desc: 'Kirim-chiqim va nazorat',
  },

  // --- Moliya ---
  {
    id: 'DEBT',
    name: 'Qarz daftari',
    desc: 'B2B hamkorlar bilan rasmiy qarzlar',
  },
  {
    id: 'PARTNER_LEDGER',
    name: 'Hamkor daftari',
    desc: 'Tizimdan tashqari shaxslar bilan hisob',
  },
  {
    id: 'EXPENSES',
    name: 'Xarajatlar',
    desc: 'Ichki xarajatlar va kategoriyalar',
  },

  // --- Xizmatlar ---
  {
    id: 'FIELD_SERVICE',
    name: 'Dala xizmati',
    desc: 'Agentlar va topshiriqlar',
  },

  // --- Hisobot ---
  {
    id: 'REPORTS',
    name: 'Hisobotlar',
    desc: 'Dashboard va analitika',
  },

  // --- Kompaniya ---
  {
    id: 'EMPLOYEES',
    name: 'Xodimlar',
    desc: 'Jamoa va rollar boshqaruvi',
  },
  {
    id: 'STOREFRONT',
    name: 'Onlayn do\'kon',
    desc: 'Veb-sayt va vitrina bilan sinxron',
  },
  {
    id: 'INTEGRATIONS',
    name: 'Ulanishlar',
    desc: 'Telegram, API va tashqi tizimlar',
  },
];


