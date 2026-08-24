# ☀️ Solar Quotation Portal — Project Plan (v3.0)

**Version:** 3.0 — rebuilt from the source documents
**Last Updated:** 2026-08-22
**Company:** Solar Green Technology, Ajmer, Rajasthan
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS 4.3 + Catalyst + Google Apps Script

> **What changed from v2:** v2 specified four capacity-based rate tiers and a 15-row
> priced BOM on the customer PDF. Both were wrong. `Book1 (1).xlsx` shows ₹/W is
> *derived* from per-project rupee costs (not looked up), and both sample quotations
> price with a **single line item**. v3 is rebuilt against the actual files.

---

## 1. Source of truth

Three files drive every rule in this plan:

| File | What it establishes |
|---|---|
| `Book1 (1).xlsx` | Internal costing sheet — 15 lines, derived ₹/W, `PAYABLE = Total × 1.089` |
| `Anil Bh Interior 10 kw.docx` | Customer quotation layout, 10.2kW residential w/ subsidy, mixed panels |
| `Vishkarma health care 325kw.docx` | Customer quotation layout, 325kW commercial, no subsidy |

The customer-facing PDF must follow the structure and placement of the two DOCX files exactly.

---

## 2. The two-stage model

This is the core architectural correction. Quoting is **two distinct activities**, and the
portal needs a screen for each.

```
┌─ STAGE 1: INTERNAL COSTING (private) ──────────────────┐
│  15 line items. Estimator enters actual ₹ cost.        │
│  Rate ₹/W is DERIVED:  rate = price / capacity_W       │
│  Total ₹/W = SUM of all 15 derived rates               │
│  Includes "Solar Green Share" — the margin line        │
└────────────────────────┬───────────────────────────────┘
                         │  passes ONLY the total ₹/W
                         ▼
┌─ STAGE 2: CUSTOMER QUOTATION (published) ──────────────┐
│  ONE priced row: capacity × ₹/W = Price (Excl. GST)    │
│  Price (Incl. GST) = Price (Excl. GST) × 1.089         │
│  Less subsidy (if applicable) → Final Payable          │
│  Plus unpriced BOM specification table                 │
└────────────────────────────────────────────────────────┘
```

**The 15 line items never appear on the customer document.** Publishing them would
expose the cost structure and the margin line.

---

## 3. Stage 1 — Internal costing sheet

### 3.1 The 15 line items

Reference values from the 125kW Waaree Mittal Hospital job (`Book1`, capacity 125,080 W):

| # | Description | Price (₹) | Derived ₹/W | GST % | Entry mode |
|---|---|---|---|---|---|
| 1 | Solar Panel | 20,38,804 | 16.300000 | 5 | rate-driven |
| 2 | Inverter (100 KW) | 2,60,000 | 2.078670 | 5 | cost-driven |
| 3 | Structure (approx 3300 kg) | 2,50,800 | 2.005117 | 18 | cost-driven |
| 4 | ACDB / DCDB | 86,540 | 0.691877 | 18 | cost-driven |
| 5 | AC wire | 35,000 | 0.279821 | 18 | cost-driven |
| 6 | DC Wire (1100 mtr) | 58,300 | 0.466102 | 18 | cost-driven |
| 7 | Earthing + LA + Earthing labor | 22,000 | 0.175887 | 18 | cost-driven |
| 8 | Earthing wire | 72,800 | 0.582028 | 18 | cost-driven |
| 9 | Transportation | 15,000 | 0.119923 | 18 | cost-driven |
| 10 | Welding & Labour | 2,50,160 | 2.000000 | 18 | rate-driven |
| 11 | CTPT Coil (4 Pcs) | 9,800 | 0.078350 | 18 | cost-driven |
| 12 | MIB Box | 3,500 | 0.027982 | 18 | cost-driven |
| 13 | Solar meter / Net Meter | 17,500 | 0.139910 | 18 | cost-driven |
| 14 | Miscellaneous (structure items, nut bolts, walkway, water pipeline, GI cable tray, civil material) | 1,01,000 | 0.807483 | 18 | cost-driven |
| 15 | **Solar Green Share** (margin) | 3,69,900 | 2.957307 | 18 | cost-driven |
| | **TOTAL** | **35,91,104** | **28.710457** | | |

