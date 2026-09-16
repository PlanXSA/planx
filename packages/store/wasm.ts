import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { DuckStore, type SqlExec } from "./duck.ts";
import { INDEX_SQL, SCHEMA_SQL } from "./schema-sql.ts";
import { MemoryStore } from "./memory.ts";
import type { Store } from "./types.ts";

type Booted = { store: Store; engine: "memory" | "duckdb"; note: string };

function splitSql(src: string): string[] {
  return src
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function arrowToRows(table: { toArray: () => Record<string, unknown>[] }): Record<string, unknown>[] {
  return table.toArray().map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v != null && typeof v === "object" && "toString" in v && typeof (v as { toString: () => string }).toString === "function") {
        const s = String(v);
        out[k] = s;
      } else {
        out[k] = v as unknown;
      }
    }
    return out;
  });
}

export async function bootDuckStore(): Promise<Booted> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  const db: AsyncDuckDB = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  const conn0 = await db.connect();
  try {
    await conn0.query("INSTALL spatial; LOAD spatial;");
    await conn0.query("SELECT ST_AsText(ST_Point(46.6, 24.7));");
  } finally {
    await conn0.close();
  }

  const exec: SqlExec = async (sql, args = []) => {
    const conn: AsyncDuckDBConnection = await db.connect();
    try {
      if (!args.length) {
        const table = await conn.query(sql);
        return arrowToRows(table as unknown as { toArray: () => Record<string, unknown>[] });
      }
      const stmt = await conn.prepare(sql);
      const table = await stmt.query(...args);
      await stmt.close();
      return arrowToRows(table as unknown as { toArray: () => Record<string, unknown>[] });
    } finally {
      await conn.close();
    }
  };

  for (const stmt of splitSql(SCHEMA_SQL)) {
    try {
      await exec(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(msg)) throw err;
    }
  }
  for (const stmt of splitSql(INDEX_SQL)) {
    try {
      await exec(stmt);
    } catch {
      /* RTREE may be missing; column indexes are enough for v0 */
    }
  }

  const probe = await exec("SELECT ST_AsGeoJSON(ST_SetSRID(ST_Point(46.6, 24.7), 4326)) AS g");
  if (!probe[0]) throw new Error("spatial probe returned no row");

  return {
    store: new DuckStore(exec),
    engine: "duckdb",
    note: "DuckDB-WASM Spatial جاهز. الأمتار ما زالت تُشتق في TypeScript عند apply. القص المكاني عبر ST_Intersects.",
  };
}

export async function bootStoreWithFallback(): Promise<Booted> {
  if (typeof window === "undefined") {
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: "MemoryStore (no window — DuckDB-WASM is browser-only here)",
    };
  }
  try {
    return await bootDuckStore();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "wasm/spatial failed";
    return {
      store: new MemoryStore(),
      engine: "memory",
      note: `DuckDB-WASM Spatial فشل — MemoryStore. ${msg}`,
    };
  }
}
