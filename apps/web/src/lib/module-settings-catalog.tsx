import type { LucideIcon } from 'lucide-react';
import {
  Warehouse as WarehouseIcon,
  ShoppingCart,
  Globe,
  Package,
  Banknote,
  CreditCard,
  Users,
  Truck,
  Store,
  Wallet2,
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
  { id: 'warehouse', title: 'Ombor' },
  { id: 'pos', title: 'Chakana (POS)' },
  { id: 'b2b', title: 'B2B savdo' },
  { id: 'finance', title: 'Moliya (B2B)' },
  { id: 'field', title: 'Dala xizmati' },
  { id: 'reports', title: 'Hisobot' },
  { id: 'company', title: 'Kompaniya' },
];

export const MODULE_SETTINGS_CATALOG: ModuleSettingDefinition[] = [
  {
    key: 'WAREHOUSE',
    groupId: 'warehouse',
    name: 'Ombor',
    desc: 'Qoldiqlar va harakatlar',
    details:
      'Katalog va qoldiq. Saralash, ATP, inventarizatsiya — shu modul ichidagi alohida bo‘limlardan yoqiladi.',
    icon: WarehouseIcon,
  },
  {
    key: 'POS',
    groupId: 'pos',
    name: 'POS / Kassa',
    desc: 'Chakana sotuv interfeysi',
    details:
      'Sotuvchi roli uchun kassa ekrani va tezkor sotuv. Chakana nasiya (mijozlar qarzi) alohida: Sozlamalar → Kompaniya → «POS nasiya». «Qarz Daftari» moduli — B2B hamkorlar uchun.',
    icon: CreditCard,
  },
  {
    key: 'B2B',
    groupId: 'b2b',
    name: 'B2B Savdo',
    desc: 'Hamkorlar va buyurtmalar',
    details:
      'Kompaniyalararo buyurtma oqimi, tasdiqlash va workflow asosidagi vazifalar shu yerda ishlaydi.',
    icon: ShoppingCart,
  },
  {
    key: 'PARTNERS',
    groupId: 'b2b',
    name: 'Hamkorlar',
    desc: 'Hamkor kompaniyalar bilan ishlash',
    details:
      'Yetkazib beruvchi/xaridor hamkorlar ro‘yxati, statuslar va aloqador ma’lumotlar boshqariladi.',
    icon: Globe,
  },
  {
    key: 'PRODUCT_MAPPING',
    groupId: 'b2b',
    name: 'Mahsulot Mapping',
    desc: 'Hamkor mahsulotlarini bog‘lash',
    details:
      'Ichki SKU bilan hamkor SKU moslashuvi, qabul va jo‘natma jarayonlaridagi nomuvofiqlikni kamaytiradi.',
    icon: Package,
  },
  {
    key: 'DEBT',
    groupId: 'finance',
    name: 'Qarz daftari',
    desc: "O'zaro hisob-kitoblar",
    details:
      'Qarz yozuvlari, to‘lov yaratish, tasdiqlash/rad etish va audit tarixi shu modulda yuritiladi (B2B hamkorlar).',
    icon: Banknote,
  },
  {
    key: 'PARTNER_LEDGER',
    groupId: 'finance',
    name: 'Hamkor daftari',
    desc: 'Tizimda bo‘lmagan hamkorlar',
    details:
      'Xomashyo kirimi, sotish, tushum va to‘lov — qo‘lda yuritiladigan hisob. Platformada ro‘yxatdan o‘tmagan hamkorlar uchun.',
    icon: Users,
  },
  {
    key: 'EXPENSES',
    groupId: 'finance',
    name: 'Ichki xarajatlar',
    desc: 'Chiqim va byudjet',
    details: 'Ofis, transport, xizmatlar va boshqa ichki xarajatlari kuzatish (rivojlantirilmoqda).',
    icon: Wallet2,
  },
  {
    key: 'PAYROLL',
    groupId: 'finance',
    name: 'Oylik',
    desc: 'Xodimlar maoshi',
    details:
      'Asosiy oylik, bonus/jarima, davr bo‘yicha hisoblash va tasdiqlash. EMPLOYEES moduli yoqilgan bo‘lishi kerak.',
    icon: Banknote,
  },
  {
    key: 'FIELD_SERVICE',
    groupId: 'field',
    name: 'Dala xodimlari',
    desc: 'Montaj, kuryer va tashqaridagi ishlar',
    details:
      'Vazifa yaratish, ombordan tovar biriktirish, ishchi hisoboti va tasdiqlash. FIELD_WORKER roli mobil /field interfeysidan ishlaydi.',
    icon: Truck,
  },
  {
    key: 'REPORTS',
    groupId: 'reports',
    name: 'Hisobotlar',
    desc: 'Yig‘ma ko‘rinishlar',
    details: 'Yig‘ma hisobotlar, filtrlash va eksport (rivojlantirilmoqda).',
    icon: BarChart3,
  },
  {
    key: 'STOREFRONT',
    groupId: 'company',
    name: 'Onlayn do‘kon',
    desc: 'Veb-sayt bilan sinxron',
    details: 'Tashqi vitrina, mahsulot va buyurtmalar sinxroni (keyingi versiyalarda kengayadi).',
    icon: Store,
  },
  {
    key: 'EMPLOYEES',
    groupId: 'company',
    name: 'Xodimlar',
    desc: 'Jamoa va hisoblar',
    details:
      'Xodim qo‘shish va jamoa ro‘yxati (Jamoa sahifasi) shu modulga bog‘liq. Rollar: Sozlamalar → Rollar.',
    icon: Users,
  },
  {
    key: 'INTEGRATIONS',
    groupId: 'company',
    name: 'Ulanishlar',
    desc: 'Telegram, API, webhook',
    details: 'Tashqi tizimlar, Telegram va webhook orqali ulanishlarni markazlashtirish.',
    icon: Link2,
  },
];

export function modulesBySettingGroup(
  groupId: ModuleSettingGroupId,
): ModuleSettingDefinition[] {
  return MODULE_SETTINGS_CATALOG.filter((m) => m.groupId === groupId);
}
