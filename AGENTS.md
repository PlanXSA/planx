# AGENTS

This repository is Plan X. Follow `.github/copilot-instructions.md`.

## Role

Implement one accepted slice. Do not expand scope. Do not edit locks.

## Before coding

1. Read `ARCHITECTURE.md`, `docs-measures.md`, `docs-duckdb-wasm.md`.
2. Name the slice and the files you will touch.
3. Extend `scripts/check.mts` (and vitest if present) when behaviour changes.

## Done when

- `npm run check` passes
- No lock in `ARCHITECTURE.md` was silently changed
- Metres stay on feature columns; UI does not compute from tiles
- WASM failure still falls back to MemoryStore with a visible note
