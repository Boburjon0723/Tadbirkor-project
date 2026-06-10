const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, PageBreak
} = require('docx');
const fs = require('fs');

const BLUE = "1E40AF";
const LIGHT_BLUE = "DBEAFE";
const GREEN = "166534";
const LIGHT_GREEN = "DCFCE7";
const ORANGE = "9A3412";
const LIGHT_ORANGE = "FEF3C7";
const RED = "991B1B";
const LIGHT_RED = "FEE2E2";
const GRAY = "374151";
const LIGHT_GRAY = "F3F4F6";
const WHITE = "FFFFFF";

const border = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: "Arial" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 26, color: GRAY, font: "Arial" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: GRAY, font: "Arial" })]
  });
}

function p(text, options = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 20, font: "Arial", ...options })]
  });
}

function bullet(text, bold = false) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: "Arial", bold })]
  });
}

function note(text, color = LIGHT_ORANGE, textColor = ORANGE) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill: color, type: ShadingType.CLEAR },
    indent: { left: 360, right: 360 },
    children: [new TextRun({ text: "  " + text, size: 20, font: "Arial", color: textColor })]
  });
}

function space(lines = 1) {
  return new Paragraph({ children: [new TextRun({ text: " ".repeat(lines) })] });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => new TableCell({
          borders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: BLUE, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: WHITE, font: "Arial" })] })]
        }))
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => {
          const fill = ri % 2 === 0 ? WHITE : LIGHT_GRAY;
          return new TableCell({
            borders,
            width: { size: colWidths[ci], type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 18, font: "Arial" })] })]
          });
        })
      }))
    ]
  });
}

function statusBadge(text, fill, textColor) {
  return new TableCell({
    borders: noBorders,
    width: { size: 1440, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 16, font: "Arial", color: textColor })] })]
  });
}