### 3.2 Entry modes

Two lines behave differently in the spreadsheet and must behave differently in the UI:

- **rate-driven** (Panel, Welding & Labour): user enters **₹/W**, price is computed
  `price = capacity_W × rate`
- **cost-driven** (all other 13): user enters **₹ total**, rate is computed
  `rate = price / capacity_W`

Both directions must stay live — editing either field updates the other.

### 3.3 Outputs

```
totalRatePerWatt = Σ(all 15 derived rates)     // 28.710457 for the reference job
totalCostExclGst = Σ(all 15 prices)            // 35,91,104
```

`totalRatePerWatt` is the only value that crosses into Stage 2.

### 3.4 Per-line GST column

`Book1` carries a per-line GST column (5% on panel + inverter, 18% on the rest,
summing to ₹39,38,658). **It does not drive the payable** — G20 is `=E19*1.089`.
Keep the column as internal reference; never use it for customer-facing figures.

### 3.5 Rates are per-project, not tiered

The historical rates — ₹36.30/W (10kW), ₹28.71/W (125kW), ₹25.18/W (325kW) — are
*outputs* of three separate costing exercises, not entries in a lookup table. There is
no tier table. Each new quotation starts from a costing sheet.

**Convenience:** let the user start a new sheet from a saved template or by cloning a
previous project's sheet, then adjust. This gives the speed a tier table promised
without inventing prices.

---

## 4. Stage 2 — Customer quotation

### 4.1 Pricing math (verified against both DOCX)

```
priceExclGst = capacityWp × totalRatePerWatt
priceInclGst = priceExclGst × 1.089
finalPayable = priceInclGst − subsidyAmount
```

The 1.089 factor is the blended rate: `0.70 × 5% + 0.30 × 18% = 3.5% + 5.4% = 8.9%`.

**Verification:**

| Job | Capacity | Rate (actual) | Prints as | Excl. GST | × 1.089 | Document says |
|---|---|---|---|---|---|---|
| Anil 10.2kW | 10,280 Wp | ₹36.29533074 | ₹36.30 | ₹3,73,116.00 | ₹4,06,323.32 | ₹4,06,323.32 ✓ |
| Vishwakarma 325kW | 3,25,090 Wp | ₹25.18494725 | ₹25.18 | ₹81,87,374.50 | ₹89,16,050.83 | ₹89,16,050.60 ✓ |

> **Both** quotations print the rate rounded to 2dp while the underlying value carries
> full precision. The rounded figure does not reproduce the total — 10,280 × 36.30 is
> ₹3,73,164, which is ₹48 above what the document states. Store full precision; round
> only for display. Covered by a regression test in `costingEngine.test.ts`.

### 4.2 Subsidy

```
Amount:          editable, pre-filled ₹78,000
Final Payable:   priceInclGst − subsidyAmount
```

The amount is configurable per quote — set it to ₹0 on jobs that do not qualify.
Validation blocks a subsidy larger than the total price (which would print a negative
payable) and any negative amount.

**Form and document behave differently, deliberately:**

| Surface | At ₹78,000 | At ₹0 |
|---|---|---|
| Quotation form | Field and "Less subsidy" line shown | Field and line still shown (−₹0.00) |
| Printed PDF | Subsidy note + "after subsidy" line printed | **Both suppressed entirely** |

The form always shows the field so the amount stays visible and editable. The customer
document suppresses the section at zero, so a commercial client never receives a page
carrying a "−₹0.00" subsidy line. `printsSubsidy()` is the single gate for this.

> Commercial/industrial installations are not eligible for the residential ₹78,000, so
> **zero it on commercial jobs** — which then reproduces the Vishwakarma document,
> whose subsidy section is absent.

Day 7's Settings page will expose the default (`DEFAULT_SUBSIDY_AMOUNT`) so it can be
changed without a code edit.

> **Known discrepancy:** the Anil DOCX prints "Total Project cost after subsidy :-
> RS 2,41,670.51", which does not reconcile with ₹4,06,323.32 − ₹78,000 = ₹3,28,323.32.
> Treated as a stale figure in that document. The formula above is authoritative.

### 4.3 Panel configuration — multiple types per system

The 10kW job mixes panel types:

