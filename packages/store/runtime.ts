import { MemoryStore } from "./memory.ts";
import type { Store } from "./types.ts";

export interface Runtime {
  store: Store;
  engine: "memory" | "duckdb";
  note: string;
}

/**
 * Slice 1c: try DuckDB-WASM. On any failure keep MemoryStore and say so.
 * Live WASM instantiate is browser-only; Node/check uses memory.
 */
export async function bootStore(): Promise<Runtime> {
  if (typeof window === "undefined") {
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: "MemoryStore (no window — DuckDB-WASM is browser-only here)",
    };
  }
  try {
    await import("@duckdb/duckdb-wasm");
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: "DuckDB-WASM module found; Spatial boot + file export is next wire. MemoryStore active.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "wasm import failed";
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: `DuckDB-WASM unavailable — MemoryStore. ${msg}`,
    };
  }
}
