# Italy → France journey — design

Date: 2026-11-23
Status: approved (itinerary confirmed in conversation)

## Intent

Add a third destination to the Trip Maps app: a rail-only trip from Hanoi's
direct arrival point in Italy (Milan Malpensa, flight VN73) through northern
Italy and southern France to 12 nights in Paris, where the traveller's parents
live. Food is the organising interest; the traveller does not drive.

## Goals

- One new `JOURNEYS` entry; the toggle button is generated from it.
- 24 nights: Milan 2, Bologna 3, Genoa 2, Nice 2, Avignon 1, Lyon 2, Paris 12.
- 13 day trips, all reachable by train (one short bus to the Pont du Gard).
- Every leg has a hand-drawn rail shape, so no driving-route lookup runs.
- Paris accommodation is €0 (staying with family); budget covers food,
  museums, transport and day trips.
- Photos hotlinked from Wikimedia Commons, each URL verified to return an image.

## Non-goals

- No flight leg on the map (the app starts at the arrival city, as the other
  two journeys do).
- No dates: Paris/Italy timing is not fixed, so stays use derived "N nights"
  labels instead of fixed periods.
- No changes to the renderer or validator; this is data plus test expectations.

## Approach (chosen)

One `JOURNEYS.italy` block following the existing shape: `stops` (7, with
`ac`, `b`, onward `t/tn/tc/m`), `trips` (13 day trips with `base`), `rail`
(19 keys: 6 main legs, 13 day trips), `colors` for seven modes
(Frecciarossa, Intercity, TGV, TER, Regionale, RER, Bus), `currency` € and
`map` covering the whole route.

Rejected: a separate "Europe" journey with the flight drawn — the map has no
flight geometry anywhere, and adding one would diverge from the other journeys.

## Budget (€ per person, sharing a double room)

| Stop | Nights | Hotel | Stop budget | Sent by |
|---|---|---|---|---|
| Milan | 2 | 360 | 700 | Frecciarossa €45, 1h |
| Bologna | 3 | 330 | 600 | Intercity €30, 2h |
| Genoa | 2 | 220 | 420 | TER €30, 3h |
| Nice | 2 | 300 | 520 | TGV €45, 3h10 |
| Avignon | 1 | 140 | 230 | TGV €25, 1h05 |
| Lyon | 2 | 280 | 480 | TGV €60, 2h |
| Paris | 12 | 0 | 800 | — |

Day trips total €685. Rail total ≈ €1,170 per person return for the whole
route including day trips; flights excluded.

## Risks

- Wikimedia hotlinks can rot; a failed image now degrades to "No picture yet"
  (verified behaviour).
- Budgets are estimates, deliberately mid-range; they are data, not truth.
- Genoa → Nice crosses the border at Ventimiglia; the shape is approximate.