```
WAAREE DCR  590 Wp × 7  =  4,130 Wp
WAAREE NDCR 615 Wp × 10 =  6,150 Wp
                          ─────────
              17 panels    10,280 Wp   ✓ matches document
```

The 325kW job is single-type: `551 × 590 = 3,25,090 Wp` ✓

So capacity is **derived from panel selections**, not the other way round:

```
capacityWp = Σ(panelType.wattage × count)
```

The form takes one or more `{ panelType, count }` rows. A helper may suggest counts from
a target kW, but the counts are the source of truth.

**Catalogue:**

| Panel | Wattage | Warranty |
|---|---|---|
| RENEWSYS Bi-Facial Monocrystalline | 590 Wp | 12yr product + 25yr linear power |
| WAAREE DCR | 590 Wp | 12yr product + 25yr linear power |
| WAAREE NDCR | 615 Wp | 12yr product + 25yr linear power |

**Inverters:** Sungrow 250kW 3-phase (10/7yr), Sungrow 10kW 3-phase string (5/10yr),
Waaree String 10kW (5/10yr). Inverter is **selected manually**, not auto-derived — the
catalogue has gaps between 10kW and 250kW.

> **Inverter sizing is advisory, never a validation rule.** The two samples sit at
> very different ratios: Vishwakarma pairs 250kW with 3,25,090 Wp (**76.9%**), while
> Anil pairs 10kW with 10,280 Wp (**97.3%**). The v2 plan's hard 75–85% rule would
> have rejected the Anil quotation outright. The portal hints outside 70–110% and
> blocks nothing. Covered by tests in `quotationEngine.test.ts`.

### 4.4 Quotation number

Format `SGT/YYYY/MM/B<nn>` — e.g. `SGT/2026/04/B21`, `SGT/2026/02/B09`.
Sequence stored in Google Sheets, auto-incremented.

### 4.5 Validity

Default 10 days from issue date. The Anil quote states "valid till 10 days i.e. 24-04-2026"
against a 14-04-2026 date. Editable per quote.

---

## 5. PDF document structure

Follows the sample quotations exactly, in this order.

```
┌──────────────────────────────────────────────────────┐
│ [Logo]  SOLAR GREEN TECHNOLOGY                       │
│         technosolargreen@gmail.com | Ajmer, Rajasthan│
│         +91-7610000632 | GSTIN: 08BLWPA1147G1Z3      │
└──────────────────────────────────────────────────────┘

EPC PROPOSAL FOR <capacity> KW GRID TIED SOLAR POWER PLANT
CLIENT: <name>          DATE: <dd-mm-yyyy>
<location>              Quotation No.: SGT/YYYY/MM/Bnn

── Cover letter ──────────────────────────────────────
"Respected Sir, We thank you for your interest evinced
in us..."  [fixed boilerplate]
Warm Regards, From Solar Green Technology, Ajmer,
Rajasthan. Vardhman Aameria, +91-7610000632

── [OPTIONAL] Site view before/after ─────────────────
(325kW only — per-quote image upload, section omitted
 when no images provided)

── QUOTATION (<kW> KW – Panels with <inv> KW inverter) ─
┌────┬─────────────┬──────────┬────────┬──────────┬──────────┐
│S.No│ DESCRIPTION │ CAPACITY │ RATE/  │ PRICE ₹  │ PRICE ₹  │
│    │             │ ( Watt ) │ WATT   │ Excl. GST│ Incl. GST│
├────┼─────────────┼──────────┼────────┼──────────┼──────────┤
│ 1  │ Supply of   │ 10280 Wp │ ₹36.30 │ 3,73,116 │4,06,323.32│
│    │ equipments  │          │ /WATT  │   .00    │          │
│    │ and install-│          │        │          │          │
│    │ ation &     │          │        │          │          │
│    │ commissioning│         │        │          │          │
└────┴─────────────┴──────────┴────────┴──────────┴──────────┘

── [IF SUBSIDY] ──────────────────────────────────────
NOTE :- Once client have to pay the total project cost.
After that subsidy amount (that will be Rs 78000) will
be released afterwards.
Total Project cost after subsidy :- RS <finalPayable>

── TERMS & CONDITIONS ────────────────────────────────
• The price is inclusive of applicable taxes and duties.
• Prevailing applicable 05 % (70%) GST on the Supply and
  18 % (30%) GST on the Installation and commissioning.
• Average GST – 8.9 %
• Above given quotation is valid till 10 days i.e. <date>

── TERMS OF PAYMENT ──────────────────────────────────
<dynamic milestone list, 3–5 rows>

── BILL OF MATERIALS ─────────────────────────────────
┌──────────┬─────────┬──────────┬──────────┐
│ Material │ Details │ Quantity │ Warranty │   ← NO PRICES
└──────────┴─────────┴──────────┴──────────┘

── SCOPE OF WORKS ────────────────────────────────────
[fixed boilerplate, 8 bullets]

── CLIENT SCOPE ──────────────────────────────────────
[fixed boilerplate — security of material, security of
 personnel, leveling of land, net metering/load increasing]

── SOME OF OUR PROJECTS ──────────────────────────────
[7 reference projects, fixed]
```

