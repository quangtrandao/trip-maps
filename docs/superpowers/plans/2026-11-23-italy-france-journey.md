# Italy → France Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a third, rail-only journey (northern Italy → southern France → Paris) to Trip Maps.

**Architecture:** One new `JOURNEYS.italy` data block in `src/index.html`, 13 day-trip legs, 19 rail shapes, € currency. No renderer change.

**Tech Stack:** vanilla JS/Leaflet, Node 24 scripts, headless Edge smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-23-italy-france-journey-design.md`

## Global Constraints

- Train only: every leg gets a `rail` shape so `upgradeRoute` (driving lookup) never runs for this journey.
- Photos are Wikimedia `wf()` hotlinks whose URLs were verified to return an image.
- Night totals: 2+3+2+2+1+2+12 = 24.
- `check.mjs` and `smoke.mjs` stay green; no renderer edits.

---

### Task 1: Data block

**Files:** Modify `src/index.html` (DATA block)

**Interfaces:**
- Produces: `JOURNEYS.italy` with `title:"Italy & France"`, `label:"🇮🇹→🇫🇷"`, `sub:"24 nights · all by train"`, `currency.symbol:"€"`, `staySelector:"stops"`, 7 stops, 13 trips, 19 rail keys, 7 colours.

- [ ] **Step 1: Add the block** with the stops, day trips, rail shapes, colours and verified photos from the spec's budget table.
- [ ] **Step 2: Run `node scripts/check.mjs`** — expect `OK china`, `OK japan`, `OK italy`.
- [ ] **Step 3: Commit** `feat: add italy-france journey`.

### Task 2: Test expectations and README

**Files:** Modify `scripts/smoke.mjs`, `README.md`

- [ ] **Step 1: Update the failing expectations first** — toggle buttons 3; new `testItaly` asserting title, sub, 20 markers, 7 stay options, 24 nights + €, 7 legend rows, 19 paths, and no page exceptions.
- [ ] **Step 2: Run `node scripts/smoke.mjs`** — expect failure before the data exists, pass after Task 1.
- [ ] **Step 3: Add the journey to README's list** and the destination count.
- [ ] **Step 4: Commit** `test: cover the italy-france journey`.

### Task 3: Deploy and verify

- [ ] **Step 1:** `git push`; wait for the Vercel build.
- [ ] **Step 2:** Fetch production `?trip=italy`, assert 200 and the block is present; open in the browser, switch Italy → Japan → Italy, confirm 20 markers, 19 routes, one legend, no console errors.
- [ ] **Step 3:** Report the live URL and the toggle labels.
