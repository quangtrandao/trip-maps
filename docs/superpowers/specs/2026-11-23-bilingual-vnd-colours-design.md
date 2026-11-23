# Bilingual + VND + shared colour system — design

Date: 2026-11-23
Status: approved in conversation (colour rule decided: side trips keep transport colours)

## Intent

The app is for Vietnamese-speaking parents-in-law. They must be able to read
every label, itinerary sentence and price without English. Prices must be
comparable to money they know (VND), and the same colour must mean the same
thing on all three trips.

## Goals

1. Every user-visible string is bilingual: English first, Vietnamese beneath it
   in smaller muted type.
2. Every amount shows its VND equivalent: `CN¥520 (≈ 2.007.000 ₫)`.
   CNY and JPY stop sharing the bare `¥` symbol — they become `CN¥` and `JP¥`.
3. Paris shows "Staying with family — no accommodation cost" with no figure.
4. One shared palette by transport family for all journeys:
   high-speed rail red `#d6336c`, express/intercity purple `#7048e8`,
   regional rail blue `#1c7ed6`, urban rail teal `#0c8599`, bus/road green `#2f9e44`.
   The legend is generated from those families, so it is identical in meaning
   across trips and lists only the families a trip uses.
5. Side trips keep their transport colour, dashed, with the small hollow marker.

## Non-goals

- No language toggle: both languages are always shown.
- No live exchange-rate fetch: rates are constants with a date, shown in the
  legend footer.
- No translation of proper nouns: city, hotel, region and line names keep their
  original spelling, except Chinese cities which get Vietnamese names
  (Quảng Châu, Thâm Quyến, Triệu Khánh, Phật Sơn & Thuận Đức, Hồng Kông).

## Data shape

```js
const RATES = { CNY: 3860, JPY: 163, EUR: 28300, asOf: "23/11/2026" }; // VND per unit
const FAMILIES = {
  highSpeed: { en: "High-speed rail", vi: "Tàu cao tốc", color: "#d6336c" },
  express:   { en: "Express / intercity", vi: "Tàu tốc hành / liên tỉnh", color: "#7048e8" },
  regional:  { en: "Regional rail", vi: "Tàu vùng", color: "#1c7ed6" },
  urban:     { en: "Metro / urban rail", vi: "Tàu điện ngầm", color: "#0c8599" },
  road:      { en: "Bus / road", vi: "Xe buýt / đường bộ", color: "#2f9e44" }
};
const MODES = {
  "High-speed rail": { en: "High-speed rail", vi: "Tàu cao tốc", family: "highSpeed" },
  "Cross-border HSR": { en: "Cross-border HSR", vi: "Tàu cao tốc xuyên biên giới", family: "highSpeed" },
  "Shinkansen": { en: "Shinkansen", vi: "Tàu Shinkansen", family: "highSpeed" },
  "Frecciarossa": { en: "Frecciarossa", vi: "Tàu Frecciarossa", family: "highSpeed" },
  "TGV": { en: "TGV", vi: "Tàu TGV", family: "highSpeed" },
  "Intercity": { en: "Intercity", vi: "Tàu liên tỉnh", family: "express" },
  "Limited Express": { en: "Limited express", vi: "Tàu tốc hành", family: "express" },
  "Local train": { en: "Local train", vi: "Tàu địa phương", family: "regional" },
  "Regionale": { en: "Regionale", vi: "Tàu Regionale", family: "regional" },
  "TER": { en: "TER", vi: "Tàu TER", family: "regional" },
  "Metro": { en: "Metro", vi: "Tàu điện ngầm", family: "urban" },
  "RER": { en: "RER", vi: "Tàu RER", family: "urban" },
  "Bus": { en: "Bus", vi: "Xe buýt", family: "road" },
  "Car": { en: "Car", vi: "Ô tô", family: "road" }
};
```

Journey config loses `colors`, gains `currency: {code, symbol, locale}`,
`titleVi`, `subVi` (and `periodsVi` where `periods` exists).

Every stop and day trip gains `actVi`; every `tn` gains `tnVi`; cities that
read differently in Vietnamese gain `cVi`. `accVi` is required when `acc` is a
description rather than a hotel name.

## UI strings (EN / VI)

| Key | EN | VI |
|---|---|---|
| stay | Stay | Chỗ ở |
| do | Do | Hoạt động |
| budget | Budget | Ngân sách |
| next | Next | Chặng tiếp |
| travel | Travel | Di chuyển |
| type | Type | Loại |
| time | Time | Thời gian |
| cost | Cost | Chi phí |
| eachWay | each way | mỗi chiều |
| est | (est.) | (ước tính) |
| costNA | cost n/a | không rõ giá |
| dayTripFrom | Day trip from | Đi trong ngày từ |
| nights | night(s) | đêm |
| noPictures | No picture yet | Chưa có ảnh |
| legendHint | Dashed = day trip. Hover a line for transport, time and cost; click it for pictures. | Nét đứt = đi trong ngày. Rê chuột lên đường để xem phương tiện, thời gian, chi phí; bấm để xem ảnh. |
| rates | Rates | Tỷ giá |
| totalBudget | total budget | tổng ngân sách |
| inTransit | in transit | thời gian di chuyển |
| transport | transport (est.) | di chuyển (ước tính) |

## Money

`amount(v)` → `${symbol}${enNumber} (≈ ${vnd} ₫)` with `vnd` formatted
`vi-VN` (dots as thousands). Rates: 1 € = 28.300 ₫, 1 JP¥ = 163 ₫,
1 CN¥ = 3.860 ₫, dated 23/11/2026. Symbols: `CN¥`, `JP¥`, `€`.

## Layout

`.vi` lines are `display:block; font-size:12px; color:#6b7280;` under the
English line. Popups stay 250 px wide; the extra line wraps rather than
widening the popup.

## Risks

- Popups grow taller; the 130 px carousel is unchanged, so a long Vietnamese
  sentence will scroll the popup rather than the map.
- Translations are my own; names of dishes and places keep their original
  spelling (tagliatelle al ragù, cicchetti) as Vietnamese food writing does.
- Rates drift; the date is displayed so the number is never mistaken for live.