// ─── DOCUMENT ───────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbered",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: GRAY },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: GRAY },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // ── COVER ──────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1440, after: 200 },
        children: [new TextRun({ text: "AXIS ERP", bold: true, size: 64, font: "Arial", color: BLUE })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: "NestJS → Go Migration", bold: true, size: 40, font: "Arial", color: GRAY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: "To'liq arxitektura va rejalashtirish hujjati", size: 24, font: "Arial", color: "6B7280" })]
      }),

      makeTable(["Parametr", "Qiymat"], [
        ["Loyiha", "Axis ERP (Tadbirkor)"],
        ["Stack (hozir)", "NestJS + Prisma + PostgreSQL + Redis + BullMQ"],
        ["Maqsad stack", "Go + sqlc/pgx + PostgreSQL + Redis + asynq"],
        ["Jami modullar", "34 modul, 228 TypeScript fayl"],
        ["DB modellari", "60+ Prisma model (1552 qator schema)"],
        ["Migration davri", "~4 oy (modul-modul)"],
        ["Strategiya", "Strangler Fig — NestJS parallel ishlaydi"],
        ["Deploy", "Railway (Go binary — 3x kam RAM)"],
      ], [3200, 5826]),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. NIMA UCHUN GO ────────────────────────────────────────────────
      h1("1. Nima uchun Go?"),
      p("Loyihangizda aniq 3 ta muammo bor: ko'p bir vaqtdagi so'rovlar, ma'lumotlar almashinuvi tezligi va tizim hajmi. Go uchun bu 3 ta eng kuchli tomondir."),
      space(),

      makeTable(
        ["Ko'rsatkich", "NestJS (hozir)", "Go (keyin)", "Farq"],
        [
          ["RAM (idle)", "~180–300 MB", "~20–50 MB", "6x kam"],
          ["Concurrent requests", "Event loop (1 thread)", "Goroutines (million+)", "~100x ko'p"],
          ["Response time p99", "50–200 ms", "5–30 ms", "~5x tez"],
          ["Railway RAM narxi", "$~8–15/oy", "$~2–4/oy", "3–5x tejam"],
          ["Cold start", "3–8 sek", "0.1–0.5 sek", "15x tez"],
          ["CPU load (peak)", "Yuqori", "Past", "Goroutine scheduler"],
          ["Binary hajmi", "node_modules ~700MB", "~15–20 MB", "35x kichik"],
        ],
        [2500, 2000, 2000, 1526]
      ),
      space(),
      note("⚡ Sizning loyihangizda node_modules papkasi 700MB — Go binary butun server ~15MB bo'ladi. Railway deploy vaqti ham 10x tezlashadi.", LIGHT_BLUE, BLUE),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 2. GO STACK ──────────────────────────────────────────────────────
      h1("2. Tavsiya etilgan Go Stack"),
      p("NestJS-dagi har bir kutubxonaning Go ekvivalentlari — hammasini o'z ko'zim bilan loyihangiz kodida ko'rdim:"),
      space(),

      makeTable(
        ["NestJS (hozir)", "Maqsad", "Go ekvivalenti", "Sabab"],
        [
          ["NestJS framework", "HTTP server", "Gin yoki Chi", "Tez, lightweight, middleware zanjiri"],
          ["Prisma ORM", "DB so'rovlar", "sqlc + pgx/v5", "Type-safe SQL, Prisma schemadan gen"],
          ["BullMQ + Redis", "Background jobs", "asynq + Redis", "Go-native, bir xil Redis"],
          ["Socket.io", "WebSocket (inventory)", "gorilla/websocket", "Go standard, tez"],
          ["Telegraf", "Telegram bot", "telebot v3", "Eng mashhur Go Telegram lib"],
          ["Puppeteer (PDF)", "PDF generation", "chromedp yoki gotenberg", "Gotenberg = Docker PDF server"],
          ["bcryptjs", "Parol hash", "golang.org/x/crypto/bcrypt", "Standart, bir xil"],
          ["JWT (@nestjs/jwt)", "Auth token", "golang-jwt/jwt/v5", "Bir xil payload format"],
          ["class-validator", "DTO validation", "go-playground/validator/v10", "Tag-based, kuchli"],
          ["ioredis", "Redis client", "go-redis/v9", "Eng ko'p ishlatiladigan"],
          ["ExcelJS", "Excel export", "excelize", "Kuchli Go Excel lib"],
          ["Helmet / CORS", "Security headers", "Gin middleware", "Built-in yoki cors paketi"],
          ["ConfigModule (.env)", "Environment vars", "godotenv / os.Getenv", "Oddiy va tez"],
          ["ThrottlerGuard", "Rate limiting", "ulule/limiter", "Redis-based rate limit"],
          ["Supabase Storage", "Fayl saqlash", "supabase-community/storage-go", "Rasmiy Go SDK"],
        ],
        [2200, 1600, 2000, 3226]
      ),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 3. LOYIHA STRUKTURASI ───────────────────────────────────────────
      h1("3. Go Loyiha Strukturasi"),
      p("Clean Architecture + Domain-Driven Design (DDD) — NestJS-dagi modul tuzilmani saqlaymiz, lekin Go idiomasida:"),
      space(),

      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({
          text: [
            "axis-erp-go/",
            "├── cmd/",
            "│   └── api/",
            "│       └── main.go              ← Entry point",
            "├── internal/",
            "│   ├── auth/",
            "│   │   ├── handler.go           ← HTTP handler (NestJS Controller)",
            "│   │   ├── service.go           ← Business logic (NestJS Service)",
            "│   │   ├── repository.go        ← DB queries (Prisma)",
            "│   │   └── dto.go               ← Request/Response structs",
            "│   ├── products/",
            "│   ├── warehouses/",
            "│   ├── pos/",
            "│   ├── b2b_orders/",
            "│   ├── payroll/",
            "│   └── ... (har bir modul)",
            "├── pkg/",
            "│   ├── middleware/              ← JWT guard, RBAC, throttle",
            "│   ├── cache/                   ← Redis cache (AppCacheService)",
            "│   ├── db/                      ← PostgreSQL connection pool",
            "│   ├── queue/                   ← asynq workers (BullMQ)",
            "│   └── ws/                      ← WebSocket hub (Socket.io)",
            "├── sqlc/",
            "│   ├── schema.sql               ← Prisma schemadan convert",
            "│   └── queries/                 ← SQL fayllar → Go kod gen",
            "├── docker-compose.yml",
            "└── Dockerfile                   ← Multi-stage, ~20MB image",
          ].join("\n"),
          font: "Courier New", size: 16, color: "1F2937"
        })]
      }),

      space(),
      note("💡 Har bir NestJS moduli → Go'da alohida papka: handler.go + service.go + repository.go. Bu tuzilma jamoa uchun tanish bo'ladi.", LIGHT_GREEN, GREEN),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 4. MIGRATION STRATEGIYASI ───────────────────────────────────────
      h1("4. Migration Strategiyasi: Strangler Fig"),
      p("Big bang rewrite qilmaymiz. NestJS va Go parallel ishlaydi — har bir modul tayyor bo'lgach, traffic ko'chiriladi. Production hech to'xtamaydi."),
      space(),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [4513, 4513],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 4513, type: WidthType.DXA },
                shading: { fill: LIGHT_ORANGE, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "❌ Big Bang Rewrite", bold: true, size: 22, font: "Arial", color: ORANGE })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Hamma narsa bir vaqtda to'xtab yoziladi", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• 6-9 oy davomida production xavfda", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Mijozlar ko'radi, ishonch yo'qoladi", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Xatolar ko'p, test qiyin", size: 18, font: "Arial" })] }),
                ]
              }),
              new TableCell({
                borders,
                width: { size: 4513, type: WidthType.DXA },
                shading: { fill: LIGHT_GREEN, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "✅ Strangler Fig (bizning yo'l)", bold: true, size: 22, font: "Arial", color: GREEN })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Har modul alohida ko'chiriladi", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• NestJS parallel ishlaydi (fallback)", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Go tayyor modullar darhol foyda beradi", size: 18, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Xatolarni izolyatsiya qilish oson", size: 18, font: "Arial" })] }),
                ]
              })
            ]
          })
        ]
      }),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 5. 4 OYLIK REJA ────────────────────────────────────────────────
      h1("5. 4 Oylik Migration Rejasi"),
      p("Loyihangizni tahlil qilib, modullarni og'irlikka qarab tartibladim. Har fazada ishlaydigan Go serveri production'ga chiqadi."),
      space(),

      // FAZA 1
      h2("Faza 1 — Poydevor (1-oy)"),
      note("🎯 Maqsad: Go infratuzilmasi + Auth moduli. Oxirida /api/auth/* endpointlari Go'da ishlaydi.", LIGHT_BLUE, BLUE),
      space(),
      makeTable(
        ["Hafta", "Vazifa", "NestJS analogi", "Taxminiy vaqt"],
        [
          ["1-hafta", "Go loyiha strukturasi, Makefile, CI/CD Railway", "nest-cli.json, nixpacks.toml", "3 kun"],
          ["1-hafta", "PostgreSQL connection pool (pgx/v5 + pgxpool)", "PrismaModule, prisma.service.ts", "2 kun"],
          ["2-hafta", "sqlc setup: schema.sql (Prisma → SQL convert)", "prisma/schema.prisma", "3 kun"],
          ["2-hafta", "Redis cache paketi (AppCacheService analog)", "app-cache.service.ts", "2 kun"],
          ["3-hafta", "JWT middleware + RBAC (7 ta rol)", "jwt-auth.guard.ts, role-permissions.ts", "4 kun"],
          ["3-hafta", "Subscription guard analog", "subscription.guard.ts", "1 kun"],
          ["4-hafta", "Auth modul: /register, /login, /me", "auth.service.ts, auth.controller.ts", "5 kun"],
          ["4-hafta", "Nginx reverse proxy (NestJS + Go parallel)", "—", "2 kun"],
        ],
        [900, 2800, 2500, 1826]
      ),
      space(),

      // FAZA 2
      h2("Faza 2 — Asosiy modullar (2-oy)"),
      note("🎯 Maqsad: Products, Warehouses, Stock — eng ko'p so'rov tushadigan va real-time kerak bo'lgan qismlar.", LIGHT_BLUE, BLUE),
      space(),
      makeTable(
        ["Hafta", "Modul", "Murakkablik", "Muhim qismlar"],
        [
          ["5-hafta", "Products + ProductCategories + ProductVariants", "⭐⭐⭐⭐", "13 fayl, catalog cache, barcode, image upload"],
          ["6-hafta", "Warehouses + StockBalance + WarehouseScope", "⭐⭐⭐⭐", "11 fayl, scope service, field config"],
          ["7-hafta", "WebSocket Hub (gorilla/websocket)", "⭐⭐⭐", "inventory:changed event, company rooms"],
          ["7-hafta", "Stock service (ATP, reservation, movement)", "⭐⭐⭐⭐⭐", "StockReservation, PickTask, StockBlock"],
          ["8-hafta", "GoodsReceipts + WarehouseIntake", "⭐⭐⭐", "6 fayl, kirim jarayoni, scanning mode"],
        ],
        [900, 2200, 1400, 4526]
      ),
      space(),

      // FAZA 3
      h2("Faza 3 — Biznes modullar (3-oy)"),
      note("🎯 Maqsad: B2B, POS, Debts, Partners — pul va savdo oqimlari.", LIGHT_ORANGE, ORANGE),
      space(),
      makeTable(
        ["Hafta", "Modul", "Murakkablik", "Muhim qismlar"],
        [
          ["9-hafta", "B2B Orders + Dispatches", "⭐⭐⭐⭐", "7 fayl, order lifecycle, dispatch tracking"],
          ["10-hafta", "POS (Point of Sale)", "⭐⭐⭐⭐⭐", "Kassa, nasiya, chegirma, receipt, WebSocket"],
          ["11-hafta", "Debts + Partner Ledger", "⭐⭐⭐⭐", "DebtEntry, payment records, ledger ops"],
          ["11-hafta", "Partners + ProductMappings", "⭐⭐⭐", "Hamkor tizimi, mapping"],
          ["12-hafta", "RetailCustomers + RetailReceivables", "⭐⭐⭐", "Mijoz nasiya, to'lov tarixi"],
        ],
        [900, 2200, 1400, 4526]
      ),
      space(),

      // FAZA 4
      h2("Faza 4 — Qo'shimcha modullar (4-oy)"),
      note("🎯 Maqsad: Payroll, Reports, Telegram, asynq jobs — NestJS ni to'liq o'chirish.", LIGHT_GREEN, GREEN),
      space(),
      makeTable(
        ["Hafta", "Modul", "Murakkablik", "Muhim qismlar"],
        [
          ["13-hafta", "Payroll + HR modullar", "⭐⭐⭐⭐", "6 fayl, ish haqi, avans, ta'til"],
          ["13-hafta", "Expenses + Income + Dashboard", "⭐⭐⭐", "Moliyaviy ko'rinish, summarizatsiya"],
          ["14-hafta", "asynq workers (BullMQ o'rniga)", "⭐⭐⭐", "Background jobs: notifications, reports"],
          ["14-hafta", "Telegram bot (telebot v3)", "⭐⭐⭐", "12 fayl, bot intents, password reset"],
          ["15-hafta", "Reports + PDF (gotenberg)", "⭐⭐⭐⭐", "Excel, PDF gen, aggregation queries"],
          ["15-hafta", "Notifications + AuditLogs", "⭐⭐", "Push notifications, log yozish"],
          ["16-hafta", "Platform + System + Onboarding", "⭐⭐", "Admin panel, modul management"],
          ["16-hafta", "NestJS o'chirish, Go — yagona server", "—", "Final cutover, monitoring setup"],
        ],
        [900, 2200, 1400, 4526]
      ),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 6. AUTH MODUL NAMUNA KOD ────────────────────────────────────────
      h1("6. Auth Modul — Go Namuna Kodi"),
      p("Sizning auth.service.ts faylini o'qib, to'g'ridan-to'g'ri ekvivalentini yozdim. Bir xil logika, Go idiomasi bilan:"),
      space(),

      h3("internal/auth/handler.go"),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        children: [new TextRun({
          text: [
            "package auth",
            "",
            'import ("net/http"; "github.com/gin-gonic/gin")',
            "",
            "type Handler struct { svc *Service }",
            "",
            "func (h *Handler) Register(c *gin.Context) {",
            "    var dto RegisterDTO",
            '    if err := c.ShouldBindJSON(&dto); err != nil {',
            '        c.JSON(400, gin.H{"error": err.Error()}); return',
            "    }",
            "    result, err := h.svc.Register(c.Request.Context(), dto)",
            "    if err != nil {",
            '        c.JSON(httpStatus(err), gin.H{"error": err.Error()}); return',
            "    }",
            "    c.JSON(201, result)",
            "}",
            "",
            "func (h *Handler) Login(c *gin.Context) {",
            "    var dto LoginDTO",
            '    if err := c.ShouldBindJSON(&dto); err != nil {',
            '        c.JSON(400, gin.H{"error": err.Error()}); return',
            "    }",
            "    result, err := h.svc.Login(c.Request.Context(), dto)",
            "    if err != nil {",
            '        c.JSON(401, gin.H{"error": err.Error()}); return',
            "    }",
            "    c.JSON(200, result)",
            "}",
            "",
            "func (h *Handler) Me(c *gin.Context) {",
            '    userID := c.GetString("userID")',
            '    companyID := c.GetString("companyID")',
            "    me, err := h.svc.GetMe(c.Request.Context(), userID, companyID)",
            "    if err != nil {",
            '        c.JSON(401, gin.H{"error": err.Error()}); return',
            "    }",
            "    c.JSON(200, me)",
            "}",
          ].join("\n"),
          font: "Courier New", size: 16, color: "D4D4D4"
        })]
      }),

      space(),
      h3("internal/auth/service.go (asosiy logika)"),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        children: [new TextRun({
          text: [
            "package auth",
            "",
            "func (s *Service) Login(ctx context.Context, dto LoginDTO) (*LoginResult, error) {",
            "    user, err := s.repo.FindByLogin(ctx, dto.Login)",
            "    if err != nil || user == nil {",
            '        return nil, ErrInvalidCredentials  // "Login yoki parol noto\'g\'ri"',
            "    }",
            "    if err := bcrypt.CompareHashAndPassword(",
            "        []byte(user.PasswordHash), []byte(dto.Password)); err != nil {",
            "        return nil, ErrInvalidCredentials",
            "    }",
            "    membership := user.Companies[0]  // Birinchi kompaniya",
            "    token, err := s.generateJWT(user.ID, membership.CompanyID, membership.Role)",
            "    if err != nil { return nil, err }",
            "    return &LoginResult{",
            "        AccessToken: token,",
            "        User: UserInfo{ID: user.ID, FullName: user.FullName,",
            "                      Login: user.Login, Role: membership.Role},",
            "    }, nil",
            "}",
            "",
            "// GetMe — Redis cache bilan (AppCacheService analog)",
            "func (s *Service) GetMe(ctx context.Context, userID, companyID string) (*MeResult, error) {",
            '    key := fmt.Sprintf("auth:me:%s:%s", userID, companyID)',
            "    if cached, _ := s.cache.Get(ctx, key); cached != nil {",
            "        return cached.(*MeResult), nil",
            "    }",
            "    result, err := s.loadMe(ctx, userID, companyID)",
            "    if err != nil { return nil, err }",
            "    s.cache.Set(ctx, key, result, 60*time.Second)  // AUTH_ME_CACHE_TTL_MS analog",
            "    return result, nil",
            "}",
          ].join("\n"),
          font: "Courier New", size: 16, color: "D4D4D4"
        })]
      }),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 7. SQLC SETUP ───────────────────────────────────────────────────
      h1("7. sqlc — Prisma o'rniga"),
      p("sqlc Prisma'ga eng yaqin Go alternativi: siz SQL yozasiz → sqlc type-safe Go kodi generatsiya qiladi. Prisma schemangizdan to'g'ridan-to'g'ri convert qilish mumkin."),
      space(),

      h3("sqlc.yaml"),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        children: [new TextRun({
          text: [
            "version: '2'",
            "sql:",
            "  - engine: postgresql",
            "    queries: ./sqlc/queries/     # SQL fayllar",
            "    schema: ./sqlc/schema.sql    # Prisma schema → SQL",
            "    gen:",
            "      go:",
            "        package: db",
            "        out: ./internal/db",
            "        emit_json_tags: true",
            "        emit_pointers_for_null_types: true",
            "        emit_interface: true",
          ].join("\n"),
          font: "Courier New", size: 16, color: "D4D4D4"
        })]
      }),

      space(),
      h3("sqlc/queries/auth.sql — namuna"),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        children: [new TextRun({
          text: [
            "-- name: FindUserByLogin :one",
            "SELECT u.*, json_agg(cu.*) as companies",
            "FROM users u",
            "LEFT JOIN company_users cu ON cu.user_id = u.id",
            "WHERE u.login = $1",
            "GROUP BY u.id;",
            "",
            "-- name: CreateUser :one",
            "INSERT INTO users (id, full_name, login, password_hash, email, phone)",
            "VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)",
            "RETURNING *;",
            "",
            "-- name: GetMe :one",
            "SELECT u.id, u.full_name, u.login, u.email, u.phone,",
            "       c.id as company_id, c.name as company_name, c.status,",
            "       cu.role, cu.warehouse_id, cu.grant_permissions, cu.deny_permissions",
            "FROM users u",
            "JOIN company_users cu ON cu.user_id = u.id",
            "JOIN companies c ON c.id = cu.company_id",
            "WHERE u.id = $1 AND cu.company_id = $2;",
          ].join("\n"),
          font: "Courier New", size: 16, color: "D4D4D4"
        })]
      }),

      space(),
      note("💡 sqlc generate buyrug'i yuqoridagi SQL'dan to'liq type-safe Go strukturalar va funksiyalar yaratadi. Prisma Client kabi ishlaydi.", LIGHT_GREEN, GREEN),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 8. RAILWAY DEPLOY ───────────────────────────────────────────────
      h1("8. Railway Deploy — Dockerfile"),
      p("Go multi-stage build: final image ~20MB (Node.js 300MB+). Railway'da RAM va deploy tezligi keskin yaxshilanadi."),
      space(),

      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: "1E1E1E", type: ShadingType.CLEAR },
        children: [new TextRun({
          text: [
            "# Stage 1: Build",
            "FROM golang:1.22-alpine AS builder",
            "WORKDIR /app",
            "COPY go.mod go.sum ./",
            "RUN go mod download",
            "COPY . .",
            "RUN CGO_ENABLED=0 GOOS=linux go build -o axis-api ./cmd/api",
            "",
            "# Stage 2: Run (20MB image!)",
            "FROM alpine:latest",
            "RUN apk --no-cache add ca-certificates",
            "WORKDIR /root/",
            "COPY --from=builder /app/axis-api .",
            'EXPOSE 4000',
            'CMD ["./axis-api"]',
            "",
            "# NestJS Dockerfile bilan solishtirish:",
            "# NestJS:  FROM node:20 (~300MB) + node_modules (~700MB) = ~1GB",
            "# Go:      FROM alpine (~7MB) + binary (~15MB) = ~22MB",
          ].join("\n"),
          font: "Courier New", size: 16, color: "D4D4D4"
        })]
      }),

      space(),
      h3("Muhit o'zgaruvchilari (Railway Variables) — bir xil qoladi"),
      makeTable(
        ["Variable", "Maqsad", "O'zgaradimi?"],
        [
          ["DATABASE_URL", "Supabase pooler URL", "Yo'q"],
          ["DIRECT_URL", "Supabase direct URL", "Yo'q"],
          ["REDIS_URL", "Railway Redis", "Yo'q"],
          ["JWT_SECRET", "Token imzolash", "Yo'q"],
          ["SUPABASE_URL", "Storage", "Yo'q"],
          ["ESKIZ_*", "SMS xizmati", "Yo'q"],
          ["TELEGRAM_BOT_TOKEN", "Telegram bot", "Yo'q"],
          ["PORT", "Server porti (4000)", "Yo'q"],
        ],
        [3000, 3000, 3026]
      ),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 9. XAVFLAR VA ECHIMLAR ─────────────────────────────────────────
      h1("9. Xavflar va Echimlar"),
      space(),
      makeTable(
        ["Xavf", "Daraja", "Echim"],
        [
          ["Prisma → sqlc migration", "⭐⭐⭐", "sqlc.yaml + schema.sql generatsiya qilinadi; bir marta"],
          ["WebSocket (Socket.io) protokoli", "⭐⭐⭐", "gorilla/websocket + bir xil event nomlar; frontend o'zgarmaydi"],
          ["Puppeteer PDF", "⭐⭐⭐⭐", "Gotenberg Docker sidecar — REST API orqali PDF; Railway'da alohida servis"],
          ["RBAC murakkabligi (7 rol, permission override)", "⭐⭐⭐", "role-permissions.ts dan Go'ga portlash; bir xil logika"],
          ["Go bilim darajasi", "⭐⭐⭐⭐", "Faza 1 boshlash uchun 2 hafta Go kursi yetarli; siz tez o'rganing"],
          ["Parallel NestJS+Go traffic routing", "⭐⭐", "Nginx location prefix: /api/auth/ → Go; qolgani → NestJS"],
          ["Test coverage", "⭐⭐⭐", "Go'da tabel-driven testlar; httptest paketi built-in"],
        ],
        [2800, 900, 5326]
      ),

      space(2),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 10. BIRINCHI QADAM ─────────────────────────────────────────────
      h1("10. Birinchi Qadam — Bugun Nima Qilish Kerak"),
      space(),
      note("Modul-modul migration uchun 1-haftadagi vazifalar:", LIGHT_BLUE, BLUE),
      space(),

      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Go o'rnatish: go.dev/dl (1.22+)", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Yangi repo yaratish: axis-erp-go (yoki monorepo ichida /go-api)", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "go mod init: go mod init github.com/username/axis-erp-go", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Asosiy kutubxonalar: go get github.com/gin-gonic/gin github.com/jackc/pgx/v5 github.com/redis/go-redis/v9 github.com/golang-jwt/jwt/v5", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Loyiha strukturasini yaratish (yuqoridagi papkalar)", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "PostgreSQL connection pool yozish (pkg/db/db.go)", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "sqlc o'rnatish va sqlc.yaml sozlash", size: 20, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbered", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Auth moduli boshlanadi: JWT middleware → handler → service → repository", size: 20, font: "Arial" })]
      }),

      space(2),
      note("✅ Ushbu hujjat Axis ERP loyihangizning haqiqiy kodi tahlilidan tuzilgan. Har bir modul murakkabligi, fayl soni va bog'liqliqlari hisobga olingan.", LIGHT_GREEN, GREEN),
      space(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 0 },
        children: [new TextRun({ text: "Axis ERP Go Migration Plan  •  2025", size: 18, font: "Arial", color: "9CA3AF" })]
      }),
    ]
  }]
});

const outputPath = require('path').join(__dirname, 'axis-erp-go-migration.docx');

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log(`Done! Fayl yozildi: ${outputPath}`);
  })
  .catch((err) => {
    console.error('Xato:', err);
    process.exit(1);
  });
