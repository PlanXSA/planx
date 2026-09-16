# How to use the Plan X expert prompt

English brief for the owner and for anyone running the review. The prompt itself is `docs-expert-prompt.md`.

Date: 2026-09-16.

---

## Purpose

The nucleus just locked three decisions that need an outside engineer, not another product meeting:

1. Metres are database columns written in the same `apply` as geometry.
2. The data model copies ArcGIS Pro *mechanism*, not the product.
3. Identity is a local project file, not a user-account system.

The prompt forces a senior geospatial reviewer to attack those locks and the current code path. It is not a request for a vision deck.

## What the two files are

| File | Role |
|---|---|
| `docs-expert-prompt.md` | Paste-ready prompt. Everything below the horizontal rule is the message to the reviewer. |
| `docs-expert-prompt-guide.md` | This file. Why the prompt is shaped this way, who should run it, what to do with the answer. |

Do not edit the prompt mid-review to “make it nicer.” If a lock changes, update the prompt and run a new review.

## Who should answer it

Best: a geospatial systems engineer who has shipped a geodatabase or a browser GIS, and who has read Esri topology / parcel fabric docs without treating them as mandatory architecture.

Acceptable: another model or colleague given the same file and the repo tree (`sql/schema.sql`, `packages/engines/*`, `packages/store/memory.ts`, `docs-measures.md`, `docs-model.md`).

Not useful: a general product designer, a BIM-only reviewer, or anyone asked to “design Plan X from scratch.”

## How to run it

1. Open a clean session.
2. Paste the block under the rule in `docs-expert-prompt.md` unchanged.
3. Attach or paste, all of these: `ARCHITECTURE.md`, `sql/schema.sql`, `docs-measures.md`, `docs-model.md`, `packages/engines/measure.ts`, `packages/engines/parcel.ts`, `packages/engines/street.ts`, `packages/store/memory.ts`.
4. Require one markdown file back, sections 1–8 only, ≤1,200 words, exactly five tasks in section 6. Section 2 must show arithmetic, not a bare tolerance.
5. Save the reply as `docs-expert-review-YYYYMMDD.md` next to these files. Do not merge advice into schema until the owner accepts each `CHANGE`.

## Why the prompt is narrow

Earlier reviews drifted into PostGIS, 3D, Balady, and multiplayer. Those are already out of v0. The numbered sections exist so the reviewer cannot substitute a platform redesign for a metre-pipeline audit.

The ArcGIS mapping is included so the reviewer judges the *delta* (one `features` table, surfaces instead of versions, polygon-first parcels). We want “this rule must run in apply” or “this Esri class is optional,” not “build Parcel Fabric.”

The UTM section exists because `measure.ts` delegates to `parcel.ts` / `street.ts`, which still use a local equirectangular stand-in at Riyadh latitude (`measure_epsg = 0`). Column names must survive the swap. A reviewer who proposes measuring in EPSG:3857 is out of contract. Slice 1c (browser proof) is intentionally not a section-1 defect; it may appear only as a ranked task in section 6.

## What a good review looks like

- Defects tied to a wrong number a planner would publish.
- A UTM cutover that keeps `length_m` / `area_m2` / `frontage_m`.
- A short topology list for `apply` versus a later validate pass.
- Five tasks a coder can execute without the owner writing code.
- An explicit reject list so leftover Esri or SaaS advice is visible.

## What to ignore in the reply

- New feature classes per land-use type.
- Login, cloud sync, OPFS as the save path.
- Calling DuckDB a toy and replacing it with PostGIS for v0.
- Frontage as a full ROW polygon in this slice.
- Any rewrite of `kind` into ten physical tables.

## After the review

Owner (Ahmed) marks each defect: accept / defer / reject. Accepted items become the next coding slice. Deferred items go to `ARCHITECTURE.md` out-of-v0. GitHub push stays after the slice is accepted; the connector cannot write the public repo today.