### 5.1 Payment milestone defaults

Seeded by capacity, fully editable, must sum to 100%:

**Small (≤15 kW)** — from the Anil quote:
```
50%  Advance with Work Order
40%  After Installation of Structure and panel
10%  On successful final commissioning of Project
```

**Large (>15 kW)** — from the Vishwakarma quote:
```
20%  Advance with Work Order
40%  After Delivery and Installation of Structure and earthing
20%  After Delivery of modules and Electrical wiring Material
15%  After Delivery of all material
 5%  After successfully commissioning of Project
```

### 5.2 Bill of Materials specification table

**Largely manual.** Specs vary per project in ways no formula derives:

| Field | 10kW | 325kW |
|---|---|---|
| Structure | Apollo GI 2MM, leg/rafter 60×60×2, perlin 60×40×2, bracing 40×40×2, base plate 8×8×6 — 10yr | AL Mono Rail 300×125MM incl. GI pipe — 5yr |
| AC Cable | Al Arm 3.5 core 10 sq mm | Al Armored 3.5 core 300 sq mm |
| DCDB | L&T/Polycab 1-in-1-out, 1000v spd | L&T/Polycab 32-in-32-out, 1000v spd each |
| ACDB | L&T/Polycab 1-in-1-out | L&T/Polycab 2-in-1-out, 630A breaker |
| Earthing | Chemical GI Gel × 3 | Copper Gel 51mm dia × 9 |
| DG Synchronise | — | Present, 5yr |

Seed from capacity-based defaults; keep **every field editable**. Auto-deriving this
section will produce wrong specifications.

Constant rows: DC cable (Polycab Type 1, 4 sq mm tin-coated Cu), MC4 connector
(Staubli or Lenoir equivalent), Protection (Lightning Arrestor ESE type), Online
Monitoring (in-built, internet by client).

---

## 6. Frontend

### 6.1 Stack decisions

| Decision | Value |
|---|---|
| React | 18 |
| Tailwind CSS | 4.3.3 via `@tailwindcss/vite` |
| UI kit | **Catalyst** (Tailwind Plus, licensed) — already in `frontend/components/` |
| Dropped | DaisyUI (conflicts with Catalyst), axios (native `fetch`) |
| Forms | React Hook Form + Zod + `@hookform/resolvers` |
| State | Zustand |
| Routing | React Router v6 |

**Dependencies:**
```
react@^18  react-dom@^18  react-router-dom@^6
@headlessui/react@^2      # every Catalyst component
@heroicons/react          # sidebar/navbar/dropdown icons
motion                    # Catalyst sidebar.tsx + dialog.tsx
clsx
react-hook-form  zod  @hookform/resolvers
zustand

-D  typescript vite @vitejs/plugin-react
    tailwindcss@^4.3.3 @tailwindcss/vite
    eslint prettier vitest
```

### 6.2 Tailwind v4 setup

