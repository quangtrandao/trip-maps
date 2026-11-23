# Bilingual + VND + Shared Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Trip Maps bilingual (EN/VI), show VND on every amount, and use one transport-family palette across all three journeys.

**Architecture:** Add `RATES`, `FAMILIES`, `MODES`, `UI` to the DATA block; journeys reference modes instead of owning colours; the renderer gains `bi()`, `amount()` and family-derived legends.

**Tech Stack:** vanilla JS/Leaflet, Node scripts, headless Edge smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-23-bilingual-vnd-colours-design.md`

## Global Constraints

- Vietnamese always appears beneath English, smaller and muted.
- Symbols: `CN¥`, `JP¥`, `€`; VND in `vi-VN` format with `₫`.
- Legend lists transport **families**, not modes; identical colours across trips.
- Side trips keep their transport colour, dashed, hollow small marker.
- Paris accommodation renders as a sentence, never as a figure.

---

### Task 1: Failing tests for the new behaviour

**Files:** Modify `scripts/smoke.mjs`, `scripts/check.mjs`

- [ ] **Step 1: Add assertions**
  - `testMount`: Japan legend rows = 3; China = 3; Italy = 5 (families).
  - New `testColours`: on each journey, every path stroke ∈ family colours; Italy's Frecciarossa and TGV paths share one stroke; China's high-speed and Italy's TGV share `#d6336c`.
  - New `testBilingual`: on Italy, `.vi` nodes exist; the Paris popup contains "Ở với gia đình" and no "€0"; a budget row contains `≈` and `₫`; the legend footer contains the rate date `23/11/2026`.
  - `check.mjs`: require `RATES`, `FAMILIES`, `MODES`, `UI`; every leg `t` in `MODES`; `MODES[*].family` in `FAMILIES`; `currency.code` in `RATES`; `actVi`/`tnVi` present.
- [ ] **Step 2: Run both** — expect failures naming the missing bilingual/currency/legend behaviour.
- [ ] **Step 3: Commit** `test: pin bilingual, vnd and shared-colour behaviour`.

### Task 2: Data and renderer

**Files:** Modify `src/index.html`

- [ ] **Step 1:** Add `RATES`, `FAMILIES`, `MODES`, `UI`; drop per-journey `colors`; add `titleVi`, `subVi`, `currency.code`, `periodsVi`, `cVi`, `accVi`, `tnVi`, `actVi` across all three journeys.
- [ ] **Step 2:** Renderer: `bi()`, `amount()`, family legend with rate footer, bilingual stats, two-line toggle buttons, bilingual popups/tooltips, free-stay sentence.
- [ ] **Step 3:** `node scripts/check.mjs && node scripts/smoke.mjs` — all green.
- [ ] **Step 4: Commit** `feat: bilingual labels, vnd equivalents, shared transport palette`.

### Task 3: Deploy

- [ ] **Step 1:** Push, wait for the Vercel build.
- [ ] **Step 2:** Live check: Italy legend = 5 families, TGV and Frecciarossa red, `₫` on amounts, Vietnamese lines present, Paris shows the family sentence.
