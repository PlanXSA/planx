# Plan X

Nucleus of an open-source urban-planning workbench.

**Slice 1 (this commit):** TypeScript contracts, DuckDB DDL, in-memory store that proves atomic `apply` (reject writes nothing), and `put` for OSM/base import.

Live spatial store in production path: DuckDB Spatial (`sql/schema.sql`).  
Map / Terra Draw / OSM fetch: later slices.

See `ARCHITECTURE.md` for the slice map and layer diagram.

## Spec

- Contracts: Feature / Street / Parcel, three surfaces, `put` vs `apply`
- OSM: streets and amenities only; buildings are not parcels

## Run

```bash
npm install
npm test
```

## GitHub

Account: [PlanXSA](https://github.com/PlanXSA). Create repo `planx` if the connector cannot. Then push this tree.

## License

MIT intended, not activated.
