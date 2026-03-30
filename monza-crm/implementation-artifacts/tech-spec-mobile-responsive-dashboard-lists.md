---
title: "Mobile-responsive dashboard lists (Cars, Customers Sold, FAB)"
slug: mobile-responsive-dashboard-lists
created: "2026-03-23"
status: ready-for-dev
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 16 (App Router)
  - React 19
  - Tailwind CSS v4
  - shadcn/ui (Card, Table, Badge, Button, DropdownMenu)
files_to_modify:
  - web/src/app/(dashboard)/cars/page.tsx
  - web/src/app/(dashboard)/customers/page.tsx
  - web/src/components/scanner/FloatingScanButton.tsx
code_patterns:
  - "Responsive split: mobile cards `md:hidden`, desktop table `hidden md:block`"
  - "Touch targets: `touch-manipulation` on small-screen controls where applicable"
  - "Stop propagation on interactive chips/menus inside card row click targets"
test_patterns:
  - "Manual: Chrome DevTools device toolbar < 768px and ≥ 768px"
  - "Optional: Playwright viewport projects for sm/md"
---

# Tech-Spec: Mobile-responsive dashboard lists (Cars, Customers Sold, FAB)

**Created:** 2026-03-23  
**Authoring note:** Phase 1 items below are **implemented** in-repo; this document is the **authoritative spec** for behavior, regression checks, and Phase 2 follow-ups.

## Overview

### Problem Statement

Wide data tables on **Car Inventory** and **Customers → Sold Cars** do not fit phone screens: horizontal scrolling, cramped columns, and poor tap targets reduce usability for garage and field staff. A global **floating scan** control can overlap list content on small viewports.

### Solution

Use **Tailwind `md` (768px)** as the breakpoint: **card lists below `md`**, **existing tables from `md` upward**. Preserve **business logic** (status / PDI / customs dialogs, navigation, permissions) by reusing the same handlers. Add **`formatVinShort`** for display density. Constrain page-level **horizontal overflow** and **raise the FAB** on small screens.

### Scope

**In Scope (Phase 1 — done):**

1. **Cars** — `web/src/app/(dashboard)/cars/page.tsx`
2. **Customers → Sold Cars** — `web/src/app/(dashboard)/customers/page.tsx`
3. **Floating scan button** — `web/src/components/scanner/FloatingScanButton.tsx`

**In Scope (Phase 2 — done for listed pages):**

- **Garage inventory**, **installments**, **dashboard** (layout polish), **assistant-dashboard** (pending + workshop: card/table split; tab bar + list polish).

**Out of Scope:**

- **`/api/data-health/count`** (or any) **latency optimization** — separate initiative (caching, DB, async).
- Changing **Supabase** schema or **RLS** for this UX work.
- **Redesign** of desktop table columns or export formats.

## Context for Development

### Codebase Patterns

- **Breakpoint:** `md` = **768px** (Tailwind default). Use **`md:hidden`** for mobile-only blocks and **`hidden md:block`** for desktop-only blocks.
- **Cards:** Rounded container, `border-border/50`, `bg-card`, `shadow-sm`, adequate **`pb-*`** so **FAB** clearance is acceptable on long lists.
- **Table:** Keep **`overflow-x-auto`** wrapper on desktop so wide column sets remain usable.
- **Click vs nested actions:** Card **root** navigates to car/customer detail; **badges and menus** call **`stopPropagation`** (or wrap in `<button>`) so dialogs and dropdowns do not trigger navigation.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `web/src/app/(dashboard)/cars/page.tsx` | Car list: mobile cards + desktop table; `formatVinShort`; `overflow-x-hidden` on page root |
| `web/src/app/(dashboard)/customers/page.tsx` | Customers: All/Leads `CustomerTable` (existing); Sold tab mobile cards + desktop table; page `overflow-x-hidden` |
| `web/src/components/scanner/FloatingScanButton.tsx` | FAB position/size responsive classes |
| `web/src/types/database.ts` (or related) | `CarDisplay`, labels used in badges |
| `web/src/lib/constants/badges.ts` | `STATUS_BADGE_COLORS`, PDI/customs colors |

### Technical Decisions

| Decision | Rationale |
| -------- | --------- |
| **`md` breakpoint** | Aligns with common “tablet up = table” pattern; already used on Customers All/Leads. |
| **Duplicate row UI (card vs table)** | Avoids fragile CSS-only table transforms; explicit markup per viewport. |
| **`formatVinShort`** | Long VINs: show `…` + **last 8** chars when length > 12; full VIN via native **`title`** on the element. |
| **FAB `bottom-20 right-4`** | Clears thumb zone / list footers on phones; restore **`sm:bottom-6 sm:right-6`** on larger screens. |

## Implementation Plan

### Tasks

