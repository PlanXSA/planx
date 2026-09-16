import { MemoryStore } from "./memory.ts";
import type { Store } from "./types.ts";
import { bootStoreWithFallback } from "./wasm.ts";

export interface Runtime {
  store: Store;
  engine: "memory" | "duckdb";
  note: string;
}

/**
 * Slice 1c: instantiate DuckDB-WASM + spatial in the browser.
 * Any failure keeps MemoryStore and a visible note.
 */
export async function bootStore(): Promise<Runtime> {
  try {
    return await bootStoreWithFallback();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "boot failed";
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: `boot fallback MemoryStore. ${msg}`,
    };
  }
}
