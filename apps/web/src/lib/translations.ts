export type Language = 'uz' | 'ru' | 'en';

export const translations = {
  uz: {
    nav: {
      features: "Imkoniyatlar",
      howItWorks: "Qanday ishlaydi",
      pricing: "Tariflar",
      faq: "FAQ",
      login: "Kirish",
      getStarted: "7 kun bepul boshlash"
    },
    hero: {
      badge: "MOSLASHUVCHAN B2B ERP TIZIMI",
      title_part1: "Tadbirkoringizga moslashadigan",
      title_gradient: "B2B ERP",
      title_part2: "tizimi",
      subtitle: "Axis ERP mahsulot, ombor, B2B buyurtma, invoice va qarz daftarini yagona tizimda boshqarishga yordam beradi. Tizim biznesingiz turiga qarab kerakli bo‘limlarni o‘zi moslashtiradi.",
      cta_primary: "7 kun bepul boshlash",
      cta_secondary: "Demoni ko‘rish",
      footer_note: "Karta talab qilinmaydi. 5 daqiqada ro‘yxatdan o‘ting va tizimni sinab ko‘ring.",
      status_cards: {
        order: "Buyurtma qabul qilindi",
        stock: "Ombor qoldig‘i yangilandi",
        debt: "Qarz avtomatik yaratildi",
        mapping: "Mapping talab qilinadi"
      }
    },
    social_proof: {
      title: "Real biznes jarayonlari asosida ishlab chiqilgan",
      pilot: "Pilot korxonalar bilan sinovdan o‘tkazilmoqda"
    },
    problem: {
      title: "Biznesdagi chalkashlik ko‘pincha tizim yo‘qligidan emas, tizim mos kelmasligidan boshlanadi",
      subtitle: "Ko‘p tadbirkorlar hisob-kitobni Excel, Telegram, daftar yoki turli alohida dasturlarda yuritadi. Natijada ombor, buyurtma, qarz va hamkorlar bilan sverka jarayoni murakkablashadi.",
      cards: [
        { title: "Ombor qoldig‘i aniq emas", desc: "Mahsulot kirimi va chiqimi vaqtida yozilmasa, real qoldiq bilan tizimdagi qoldiq mos kelmay qoladi." },
        { title: "Hamkor bilan sverka qiyin", desc: "Sotuvchi va xaridor har biri alohida yozuv yuritgani uchun “kim kimga qancha qarzdor?” degan savol doim ochiq qoladi." },
        { title: "Buyurtmalar yo‘qolib ketadi", desc: "Buyurtmalar Telegram, telefon yoki og‘zaki kelishuv orqali yuritilganda ularni nazorat qilish qiyinlashadi." },
        { title: "Har bir xodimga alohida nazorat kerak", desc: "Omborchi, buxgalter, menejer va sotuvchi bir xil tizimga kirsa ham, har biri faqat o‘ziga kerakli qismini ko‘rishi kerak." }
      ]
    },
    solution: {
      title: "Bitta tizim — har bir tadbirkorga o‘ziga mos interfeys",
      subtitle: "Axis ERP ro‘yxatdan o‘tish jarayonida biznesingiz haqida savollar beradi va sizga kerakli bo‘limlarni avtomatik shakllantiradi. Keraksiz funksiyalar ko‘rinmaydi, keraklilari esa ishlashga tayyor bo‘ladi.",
      cards: [
        { title: "Moslashuvchan bo‘limlar", desc: "Ombor, mahsulot, buyurtma, invoice, qarz daftari va hisobotlar biznesingizga qarab yoqiladi yoki yashiriladi." },
        { title: "Role-based interface", desc: "Boshliq hamma narsani ko‘radi, omborchi faqat omborni, buxgalter esa qarz va hisobotlarni nazorat qiladi." },
        { title: "B2B oldi-berdi", desc: "Hamkor kompaniyalar tizim orqali buyurtma yuboradi, qabul qiladi va har ikki tomonda mos yozuvlar shakllanadi." },
        { title: "Qarz daftari", desc: "Real to‘lov tizimisiz, kim kimga qancha qarzdorligini aniq ko‘rsatadigan virtual balans yuritiladi." }
      ]
    },
    howItWorks: {
      title: "Ishlash jarayoni oddiy: tizim sizga moslashadi",
      subtitle: "Axis ERP’da hamma bir xil murakkab interfeysdan foydalanmaydi. Tizim avval biznesingizni tushunadi, keyin kerakli modullarni ochadi.",
      steps: [
        { title: "Ro‘yxatdan o‘ting", desc: "Ism, telefon va kompaniya ma‘lumotlarini kiriting." },
        { title: "Biznesingiz haqida javob bering", desc: "Siz ulgurji savdo qilasizmi, ombor yuritasizmi, hamkorlar bilan nasiya ishlaysizmi — tizim shularni aniqlaydi." },
        { title: "Kerakli bo‘limlar shakllanadi", desc: "Mahsulot, ombor, B2B buyurtmalar, qarz daftari va hisobotlar sizga mos tarzda yoqiladi." },
        { title: "Xodimlarga rol bering", desc: "Bosh menejer, buxgalter, omborchi yoki sotuvchiga kerakli ruxsatlarni belgilang." },
        { title: "Hamkorlar bilan ishlang", desc: "Buyurtma yuboring, invoice yarating, tovar qabul qiling va qarzdorlikni avtomatik nazorat qiling." }
      ]
    },
    modules: {
      title: "Biznesingizga kerakli modullar",
      subtitle: "Har bir bo‘lim alohida kuchli modul sifatida ishlab chiqiladi, lekin foydalanuvchiga faqat kerakli qismlar ko‘rsatiladi.",
      items: [
        { title: "Mahsulot va variantlar", desc: "Rang, o'lcham, barcode va SKU bilan mahsulotlarni boshqaring." },
        { title: "Ombor nazorati", desc: "Kirim, chiqim, qoldiq va stock movement real vaqtda." },
        { title: "B2B buyurtmalar", desc: "Hamkorlar bilan buyurtma yuborish va qabul qilish." },
        { title: "Invoice va hujjatlar", desc: "Hujjatlarni tartibli saqlash va statuslarni kuzatish." },
        { title: "Qarz daftari", desc: "Debitorlik va kreditorlikni bir joyda ko'ring." },
        { title: "Rollar va ruxsatlar", desc: "Har bir xodimga faqat kerakli bo'limlarni ko'rsating." }
      ]
    },
    b2b_diff: {
      title: "Oddiy ERP emas — hamkorlar orasida ishlaydigan tizim",
      subtitle: "Axis ERP faqat bitta korxona ichidagi hisobni yuritmaydi. U ikki kompaniya o‘rtasidagi buyurtma, jo‘natma, qabul qilish va qarzdorlikni ham bog‘laydi.",
      steps: [
        "Xaridor hamkoriga buyurtma yuboradi",
        "Sotuvchi buyurtmani qabul qiladi",
        "Mahsulotlar mapping orqali moslashtiriladi",
        "Sotuvchi omboridan mahsulot chiqadi",
        "Xaridor omboriga mahsulot kiradi",
        "Qarz avtomatik shakllanadi",
        "To‘lov tasdiqlanganda qarz yopiladi"
      ],
      highlight: "Har ikki tomonda bir xil tranzaksiya tarixi. Kamroq sverka, kamroq xato, ko‘proq ishonch."
    },
    mapping: {
      title: "Mahsulot nomlari har xil bo‘lsa ham, ombor chalkashmaydi",
      subtitle: "Har kompaniya o‘z mahsulot katalogini yuritadi. Hamkor yuborgan mahsulot sizdagi mos mahsulotga bog‘lanadi yoki yangi mahsulot sifatida yaratiladi.",
      example: {
        partner: "Hamkorda: 'Shakar 50kg'",
        you: "Sizda: 'Shakar qop 50kg'",
        result: "Axis ERP: ikkalasini bog‘laydi va keyingi safar avtomatik taniydi."
      },
      note: "Omborda boshqa kompaniyaning mahsuloti alohida ustun bo‘lib chiqmaydi. Har bir kompaniya faqat o‘z mahsulotlari bilan ishlaydi."
    },
    roles: {
      title: "Har bir xodim faqat o‘ziga kerakli bo‘limni ko‘radi",
      subtitle: "Tizim ichida hamma bir xil imkoniyatga ega bo‘lmaydi. Har bir rol o‘z vazifasiga mos interfeys va ruxsatlar bilan ishlaydi.",
      items: [
        { title: "Boshliq", role: "Owner", desc: "Barcha bo‘limlarni ko‘radi, xodimlarni boshqaradi, rollar beradi." },
        { title: "Bosh menejer", role: "Manager", desc: "Mahsulotlar, hamkorlar, buyurtmalar va operatsiyalarni boshqaradi." },
        { title: "Buxgalter", role: "Accountant", desc: "Invoice, qarz daftari va hisobotlarni nazorat qiladi." },
        { title: "Omborchi", role: "Warehouse", desc: "Kirim, chiqim va tovar qabul qilish bilan ishlaydi." },
        { title: "Sotuvchi", role: "Sales", desc: "Buyurtma va invoice bilan ishlaydi." }
      ]
    },
    debt: {
      title: "Real to‘lov emas, aniq qarzdorlik nazorati",
      subtitle: "Axis ERP pulni tizim ichida aylantirmaydi. U faqat kompaniyalar o‘rtasidagi qarzdorlikni aniq hisoblaydi va tasdiqlash orqali yopadi.",
      flow: ["Tovar qabul qilindi", "Qarz yaratildi", "Xaridor to'lovni belgilaydi", "Sotuvchi tasdiqlaydi", "Qarz yopiladi"],
      benefit: "Kimdan qancha debitorlik bor, kimga qancha kreditorlik bor — barchasiga bir necha soniyada javob oling."
    },
    dashboard_preview: {
      title: "Barcha muhim ko‘rsatkichlar bir ekranda",
      subtitle: "Dashboard orqali ombor, buyurtma, qarz, invoice va hamkorlar bo‘yicha eng muhim holatlarni tez ko‘ring.",
      kpis: ["Jami debitorlik", "Jami kreditorlik", "Qabul kutilayotgan tovarlar", "Bugungi jo‘natmalar", "Mapping kutilmoqda", "Tasdiq kutilmoqda"]
    },
    pricing_page: {
      title: "Moslashuvchan tariflar",
      subtitle: "Biznesingiz hajmi va kerakli modullarga qarab mos tarifni tanlang.",
      plans: [
        {
          name: "7 kun bepul sinov",
          price: "0",
          desc: "Tizimni biznesingizda sinab ko‘ring. Karta talab qilinmaydi.",
          features: ["Ro‘yxatdan o‘tish", "Kompaniya sozlash", "Onboarding savollari", "Mahsulotlar", "Ombor", "B2B buyurtmalar", "Qarz daftari"],
          cta: "Bepul boshlash"
        },
        {
          name: "Professional",
          price: "20",
          desc: "Kichik va o‘rta biznes uchun asosiy tarif.",
          features: ["Hamma bepul imkoniyatlar", "Mahsulot variantlari", "Hamkorlar", "Invoice", "Xodimlar va rollar", "Hisobotlar"],
          cta: "Professional tarif"
        },
        {
          name: "Enterprise",
          price: "Kelishilgan",
          desc: "Katta korxonalar va maxsus jarayonlar uchun.",
          features: ["Maxsus konfiguratsiya", "Ko'p filial / ombor", "Maxsus integratsiyalar", "Shaxsiy support"],
          cta: "Bog‘lanish"
        }
      ]
    },
    faq_section: {
      title: "Ko‘p so‘raladigan savollar",
      items: [
        { q: "Axis ERP kimlar uchun?", a: "Kichik va o‘rta tadbirkorlar, ulgurji savdo va distribyutorlar uchun." },
        { q: "Tizim har bir biznesga moslashadimi?", a: "Ha, onboarding savollariga qarab kerakli bo'limlar avtomatik yoqiladi." },
        { q: "Hamkorim tizimdan foydalanmasa nima bo'ladi?", a: "Siz buyurtmalarni o'zingiz yuritishingiz mumkin, hamkoringiz qo'shilgach sinxronizatsiya boshlanadi." },
        { q: "Mahsulot nomlari har xil bo'lsa nima bo'ladi?", a: "Product Mapping tizimi ularni avtomatik bog'laydi." }
      ]
    },
    final_cta: {
      title: "Biznesingizni tartibli boshqarishni bugun boshlang",
      subtitle: "Axis ERP bilan ombor, buyurtma, hamkorlar va qarzlarni bitta tizimda nazorat qiling. 7 kun bepul sinab ko‘ring.",
      cta1: "7 kun bepul boshlash",
      cta2: "Demoni ko‘rish",
      note: "Karta talab qilinmaydi. Kerakli bo‘limlar onboarding orqali avtomatik sozlanadi."
    },
    footer: {
      desc: "Tadbirkorlar uchun moslashuvchan B2B ERP tizimi. Mahsulot, ombor, buyurtma, invoice va qarz daftarini yagona platformada boshqaring.",
      links: {
        menu: ["Imkoniyatlar", "Qanday ishlaydi", "Tariflar", "FAQ", "Kirish"],
        product: ["Mahsulotlar", "Ombor", "B2B buyurtmalar", "Qarz daftari", "Rollar"],
        contact: ["Telegram", "Email", "Telefon"]
      },
      rights: "© 2026 Axis ERP. Barcha huquqlar himoyalangan."
    },
    auth: {
      register_title: "Ro‘yxatdan o‘tish",
      register_subtitle: "7 kunlik bepul sinovni boshlash uchun ma’lumotlaringizni kiriting.",
      side_title: "Biznesingizni yangi bosqichga olib chiqing",
      side_subtitle: "Axis ERP orqali ombor, buyurtma, hamkorlar va qarzlarni bir joyda nazorat qiling.",
      fields: {
        fullName: "Ism familiya",
        phone: "Telefon raqam",
        email: "Email",
        password: "Parol",
        companyName: "Kompaniya nomi",
        tin: "STIR / INN",
        address: "Manzil",
        businessType: "Faoliyat turi"
      },
      button: "Keyingisi",
      footer_text: "Ro‘yxatdan o‘tish orqali siz foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz."
    },
    onboarding_wizard: {
      title: "Tizimni biznesingizga moslaymiz",
      subtitle: "Bir nechta savolga javob bering. Axis ERP sizga kerakli bo‘limlarni avtomatik tayyorlaydi.",
      q1: { q: "Biznesingiz qaysi turga yaqin?", options: ["Ulgurji savdo", "Chakana savdo", "Ombor / distribyutor", "Ishlab chiqarish", "Xizmat ko‘rsatish", "Aralash biznes"] },
      q2: { q: "Siz ombor yuritasizmi?", options: ["Ha, omborim bor", "Ha, bir nechta omborim bor", "Yo‘q, hozircha kerak emas"] },
      q3: { q: "Hamkorlar bilan buyurtma yoki invoice almashasizmi?", options: ["Ha, doimiy ishlaymiz", "Ba’zida kerak bo‘ladi", "Yo‘q, hozircha kerak emas"] },
      q4: { q: "Sizda nasiya yoki qarzga savdo bormi?", options: ["Ha, qarz daftari kerak", "Ba’zida bo‘ladi", "Yo‘q, kerak emas"] },
      q5: { q: "Mahsulotlaringizda variantlar bormi?", options: ["Ha, variantlar bor", "Yo‘q, oddiy mahsulotlar", "Keyinroq sozlayman"] },
      q6: { q: "Tizimda siz bilan ishlaydigan xodimlar bormi?", options: ["Ha, hozir qo‘shaman", "Ha, keyin qo‘shaman", "Yo‘q, hozircha o‘zim ishlayman"] },
      result: {
        title: "Tizimingiz tayyor!",
        desc: "Siz uchun quyidagi bo‘limlar yoqildi:",
        items: ["Mahsulotlar", "Ombor", "B2B buyurtmalar", "Invoice", "Qarz daftari", "Hamkorlar", "Hisobotlar"],
        footer: "7 kunlik bepul sinov boshlandi.",
        button: "Dashboardga o‘tish"
      }
    }
  },
  ru: {
    // RU translations would go here, following the same structure
    nav: { features: "Возможности", howItWorks: "Как это работает", pricing: "Тарифы", faq: "FAQ", login: "Вход", getStarted: "Начать 7 дней бесплатно" },
    // ... other RU strings
  },
  en: {
    // EN translations would go here
    nav: { features: "Features", howItWorks: "How it works", pricing: "Pricing", faq: "FAQ", login: "Login", getStarted: "Start 7-day free trial" },
    // ... other EN strings
  }
};