**Phase 1 (verify / maintain)**

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add `formatVinShort(vin)`; use on mobile VIN line with `title={car.vin}` | `cars/page.tsx` | Done |
| 2 | Mobile card list: model/title, short VIN, location, year, optional client line, status/PDI/customs (same handlers as table), battery + bar, arrived date, docs + ⋯ menu | `cars/page.tsx` | Done |
| 3 | Wrap desktop table in `hidden md:block`; scroll container `overflow-x-auto` | `cars/page.tsx` | Done |
| 4 | Root layout container `overflow-x-hidden` on Cars page | `cars/page.tsx` | Done |
| 5 | Sold Cars: mobile cards (vehicle, VIN short, color, customer, phone, price/dates, Customer/Car buttons) | `customers/page.tsx` | Done |
| 6 | Sold Cars: desktop table unchanged structurally, wrapped `hidden md:block` + `overflow-x-auto` | `customers/page.tsx` | Done |
| 7 | Customers page root `overflow-x-hidden` | `customers/page.tsx` | Done |
| 8 | FAB: `bottom-20 right-4`, `sm:bottom-6 sm:right-6`; mobile size `h-14 w-14`, `sm:h-12 sm:w-12` | `FloatingScanButton.tsx` | Done |

**Phase 2**

| # | Task | Notes |
|---|------|------|
| P2-1 | Garage inventory list | `md:hidden` cards / `hidden md:block` table — **Done** (cards match table actions, `formatOeShort`, `overflow-x-hidden`) |
| P2-2 | Installments | **Done** — Due / Upcoming / Paid / Plans: `md:hidden` cards + `hidden md:block` tables; `formatVinShort` for car line; summary grid without `min-w-[960px]` on mobile; page `overflow-x-hidden` |
| P2-3 | Dashboard | **Done (polish)** — no primary data table; page `overflow-x-hidden`, `pb-20 sm:pb-6` for FAB, responsive KPI grid, low stock + recent activity stack on small screens |
| P2-4 | Assistant dashboard | **Done** — **Pending Requests** + **Workshop Status**: `md:hidden` cards + `hidden md:block` tables (`min-w-*` on table); `formatVinShort` on workshop/pickup/warranty lines; horizontal tab bar on narrow viewports; page `overflow-x-hidden` + `pb-20`; **profiles** join still normalized via `.map()` (`Array.isArray(r.profiles) ? r.profiles[0] : r.profiles`, `(r: any)`) — do not regress |

### Acceptance Criteria

**Cars — mobile (`< md`)**

1. **Given** the Car Inventory page with at least one car **When** viewport width is **&lt; 768px** **Then** a **vertical card list** is shown (no horizontal table as primary UI).
2. **Given** a car with VIN longer than 12 characters **When** viewing the mobile card **Then** the VIN text shows **`…` + last 8** and the **full VIN** appears as a **tooltip** (`title`) on that line.
3. **Given** a mobile card **When** the user taps **outside** badges/menus **Then** navigation opens **`/cars/[vin-or-id]`** (same as table row).
4. **Given** status / PDI / customs badges **When** tapped **Then** the **same dialogs or navigation** run as on the desktop table (no regression).
5. **Given** battery percent present **When** on mobile **Then** **numeric %** and a **thin progress bar** are visible.
6. **Given** the ⋯ menu **When** opened **Then** View / Documents / Edit / Move / Delete match **permission-gated** desktop behavior.

**Cars — desktop (`≥ md`)**

7. **Given** viewport **≥ 768px** **When** on Car Inventory **Then** the **existing table** is visible and the **card list is hidden**.
8. **Given** many columns **When** on desktop **Then** the table sits in a **horizontally scrollable** region without breaking page layout.

**Customers — Sold Cars**

9. **Given** Sold Cars tab with orders **When** **&lt; md** **Then** **cards** show vehicle, shortened VIN, customer, phone, price, sale/delivery dates, and **Customer** / **Car** actions.
10. **Given** **≥ md** **Then** the **full table** is shown and cards are hidden.

**FAB**

11. **Given** a small viewport **When** the FAB renders **Then** it uses **`bottom-20 right-4`** (not overlapping list footers by default).
12. **Given** **`sm` and up** **Then** position **`bottom-6 right-6`** (or equivalent per implementation).

**General**

13. **Given** Cars and Customers pages **When** loaded **Then** the main page wrapper applies **`overflow-x-hidden`** to reduce accidental horizontal page scroll.

### Dependencies

- None beyond existing **Next**, **Tailwind**, **shadcn** stack.

### Testing Strategy

- **Manual:** Resize below/above 768px; verify Cars, Customers (all three tabs), FAB on **dashboard layout** (`web/src/app/(dashboard)/layout.tsx`).
- **Regression:** Status → customer link, PDI dialog, customs dialog, delete/edit permissions, export buttons unchanged on desktop.
- **Optional:** Add Playwright **`projects`** with `viewport: { width: 390, height: 844 }` and `1280x720` for smoke snapshots.

### Notes

- **`/data-health/count` latency** — track separately (metrics, caching, DB explain, or moving aggregation off hot path).
- **Phase 2** pages: grep for `<Table` / `TableHeader` under `web/src/app/(dashboard)` to find remaining wide tables.

---

**BMAD quick-spec:** Spec is **ready for development** for Phase 2; Phase 1 serves as **regression baseline** for QA and future refactors.
