import { WAREHOUSE_SECTION_FEATURE_DEFS } from './warehouse-section-features';

export type ModuleCatalogFeature = {
  key: string;
  name: string;
  description?: string;
};

export type ModuleCatalogEntry = {
  key: string;
  name: string;
  description?: string;
  features: ModuleCatalogFeature[];
};

/** Migratsiyalar va Sozlamalar → Modullar UI bilan mos tizim katalogi */
export const SYSTEM_MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    key: 'WAREHOUSE',
    name: 'Ombor',
    description: 'Qoldiqlar va harakatlar',
    features: WAREHOUSE_SECTION_FEATURE_DEFS.map((f) => ({
      key: f.key,
      name: f.name,
      description: f.description,
    })),
  },
  {
    key: 'POS',
    name: 'POS / Kassa',
    description: 'Chakana sotuv interfeysi',
    features: [
      {
        key: 'POS_TERMINAL',
        name: 'POS interfeysi',
        description: 'Sotuvchi uchun kassa ekrani',
      },
    ],
  },
  {
    key: 'B2B',
    name: 'B2B Savdo',
    description: 'Kompaniyalararo buyurtmalar',
    features: [
      {
        key: 'B2B_ORDERS',
        name: 'B2B buyurtmalar',
        description: 'Buyurtma yaratish va workflow',
      },
      { key: 'B2B_MAIN', name: 'B2B (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'GOODS_RECEIPTS',
    name: 'Kelgan yuklar',
    description: 'Hamkordan kelgan yuklarni qabul qilish',
    features: [
      {
        key: 'GOODS_RECEIPTS_MAIN',
        name: 'Kelgan yuklar',
        description: 'Qabul qilish, qisman qabul va PDF',
      },
      {
        key: 'PARTIAL_RECEIPT',
        name: 'Qisman qabul',
        description: 'Eski feature kaliti (moslik)',
      },
    ],
  },
  {
    key: 'PARTNERS',
    name: 'Hamkorlar',
    description: 'Hamkor kompaniyalar',
    features: [
      {
        key: 'PARTNER_NETWORK',
        name: 'Hamkorlar tarmog‘i',
        description: 'Hamkor qo‘shish va tasdiqlash',
      },
      { key: 'PARTNERS_MAIN', name: 'Hamkorlar (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'PRODUCT_MAPPING',
    name: 'Mahsulot mapping',
    description: 'Hamkor SKU moslashuvi',
    features: [
      {
        key: 'PRODUCT_MAPPING',
        name: 'Mahsulot mapping',
        description: 'Ichki va hamkor mahsulot kodlari',
      },
      {
        key: 'PRODUCT_MAPPING_MAIN',
        name: 'Mapping (asosiy)',
        description: 'Eski seed mosligi',
      },
    ],
  },
  {
    key: 'DEBT',
    name: 'Qarz daftari',
    description: 'B2B qarzlar',
    features: [
      {
        key: 'DEBT_TRACKING',
        name: 'Qarz yozuvlari',
        description: 'Qarz va qoldiq kuzatuvi',
      },
      {
        key: 'PAYMENT_RECORDS',
        name: 'To‘lovlar',
        description: 'To‘lov yaratish va tasdiqlash',
      },
      { key: 'DEBT_MAIN', name: 'Qarz (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'PARTNER_LEDGER',
    name: 'Hamkor daftari',
    description: 'Tizimda bo‘lmagan hamkorlar',
    features: [
      {
        key: 'PARTNER_LEDGER_TRACKING',
        name: 'Hamkor hisobi',
        description: 'Kirim, sotuv, tushum va to‘lovlar',
      },
    ],
  },
  {
    key: 'EXPENSES',
    name: 'Ichki xarajatlar',
    description: 'Chiqim va byudjet',
    features: [
      {
        key: 'EXPENSE_TRACKING',
        name: 'Xarajat yozuvlari',
        description: 'Kategoriyalar va tasdiqlash',
      },
      { key: 'EXPENSES_MAIN', name: 'Xarajatlar (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'INCOME',
    name: 'Kirimlar',
    description: 'Tushum va daromad',
    features: [
      {
        key: 'INCOME_MAIN',
        name: 'Kirimlar',
        description: 'Qo‘lda kiritiladigan tushumlar',
      },
    ],
  },
  {
    key: 'PAYROLL',
    name: 'Oylik',
    description: 'Xodimlar maoshi',
    features: [
      {
        key: 'PAYROLL_MAIN',
        name: 'Oylik hisoblash',
        description: 'Davr bo‘yicha maosh va bonus',
      },
    ],
  },
  {
    key: 'FIELD_SERVICE',
    name: 'Dala xodimlari',
    description: 'Montaj va tashqaridagi ishlar',
    features: [
      {
        key: 'FIELD_TASKS',
        name: 'Dala vazifalari',
        description: 'Vazifa va hisobotlar',
      },
    ],
  },
  {
    key: 'REPORTS',
    name: 'Hisobotlar',
    description: 'Yig‘ma ko‘rinishlar',
    features: [
      {
        key: 'REPORTS_EXPORT',
        name: 'Hisobot va eksport',
        description: 'Excel/PDF va filtrlash',
      },
      { key: 'REPORTS_MAIN', name: 'Hisobotlar (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'STOREFRONT',
    name: 'Onlayn do‘kon',
    description: 'Veb vitrina',
    features: [
      {
        key: 'STOREFRONT_SYNC',
        name: 'Vitrina sinxroni',
        description: 'Mahsulot va buyurtmalar',
      },
      { key: 'STOREFRONT_MAIN', name: 'Do‘kon (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'EMPLOYEES',
    name: 'Xodimlar',
    description: 'Jamoa boshqaruvi',
    features: [
      {
        key: 'TEAM_MANAGEMENT',
        name: 'Jamoa boshqaruvi',
        description: 'Xodimlar va rollar',
      },
      { key: 'EMPLOYEES_MAIN', name: 'Xodimlar (asosiy)', description: 'Eski seed mosligi' },
    ],
  },
  {
    key: 'INTEGRATIONS',
    name: 'Ulanishlar',
    description: 'Telegram va tashqi tizimlar',
    features: [
      {
        key: 'EXTERNAL_CONNECTIONS',
        name: 'Tashqi integratsiyalar',
        description: 'Webhook va bildirishnomalar',
      },
      {
        key: 'INTEGRATIONS_MAIN',
        name: 'Ulanishlar (asosiy)',
        description: 'Eski seed mosligi',
      },
    ],
  },
];

/** Barcha modul va feature yozuvlarini DB ga sinxronlash (migratsiya / seed / UI toggle) */
export async function syncSystemModuleCatalog(prisma: {
  module: { upsert: (args: unknown) => Promise<{ id: string }> };
  feature: { upsert: (args: unknown) => Promise<unknown> };
}) {
  for (const mod of SYSTEM_MODULE_CATALOG) {
    const moduleRecord = await prisma.module.upsert({
      where: { key: mod.key },
      update: {
        name: mod.name,
        description: mod.description ?? null,
      },
      create: {
        key: mod.key,
        name: mod.name,
        description: mod.description ?? null,
      },
    });

    for (const feat of mod.features) {
      await prisma.feature.upsert({
        where: { key: feat.key },
        update: {
          name: feat.name,
          description: feat.description ?? null,
          moduleId: moduleRecord.id,
        },
        create: {
          moduleId: moduleRecord.id,
          key: feat.key,
          name: feat.name,
          description: feat.description ?? null,
        },
      });
    }
  }
}