No `tailwind.config.js` — v4 is CSS-first.

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --font-sans: InterVariable, sans-serif;
  --font-sans--font-feature-settings: 'cv02','cv03','cv04','cv11';
}
```

Inter is self-hosted (not the `rsms.me` CDN) to avoid a third-party runtime dependency.

### 6.3 Dark mode toggle

Tailwind v4's `dark:` follows `prefers-color-scheme` by default and cannot be toggled.
Override required:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

- Three states: light / dark / auto, persisted in `uiStore`
- `<html>` carries the `dark` class plus `scheme-light dark:scheme-dark` so native
  controls and scrollbars follow
- Inline script in `index.html` applies the class **before first paint** — no flash

### 6.4 Catalyst integration

- Components live at `frontend/components/` (Catalyst convention) → move to
  `src/components/ui/`, app components stay separate, `@/` path alias
- **`link.tsx` must be rewired to React Router's `Link`** inside
  `Headless.DataInteractive` — it ships as a bare `<a>` with a TODO. Until this is done
  every sidebar click is a full page reload.
- Catalyst provides Button, Input, Select, Dialog, Badge, Table, Sidebar, Navbar,
  Dropdown, Fieldset, Checkbox, Radio, Switch, Textarea, Combobox, Listbox, Pagination.
  **Only Card and Spinner need writing.**
- Licensed source — repo must stay **private**.

### 6.5 Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    # Catalyst (moved from frontend/components/)
│   │   ├── common/
│   │   │   ├── Card.tsx           # not in Catalyst
│   │   │   └── Spinner.tsx        # not in Catalyst
│   │   ├── costing/
│   │   │   ├── CostingSheet.tsx   # 15-row internal sheet
│   │   │   ├── CostingRow.tsx     # bidirectional ₹ ⇄ ₹/W
│   │   │   └── CostingSummary.tsx # total ₹/W, total cost
│   │   ├── forms/
│   │   │   ├── LeadInfoForm.tsx
│   │   │   ├── PanelConfigForm.tsx    # multi-type rows
│   │   │   ├── InverterForm.tsx
│   │   │   ├── SubsidyForm.tsx
│   │   │   ├── MilestonesForm.tsx     # dynamic 3–5, sum 100%
│   │   │   ├── BomSpecsForm.tsx       # editable spec table
│   │   │   └── QuotationForm.tsx
│   │   ├── quotation/
│   │   │   ├── QuotationPreview.tsx   # mirrors PDF layout
│   │   │   ├── PriceRow.tsx           # the single priced row
│   │   │   ├── BomSpecsTable.tsx
│   │   │   └── ShareOptions.tsx
│   │   └── layout/
│   ├── pages/
│   │   ├── LoginPage.tsx          # 4-digit PIN
│   │   ├── DashboardPage.tsx
│   │   ├── CostingPage.tsx        # Stage 1
│   │   ├── QuotationPage.tsx      # Stage 2
│   │   ├── HistoryPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/
│   │   ├── api/{client,errorHandler,quotationApi,authApi}.ts
│   │   └── pricing/{costingEngine,quotationEngine}.ts
│   ├── hooks/{useCosting,useQuotation,useApi,useLocalStorage,useNotification}.ts
│   ├── stores/{costingStore,quotationStore,uiStore,authStore}.ts
│   ├── utils/{formatters,validators,constants}.ts
│   ├── constants/{config,catalogue,boilerplate}.ts
│   ├── types/index.ts
│   └── styles/globals.css
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> No custom `useForm` hook — React Hook Form owns form state.

---

## 7. Backend — Google Apps Script

```
backend/google-apps-script/
├── Code.gs        # doPost router
├── Auth.gs        # PIN verification, token issue, rate limiting
├── Pricing.gs     # costing → rate → quotation math
├── Validation.gs
├── PDF.gs         # Google Docs template → PDF
├── Email.gs       # MailApp delivery
├── Sheets.gs      # CRUD + server-side pagination
└── Utils.gs
```

### 7.1 Authentication — 4-digit PIN

The PIN **must be verified server-side**. A client-side check is cosmetic: the GAS
endpoint stays open to anyone with the URL and the UI can be bypassed entirely.

- `doPost({action:'login', pin})` → verifies against `PropertiesService`, returns a
  short-lived token
- Every subsequent request carries the token
- **Rate limiting required** — 10,000 combinations is brute-forceable in minutes.
  Lockout after N failures, counter in `PropertiesService`.

> Adequate for an internal tool on a non-public URL. If the portal ever holds customer
> PII that matters commercially, replace with Google sign-in restricted to the domain.

### 7.2 CORS

GAS web apps don't handle preflight. Requests post as `text/plain` with a JSON body
parsed server-side. No custom headers.

### 7.3 PDF generation

Google Docs template with placeholders, populated by `PDF.gs`, exported to PDF, saved to
Drive, link returned. Logo embedded in the template (not URL-referenced).

### 7.4 Email

Consumer Gmail via `MailApp`. **Hard quota: 100 recipients/day**, rolling 24h.
First thing to break if volume grows.

### 7.5 History

Server-side pagination — `Sheets.gs` returns `{ rows, total }` for a row range.
Search/filter scans the sheet per request; expect ~1–2s per page.

### 7.6 WhatsApp

Free `wa.me` deep link, no API cost:

```
https://wa.me/91XXXXXXXXXX?text=<url-encoded message>
```

---

## 8. Assets & boilerplate

```
assets/
└── Logo.png                    ✓ present (note: white background, not transparent)

