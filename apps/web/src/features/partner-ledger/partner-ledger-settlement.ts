import type { PartnerLedgerSettlementType } from '@/services/partner-ledger.service';

export const SETTLEMENT_OPTIONS: Array<{
  value: PartnerLedgerSettlementType;
  label: string;
  hint: string;
}> = [
  {
    value: 'on_credit',
    label: 'Qarzga',
    hint: 'Tovar berildi — keyin «Tushum» orqali pul qabul qilasiz',
  },
  {
    value: 'cash',
    label: 'Naqd pul',
    hint: 'Hamkor darhol naqd beradi — «Tushum» yozuvini qo‘shing',
  },
  {
    value: 'card',
    label: 'Karta / o‘tkazma',
    hint: 'Bank orqali — tushum kelgach daftarga qayd eting',
  },
  {
    value: 'barter',
    label: 'Bartar',
    hint: 'Boshqa tovar yoki xizmat almashinuvi — izohda yozing',
  },
  {
    value: 'partial',
    label: 'Qisman to‘lov',
    hint: 'Qisman naqd, qolgani qarz — ikkala operatsiyani yozing',
  },
  {
    value: 'promised',
    label: 'Kelishilgan muddat',
    hint: 'Aniq sana/va’da — «Hamkor nima beradi» maydonida yozing',
  },
];
