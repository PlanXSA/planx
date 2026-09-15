# AGENTS

Follow `.github/copilot-instructions.md`.

## Role

Implement one accepted slice. Do not expand scope. Do not edit locks.

## Before coding

1. Read `ARCHITECTURE.md`.
2. Name the slice and the files you will touch.
3. Extend a test first when behaviour changes.

## Rules

- Keep `apply` atomic. An open parcel writes nothing.
- OSM buildings are not parcels. `place=plot` may be.
- `use` is a column, not a closed list.
- Store 4326. Metres from project UTM. Never Web Mercator metres.
- Re-import never deletes `source=user`.

## Done when

- `npm test` passes
- No lock in `ARCHITECTURE.md` was silently changed
- PR describes behaviour and any lock risk

## When uncertain

Stop and ask PlanXSA. Do not invent product intent.