templates/
├── quotation-template.docx     # Google Docs template
├── cover-letter.txt            # "Respected Sir..." — verbatim from samples
├── scope-of-works.txt          # 8 bullets — verbatim
├── client-scope.txt            # 4 clauses — verbatim
├── terms-conditions.txt        # incl. "Average GST – 8.9 %"
└── our-projects.txt            # 7 reference projects
```

**Company config:**
```typescript
{
  name:    "Solar Green Technology",
  address: "Ajmer, Rajasthan",
  phone:   "+91-7610000632",
  email:   "technosolargreen@gmail.com",
  gstin:   "08BLWPA1147G1Z3",
  signatory: "Vardhman Aameria"
}
```

> The Anil DOCX sign-off reads "Jodhpur, Rajasthan" while its letterhead reads Ajmer.
> Treated as a typo — Ajmer is used throughout.

**Reference projects** (325kW version taken as canonical):
Mayo College Girls School Ajmer 300KW (EPC) · SARAS Cattle Feed Dairy Ajmer 600KW (EPC) ·
Durlabh ji Hospital Jaipur 300KW (INC) · Jewellery Zone Jaipur 100KW (INC) ·
Vidhan Sabha Jaipur 600KW (INC) · Mahesh Marbles Kishangarh 65KW (EPC) ·
Mahaveer Group Palra Industries Area Ajmer 490KW (EPC)

---

## 9. Timeline

Revised to **8–9 days**. v2's 7-day estimate assumed configuration and services already
existed; the repo contains only the Catalyst components.

### Day 1 — Scaffold
- Vite + React 18 + TypeScript
- Tailwind 4.3.3 via `@tailwindcss/vite`, `@theme`, self-hosted Inter
- `@custom-variant dark` + three-state toggle + no-flash inline script
- Move Catalyst to `src/components/ui/`, `@/` alias
- **Rewire `link.tsx` to React Router**
- MainLayout / Header / Sidebar, routing skeleton

### Day 2 — Costing engine (Stage 1)
- `costingEngine.ts` — bidirectional ₹ ⇄ ₹/W, 15 lines, totals
- `CostingSheet` + `CostingRow` + `CostingSummary`
- Clone-from-previous / template seeding
- Unit tests against the ₹28.710457 reference

### Day 3 — Quotation forms (Stage 2)
- `PanelConfigForm` — multi-type rows, derived capacity
- LeadInfo / Inverter / Subsidy forms
- `MilestonesForm` — dynamic, capacity-seeded defaults, sum-to-100 validation
- Zod schemas

### Day 4 — Preview & BOM specs
- `QuotationPreview` mirroring PDF layout exactly
- `BomSpecsForm` + `BomSpecsTable`, capacity-seeded editable defaults
- `quotationEngine.ts` — × 1.089, subsidy, milestone amounts
- Verify against both sample quotations to the paisa

### Day 5 — GAS backend
- `Code.gs` router, `Auth.gs` PIN + rate limiting, `Sheets.gs` CRUD
- `Pricing.gs` mirroring frontend math
- CORS via `text/plain`

### Day 6 — PDF & delivery
- Google Docs template with placeholders + embedded logo
- `PDF.gs` generation, `Email.gs` delivery, `wa.me` links
- **Regression: regenerate both sample quotations, diff against originals**

### Day 7 — Pages
- LoginPage (PIN), DashboardPage
- HistoryPage with server-side pagination + search
- SettingsPage

### Day 8 — Polish & test
- Mobile responsive, loading states, error boundaries
- End-to-end: costing → quotation → PDF → email → WhatsApp
- Error scenarios

### Day 9 — Deploy
- Vercel frontend, GAS backend deployment
- Env vars, smoke test, documentation

---

## 10. Acceptance tests

The build is correct when it reproduces the source documents:

- [ ] **Anil 10.2kW** — mixed panels 7×590 + 10×615 = 10,280 Wp; @ ₹36.29533074/W
      (prints ₹36.30) → ₹3,73,116.00 excl.; × 1.089 → **₹4,06,323.32** incl.;
      − ₹78,000 → ₹3,28,323.32
- [ ] **Vishwakarma 325kW** — 551 × 590 = 3,25,090 Wp; @ ₹25.18494725/W (prints
      ₹25.18) → ₹81,87,374.50 excl.; × 1.089 → **₹89,16,050** incl.; subsidy zeroed
- [x] **Costing sheet** — the 15 reference lines derive exactly **₹28.710457/W** and
      total **₹35,91,104** *(Day 2 — `costingEngine.test.ts`)*
- [x] Bidirectional entry: editing ₹ updates ₹/W and vice versa, both modes *(Day 2)*
- [x] Rounded display rate never used in arithmetic *(Day 2)*
- [x] Capacity derived from mixed panel counts — 7×590 + 10×615 = 10,280 Wp *(Day 3)*
- [x] Milestones reject any set not summing to 100% *(Day 3)*
- [x] Inverter sizing never blocks a valid historical pairing *(Day 3)*
- [x] Subsidy line always present; amount editable; rejects negative and over-total *(Day 3)*
- [x] PDF section order matches the DOCX samples exactly *(Day 4 — preview)*
- [x] The 15 line items appear nowhere on the customer document *(Day 4)*
- [x] Subsidy at zero removes both the note and the after-subsidy line *(Day 4)*
- [x] Printed figures format to the paisa: ₹3,73,116.00 / ₹4,06,323.32 / ₹3,28,323.32
      and ₹81,87,374.50 / ₹89,16,050.83 *(Day 4)*
- [x] Validity date arithmetic: 14-04-2026 + 10 days = 24-04-2026 *(Day 4)*
- [x] Generated PDF model reproduces both samples section-for-section *(Day 6 —
      `documentModel.test.ts` runs the real `DocumentModel.gs`)*
- [x] WhatsApp deep link identical client-side and server-side *(Day 6)*
- [x] Email body includes the subsidy breakdown only when one applies *(Day 6)*
- [ ] PDF renders and emails correctly from Drive — **needs deployment**
- [x] PIN rejected server-side; lockout triggers after 5 failures *(Day 5)*
- [x] Server recomputes totals rather than trusting the client *(Day 5)*
- [x] Backend and frontend pricing produce byte-identical figures *(Day 5 — parity test)*
- [x] Settings exposes the subsidy and validity defaults *(Day 7)*
- [x] Sign-in redirects back to the page originally requested *(Day 7)*
- [x] Dark mode is fully class-driven — 811 rules on `:where(.dark,.dark *)`, no
      `prefers-color-scheme` in the CSS, no-flash script in the built HTML *(Day 8)*
- [x] Server-side validation rejects everything the client rejects *(Day 8 — parity test)*
- [x] Server ignores client-supplied totals entirely *(Day 8)*
- [x] Server survives null, strings, numbers and non-array fields without throwing *(Day 8)*
- [x] Routes code-split; no chunk over 500 kB *(Day 8)*
- [x] A render error no longer blanks the app *(Day 8 — ErrorBoundary)*

---

## 11. Open items

Non-blocking; sensible defaults assumed unless overridden.

| Item | Default assumed |
|---|---|
| Site-view images | Optional per-quote upload; section omitted when absent |
| Inverter selection | Manual from catalogue — no auto-derivation (catalogue gaps 10kW→250kW) |
| Bundle size | v2's <150KB target dropped as unreachable with this stack; lazy-load routes instead |
| GST treatment | 70/30 deemed split per the samples — worth confirming with your CA, as line-item GST and the deemed split are different treatments |
| Logo background | White, not transparent — fine on the PDF letterhead |

---

**Rebuilt against `Book1 (1).xlsx`, `Anil Bh Interior 10 kw.docx`, and
`Vishkarma health care 325kw.docx`.**
