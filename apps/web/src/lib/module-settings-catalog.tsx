import type { LucideIcon } from 'lucide-react';
import { GROUP, SECTION } from '@/lib/dashboard-labels';
import {
  Warehouse as WarehouseIcon,
  ShoppingCart,
  Globe,
  Package,
  Banknote,
  CreditCard,
  Users,
  Truck,
  PackageCheck,
  Store,
  Wallet2,
  TrendingUp,
  BarChart3,
  Link2,
} from 'lucide-react';

export type ModuleSettingGroupId =
  | 'warehouse'
  | 'pos'
  | 'b2b'
  | 'finance'
  | 'field'
  | 'reports'
  | 'company';

export type ModuleSettingDefinition = {
  key: string;
  groupId: ModuleSettingGroupId;
  name: string;
  desc: string;
  details: string;
  icon: LucideIcon;
};

/** Sidebar guruhlari bilan mos */
export const MODULE_SETTING_GROUPS: { id: ModuleSettingGroupId; title: string }[] = [
  { id: 'warehouse', title: GROUP.warehouse },
  { id: 'pos', title: GROUP.pos },
  { id: 'b2b', title: GROUP.b2b },
  { id: 'finance', title: GROUP.finance },
  { id: 'field', title: GROUP.field },
  { id: 'reports', title: GROUP.reports },
  { id: 'company', title: GROUP.company },
];

export const MODULE_SETTINGS_CATALOG: ModuleSettingDefinition[] = [
  {
    key: 'WAREHOUSE',
    groupId: 'warehouse',
    name: 'Ombor (katalog va qoldiq)',
    desc: 'Mahsulotlar, qoldiq va harakatlar',
    details:
      'Katalog va qoldiq. Saralash, ATP, inventarizatsiya — shu modul ichidagi alohida bo‘limlardan yoqiladi.',
    icon: WarehouseIcon,
  },
  {
    key: 'POS',
    groupId: 'pos',
    name: SECTION.posKassa,
    desc: 'Kassada tezkor sotuv',
    details:
      'Sotuvchi roli uchun kassa ekrani va tezkor sotuv. Chakana nasiya (mijozlar qarzi) alohida: Sozlamalar → Kompaniya → «POS nasiya». «Qarz Daftari» moduli — B2B hamkorlar uchun.',
    icon: CreditCard,
  },
  {
    key: 'B2B',
    groupId: 'b2b',
    name: SECTION.orders,
    desc: 'Hamkorlar orasidagi buyurtmalar',
    details:
      'Kompaniyalararo buyurtma oqimi, tasdiqlash va workflow asosidagi vazifalar shu yerda ishlaydi.',
    icon: ShoppingCart,
  },
  {
    key: 'GOODS_RECEIPTS',
    groupId: 'b2b',
    name: SECTION.receipts,
    desc: 'Hamkordan kelgan yukni qabul qilish',
    details:
      'Jo‘natma bo‘yicha qabul qilish, qisman qabul, PDF va qabul tarixi. Omborchi va menejer uchun.',
    icon: PackageCheck,
  },
  {
    key: 'PARTNERS',
    groupId: 'b2b',
    name: SECTION.partners,
    desc: 'B2B hamkor kompaniyalar ro‘yxati',
    details:
      'Yetkazib beruvchi/xaridor hamkorlar ro‘yxati, statuslar va aloqador ma’lumotlar boshqariladi.',
    icon: Globe,
  },
  {
    key: 'PRODUCT_MAPPING',
    groupId: 'b2b',
    name: SECTION.productMapping,
    desc: 'Hamkor nomini o‘z katalogingizga bog‘lash',
    details:
      'Ichki SKU bilan hamkor SKU moslashuvi, qabul va jo‘natma jarayonlaridagi nomuvofiqlikni kamaytiradi.',
    icon: Package,
  },
  {
    key: 'DEBT',
    groupId: 'finance',
    name: SECTION.debts,
    desc: 'B2B hamkorlar bilan qarz va to‘lovlar',
    details:
      'Qarz yozuvlari, to‘lov yaratish, tasdiqlash/rad etish va audit tarixi shu modulda yuritiladi (B2B hamkorlar).',
    icon: Banknote,
  },
  {
    key: 'PARTNER_LEDGER',
    groupId: 'finance',
    name: SECTION.partnerLedger,
    desc: 'Tizimda ro‘yxatdan o‘tmagan hamkorlar hisobi',
    details:
      'Xomashyo kirimi, sotish, tushum va to‘lov — qo‘lda yuritiladigan hisob. Platformada ro‘yxatdan o‘tmagan hamkorlar uchun.',
    icon: Users,
  },
  {
    key: 'EXPENSES',
    groupId: 'finance',
    name: 'Ichki xarajatlar',
    desc: 'Chiqim va byudjet',
    details: 'Ofis, transport, xizmatlar va boshqa ichki xarajatlari kuzatish.',
    icon: Wallet2,
  },
  {
    key: 'INCOME',
    groupId: 'finance',
    name: SECTION.income,
    desc: 'Savddan tashqari qo‘lda kiritiladigan tushumlar',
    details: 'Savdo, qarz qaytimi, xizmat haqi va boshqa qo‘lda kiritiladigan kirimlar.',
    icon: TrendingUp,
  },
  {
    key: 'PAYROLL',
    groupId: 'finance',
    name: SECTION.payroll,
    desc: 'Xodimlar ish haqi hisobi',
    details:
      'Asosiy oylik, bonus/jarima, davr bo‘yicha hisoblash va tasdiqlash. EMPLOYEES moduli yoqilgan bo‘lishi kerak.',
    icon: Banknote,
  },
  {
    key: 'FIELD_SERVICE',
    groupId: 'field',
    name: SECTION.field,
    desc: 'Montaj, kuryer va tashqaridagi vazifalar',
    details:
      'Vazifa yaratish, ombordan tovar biriktirish, ishchi hisoboti va tasdiqlash. FIELD_WORKER roli mobil /field interfeysidan ishlaydi.',
    icon: Truck,
  },
  {
    key: 'REPORTS',
    groupId: 'reports',
    name: SECTION.reports,
    desc: 'Savdo, ombor va moliya ko‘rinishi',
    details: 'Ombor marjasi, oy moliyasi (foyda/zarar) va Excel eksport.',
    icon: BarChart3,
  },
  {
    key: 'STOREFRONT',
    groupId: 'company',
    name: SECTION.storefront,
    desc: 'Veb-sayt bilan sinxron',
    details: 'Tashqi vitrina, mahsulot va buyurtmalar sinxroni (keyingi versiyalarda kengayadi).',
    icon: Store,
  },
  {
    key: 'EMPLOYEES',
    groupId: 'company',
    name: SECTION.team,
    desc: 'Xodimlar va tizimga kirish hisoblari',
    details:
      'Xodim qo‘shish va jamoa ro‘yxati (Jamoa sahifasi) shu modulga bog‘liq. Rollar: Sozlamalar → Rollar.',
    icon: Users,
  },
  {
    key: 'INTEGRATIONS',
    groupId: 'company',
    name: SECTION.integrations,
    desc: 'Telegram bot va boshqa ulanishlar',
    details: 'Tashqi tizimlar, Telegram va webhook orqali ulanishlarni markazlashtirish.',
    icon: Link2,
  },
];

export function modulesBySettingGroup(
  groupId: ModuleSettingGroupId,
): ModuleSettingDefinition[] {
  return MODULE_SETTINGS_CATALOG.filter((m) => m.groupId === groupId);
}
