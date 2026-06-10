package companies

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type catalogFeature struct {
	key         string
	name        string
	description string
}

type catalogModule struct {
	key         string
	name        string
	description string
	features    []catalogFeature
}

// systemModuleCatalog — Nest SYSTEM_MODULE_CATALOG bilan mos (Sozlamalar → Modullar).
var systemModuleCatalog = []catalogModule{
	{
		key: "WAREHOUSE", name: "Ombor", description: "Qoldiqlar va harakatlar",
		features: []catalogFeature{
			{"WAREHOUSE_BASIC", "Mahsulotlar va qoldiq", "Katalog ko‘rish, qoldiq, kirim/chiqim (asosiy ombor)."},
			{"STOCK_ADJUSTMENT", "Qoldiq tuzatish", "Qo‘lda tuzatish va ombor harakatlari."},
			{"WAREHOUSE_PICKING", "Saralash (picking)", "Jo‘natma bo‘yicha yig‘ish, skaner, PGI oldidan saralash."},
			{"WAREHOUSE_ATP", "Zaxira holati (ATP)", "Rezerv, erkin qoldiq, ATP ko‘rinishi."},
			{"WAREHOUSE_INVENTORY_COUNT", "Inventarizatsiya", "Sanash, farq, tasdiqlash va ombor bloklari."},
			{"WAREHOUSE_INTAKE", "Ombor kirimi", "Qo‘lda va skaner orqali mahsulot kirimi (hujjat asosida)."},
		},
	},
	{
		key: "POS", name: "POS / Kassa", description: "Chakana sotuv interfeysi",
		features: []catalogFeature{
			{"POS_TERMINAL", "POS interfeysi", "Sotuvchi uchun kassa ekrani"},
		},
	},
	{
		key: "B2B", name: "B2B Savdo", description: "Kompaniyalararo buyurtmalar",
		features: []catalogFeature{
			{"B2B_ORDERS", "B2B buyurtmalar", "Buyurtma yaratish va workflow"},
			{"B2B_MAIN", "B2B (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "GOODS_RECEIPTS", name: "Kelgan yuklar", description: "Hamkordan kelgan yuklarni qabul qilish",
		features: []catalogFeature{
			{"GOODS_RECEIPTS_MAIN", "Kelgan yuklar", "Qabul qilish, qisman qabul va PDF"},
			{"PARTIAL_RECEIPT", "Qisman qabul", "Eski feature kaliti (moslik)"},
		},
	},
	{
		key: "PARTNERS", name: "Hamkorlar", description: "Hamkor kompaniyalar",
		features: []catalogFeature{
			{"PARTNER_NETWORK", "Hamkorlar tarmog‘i", "Hamkor qo‘shish va tasdiqlash"},
			{"PARTNERS_MAIN", "Hamkorlar (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "PRODUCT_MAPPING", name: "Mahsulot mapping", description: "Hamkor SKU moslashuvi",
		features: []catalogFeature{
			{"PRODUCT_MAPPING", "Mahsulot mapping", "Ichki va hamkor mahsulot kodlari"},
			{"PRODUCT_MAPPING_MAIN", "Mapping (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "DEBT", name: "Qarz daftari", description: "B2B qarzlar",
		features: []catalogFeature{
			{"DEBT_TRACKING", "Qarz yozuvlari", "Qarz va qoldiq kuzatuvi"},
			{"PAYMENT_RECORDS", "To‘lovlar", "To‘lov yaratish va tasdiqlash"},
			{"DEBT_MAIN", "Qarz (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "PARTNER_LEDGER", name: "Hamkor daftari", description: "Tizimda bo‘lmagan hamkorlar",
		features: []catalogFeature{
			{"PARTNER_LEDGER_TRACKING", "Hamkor hisobi", "Kirim, sotuv, tushum va to‘lovlar"},
		},
	},
	{
		key: "EXPENSES", name: "Ichki xarajatlar", description: "Chiqim va byudjet",
		features: []catalogFeature{
			{"EXPENSE_TRACKING", "Xarajat yozuvlari", "Kategoriyalar va tasdiqlash"},
			{"EXPENSES_MAIN", "Xarajatlar (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "INCOME", name: "Kirimlar", description: "Tushum va daromad",
		features: []catalogFeature{
			{"INCOME_MAIN", "Kirimlar", "Qo‘lda kiritiladigan tushumlar"},
		},
	},
	{
		key: "PAYROLL", name: "Oylik", description: "Xodimlar maoshi",
		features: []catalogFeature{
			{"PAYROLL_MAIN", "Oylik hisoblash", "Davr bo‘yicha maosh va bonus"},
		},
	},
	{
		key: "FIELD_SERVICE", name: "Dala xodimlari", description: "Montaj va tashqaridagi ishlar",
		features: []catalogFeature{
			{"FIELD_TASKS", "Dala vazifalari", "Vazifa va hisobotlar"},
		},
	},
	{
		key: "REPORTS", name: "Hisobotlar", description: "Yig‘ma ko‘rinishlar",
		features: []catalogFeature{
			{"REPORTS_EXPORT", "Hisobot va eksport", "Excel/PDF va filtrlash"},
			{"REPORTS_MAIN", "Hisobotlar (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "STOREFRONT", name: "Onlayn do‘kon", description: "Veb vitrina",
		features: []catalogFeature{
			{"STOREFRONT_SYNC", "Vitrina sinxroni", "Mahsulot va buyurtmalar"},
			{"STOREFRONT_MAIN", "Do‘kon (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "EMPLOYEES", name: "Xodimlar", description: "Jamoa boshqaruvi",
		features: []catalogFeature{
			{"TEAM_MANAGEMENT", "Jamoa boshqaruvi", "Xodimlar va rollar"},
			{"EMPLOYEES_MAIN", "Xodimlar (asosiy)", "Eski seed mosligi"},
		},
	},
	{
		key: "INTEGRATIONS", name: "Ulanishlar", description: "Telegram va tashqi tizimlar",
		features: []catalogFeature{
			{"EXTERNAL_CONNECTIONS", "Tashqi integratsiyalar", "Webhook va bildirishnomalar"},
			{"INTEGRATIONS_MAIN", "Ulanishlar (asosiy)", "Eski seed mosligi"},
		},
	},
}

func syncSystemModuleCatalog(ctx context.Context, pool *pgxpool.Pool) error {
	for _, mod := range systemModuleCatalog {
		var moduleID string
		err := pool.QueryRow(ctx, `
			INSERT INTO "Module" (id, key, name, description, "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
			ON CONFLICT (key) DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				"updatedAt" = NOW()
			RETURNING id
		`, mod.key, mod.name, mod.description).Scan(&moduleID)
		if err != nil {
			return err
		}

		for _, feat := range mod.features {
			_, err := pool.Exec(ctx, `
				INSERT INTO "Feature" (id, "moduleId", key, name, description, "createdAt", "updatedAt")
				VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
				ON CONFLICT (key) DO UPDATE SET
					name = EXCLUDED.name,
					description = EXCLUDED.description,
					"moduleId" = EXCLUDED."moduleId",
					"updatedAt" = NOW()
			`, moduleID, feat.key, feat.name, feat.description)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
