# Plan X — سجل التعديلات

آخر مزامنة: 2026-09-16.

## 2026-09-16 — نواة الحسابات والمخزن المكاني والواجهة

### قرارات ورشة (ليست كوداً فقط)

- المنتج نظام عمل لمخطط، لا رسّام ويندوز.
- هوية محلية على `projects` (اسم، جهة، مدينة، عنوان). لا تسجيل دخول في v0.
- ننسخ آلية ArcGIS Pro (مرجع واحد، طوبولوجيا عند الكتابة، قواعد خصائص، تعارض ظاهر) لا المنتج (نسيج قطع، إصدارات، مرافق).
- الاستعمال قاموس مفتوح (`use_defs`) يكتبه أحمد.

ملفات القرار: `docs-measures.md`, `docs-model.md`, `docs-expert-prompt.md`, `docs-expert-prompt-guide.md`, `docs-expert-review-20260916.md`.

### مخطط القاعدة — `sql/schema.sql`

أُضيف إلى `projects`: `title`, `planner_name`, `org_name`, `city_name`.

أُضيف إلى `features`:

| عمود | وظيفة |
|---|---|
| `length_m` | طول الشارع/المسار |
| `area_m2` | مساحة القطعة/الأخضر |
| `frontage_m` | واجهة القطعة |
| `measure_epsg` | مسقط الأمتار (مثل 32638) |
| `measure_at` | لحظة الاشتقاق |

أُضيف جدول `use_defs` (مفتاح المشروع + key، حد أدنى مساحة، لون، فرضيات لاحقة).

قيود: الأمتار ≥ 0 أو NULL.

نسخة المتصفح المبسّطة (بدون CHECK SRID / UUID أصلي): `packages/store/schema-sql.ts`.

### أنواع TypeScript — `packages/schema/index.ts`

- حقول الأمتار على `Feature`.
- `UseDef`.
- هوية على `Project`.
- سبب رفض جديد: `too_short`.

### محرك الإحداثيات — `packages/geo/crs.ts`

- `utmEpsgFromLon` / `utmZoneFromLon`.
- تحويل WGS84 → UTM والعكس (`lonLatToUtm`, `utmToLonLat`).
- `epsgForGeom` من أول رأس.

اختبار مثبت: ضلع 0.001° عند (46.6, 24.7) ≈ 101.186 م؛ مربع 100×100 م UTM ≈ 10 000 م².

### محركات الاشتقاق

| ملف | التعديل |
|---|---|
| `engines/parcel.ts` | shoelace على مستوي UTM لا على خط طول مطلق (كان يضخّم المساحة ≈ 7٪) |
| `engines/street.ts` | مجموع الأضلاع على UTM |
| `engines/measure.ts` | يملأ الأعمدة، لا يكرر الرقم في `props`؛ `minAreaFor`؛ `streetTooShort` |
| `engines/draft.ts` | بلا تغيير عقد: يغلق المضلع/الخط ثم `apply` |

`measure_epsg` لم يعد 0. إن وُجد المسقط يُكتب رقمه.

### المخزن

| ملف | التعديل |
|---|---|
| `store/memory.ts` | `applyMeasures` + `use_defs` + رفض شارع قصير + حد مساحة من القاموس |
| `store/duck.ts` | نفس سلسلة القياس؛ `ST_SetSRID(..., 4326)`؛ قراءة أعمدة الأمتار |
| `store/sql.ts` | upsert يمرّر أعمدة الأمتار؛ GeoJSON مع SetSRID |
| `store/wasm.ts` | إقلاع DuckDB-WASM + INSTALL/LOAD spatial + مخطط + probe |
| `store/runtime.ts` | المتصفح يحاول WASM؛ الفشل → MemoryStore ونص ظاهر |
| `store/snapshot.ts` | لقطة JSON كما هي |
| `store/memory.test.ts` | مساحة على الصف لا في props؛ طول الشارع؛ مفتاح استعمال غائب ينجح؛ villa 200 م² ترفض |

`scripts/check.mts` يغطي الإغلاق، OSM، UTM، القاموس، اللقطة، إقلاع Node = memory.

### الواجهة — `apps/web`

- جدول من الأعمدة المخزّنة (مساحة، واجهة، طول، EPSG) لا من `props`.
- مجموع قطع/شبكة.
- تصدير CSV.
- HUD: λ/φ وشرق/شمال UTM.
- طبقات قابلة للإغلاق.
- حد أوضح للمضلع المغلق + تسمية بالمتر بعد `apply`.
- معاينة مترية للمسودة قبل الالتزام.
- مقياس متري على الخريطة.

### وثائق محدّثة في الجولة الأخيرة

- `README.md` — تشغيل وتوصيف الحالة الحالية.
- `ARCHITECTURE.md` — شرائح 1c/1d موصولة.
- `AGENTS.md` — check لا test وحده؛ قفل الأمتار وWASM.
- `docs-measures.md` — UTM حي.
- `docs-duckdb-wasm.md` — ماذا يفعل Spatial وما لا يفعله.

### لم يُغيَّر عمداً

- لا حساب سحابي / لا OPFS / لا PostGIS.
- لا نسيج قطع Esri.
- الحفظ ملف JSON لا `.duckdb` ثنائي.
- Overpass قد يرجع 504؛ ليس إصلاح مخزن.
- GitHub: الدفع بعد الاعتماد؛ الموصل بلا كتابة.
