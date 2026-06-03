/** Excel import — foydalanuvchi qo'llanmasi (API bilan mos) */

export const IMPORT_EXCEL_COLUMNS = [
  { letter: 'A', header: 'Mahsulot Nomi', required: true, example: 'BX-109' },
  { letter: 'B', header: 'SKU', required: false, example: 'BX-109' },
  { letter: 'C', header: 'Shtrix-kod', required: false, example: '4780012345678' },
  { letter: 'D', header: 'Rang', required: false, example: 'Qora' },
  { letter: 'E', header: 'Variant nomi', required: false, example: 'L' },
  { letter: 'F', header: 'Kirim Narxi', required: false, example: '100000' },
  { letter: 'G', header: 'Sotuv Narxi', required: false, example: '5.8' },
  { letter: 'H', header: 'Valyuta', required: false, example: 'USD' },
  { letter: 'I', header: "Boshlang'ich Qoldiq", required: false, example: '12,5' },
  { letter: 'J', header: 'Birlik', required: false, example: 'kg' },
  { letter: 'K', header: 'Kategoriya', required: false, example: 'Kiyim > Erkaklar' },
  { letter: 'L', header: 'Ombor Nomi', required: false, example: 'Asosiy Ombor' },
] as const;

export const IMPORT_EXCEL_TIPS = [
  'Avval «Namunaviy shablon» yoki «Excel eksport» ni yuklab oling — ustunlar to\'g\'ri bo\'ladi.',
  'Tahrir faqat Import varag\'ida. 1-qator sarlavha, ma\'lumot 2-qatordan.',
  'A = mahsulot nomi, B = mahsulot kodi (SKU). Nom ichida «BYT-014/A» bo\'lsa, kod avtomatik ajratiladi.',
  'D = rang, E = o\'lcham/variant (L, XL). E ni rang bilan bir xil qoldirmang — tizim E ni bo\'sh qoldiradi.',
  'Qayta import: «Variant ID» ustunini o\'zgartirmang — yangilash uchun kerak.',
  'Bitta mahsulot = bir nechta qator (har rang uchun alohida qator, SKU bir xil bo\'lishi mumkin).',
  'Narx G ustunida (5.8 yoki 5,8). Valyuta H ustunida alohida: USD yoki UZS.',
  'H ustuniga raqam yozmang — «5» yoki «5,8» valyuta emas, xato beradi.',
  'Birlik (J): dona, kg, l (litr), m (metr). Bo\'sh qoldirilsa — dona.',
  'Qoldiq (I): vergul (12,5) yoki nuqta (12.5) — ikkalasi ham qabul qilinadi.',
  'O\'nlik qoldiq uchun J ustunda kg, l yoki m tanlang. Bo\'sh qoldirilsa — dona (faqat butun son).',
  'Inventarda tanlangan omborga import qilinadi; L ustunidagi ombor nomi e\'tiborsiz qoldirilishi mumkin.',
] as const;

export const IMPORT_STATUS_LEGEND = [
  { label: 'Yangi', desc: 'Katalogda yo\'q — yaratiladi' },
  { label: 'Yangilash', desc: 'SKU/barkod/rang bo\'yicha topildi — narx/qoldiq yangilanadi' },
  { label: 'O\'tkazildi', desc: 'O\'zgarish yo\'q — import qilinmaydi' },
  { label: 'Xato', desc: 'Ustun noto\'g\'ri — qator import qilinmaydi' },
] as const;
