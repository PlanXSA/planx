# Plan X

منصة عمل مكانية للتخطيط العمراني.

المحرر يحدّد نطاقاً، يحمّل أساساً من مخزون منسّق، يرسم شبكة وقطعاً، ويحصل على جداول مشتقة ولوحات وتصدير من المصدر نفسه.

| الحالة | نواة قيد التوصيف |
| الترخيص المقترح | MIT (غير مثبّت) |
| الجمهور | مهندسو البرمجيات |
| قيد التكلفة | مكدس مفتوح المصدر فقط |
| مراجعة خارجية | 2026-09-15 |

الواجهات في هذا الملف عقود. اختيار المكتبات قابل للاستبدال ما دامت العقود محفوظة.

---

## 1. المشكلة

أدوات الرسم لا تنتج سجلاً مساحياً موثوقاً. منصات الخرائط لا تُنشئ قطعاً وحرم شوارع وجيراناً لحظة الرسم. تكرار الجلب من OSM أو المصدر الرسمي لكل مشروع يضاعف التكلفة ويفكك الأرقام بين اللوحة والجدول.

Plan X يوحّد التخزين والاشتقاق والإخراج.

## 2. المتطلبات غير الوظيفية

- مصدر حقيقة واحد: المخزن المكاني.
- لا حساب طولي أو مساحي في طبقة العرض.
- القص من مخزون قائم يسبق الجلب الشبكي.
- عند التعارض: المصدر الرسمي يغلب المفتوح، ويُحتفظ بسجل التعارض.
- `use` عمود على السجل. ليس وحدة ولا شاشة.
- `apply(patches)` ذري لكل ضغطة رسم: طوبولوجيا + كتابة + اشتقاق تنجح معاً أو تُرفض معاً.
- v0 مستخدم واحد. لا قفل متعدد. لا تاريخ على صف `Feature`.

## 3. خارج النطاق (بما فيه مؤجّل بعد v0)

- توثيق معماري تفصيلي
- توليد قياسات عبر نموذج لغوي
- خرائط أساس مدفوعة
- محاكاة مرور
- تعدد مستخدمين وPostGIS
- محرك `mass`
- DXF / Shapefile و`theme` كامل
- حقل `system[]` حتى تُنفَّذ اللوحة

## 4. المعمارية

```
adapters → store ←→ engines → app
```

- المحوّل يكتب في المخزن فقط.
- الرسم يمرّ: `topology` ثم `apply` (لا `put` منفرد يكسر السلسلة).
- المحرك يعيد `Patch[]` أو `Reject`.
- الواجهة: `Store.query` و`Engine.run` فقط.

## 5. المرجع الإحداثي

| العملية | النظام |
|---|---|
| تخزين وتبادل | `EPSG:4326` |
| تجانب العرض | `EPSG:3857` |
| طول، مساحة، عرض، واجهة، حرم | جيوديسي أو مسقط متري محلي — ليس 3857 |

`z` اختياري على الرأس.

## 6. النموذج

### Feature

```ts
type FeatureKind =
  | "street" | "parcel" | "amenity"
  | "path" | "green" | "utility" | "other";

type Source = "osm" | "balady" | "planx" | "user";
type CodeStatus = "ok" | "violate" | "unknown";

interface Feature {
  id: string;
  project_id: string;
  geom: GeoJSON.Geometry;
  kind: FeatureKind;
  use?: string;
  source: Source;
  source_ref?: string;
  confidence?: number;
  code_status: CodeStatus;
  props: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

- `id` ثابت.
- تغيير `geom` يعيد اشتقاق `kind`.
- غياب `use` عن القاموس لا يُفشل السجل.
- لا `version` ولا `actor` على الصف في v0.

### Street

```ts
interface StreetProps {
  width_m: number;
  section_id?: string;
  length_m: number;
  row_geom?: GeoJSON.Polygon;
  connected_street_ids?: string[];
}
```

### Parcel

```ts
type Cardinal = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

interface Vertex { i: number; x: number; y: number; z?: number }
interface Edge { i: number; length_m: number; bearing_deg: number }
interface Neighbor {
  parcel_id: string;
  direction: Cardinal;
  shared_length_m: number;
}

interface ParcelProps {
  seq_no: number;
  area_m2: number;
  vertices: Vertex[];
  edges: Edge[];
  frontage_m?: number;
  street_id?: string;
  neighbors: Neighbor[];
  height_m?: number;
  coverage_ratio?: number;
}
```

### UseDef

```ts
interface UseDef {
  key: string;
  label: string;
  color?: string;
  default_height_m?: number;
  default_coverage?: number;
}
```

### Project وCodepack

```ts
type Phase =
  | "select" | "import" | "reconcile" | "code"
  | "draw" | "classify" | "schedule" | "check" | "export";

interface Project {
  id: string;
  boundary: GeoJSON.Polygon;
  phase: Phase;
  codepack_id?: string;
}

interface CodeRule {
  id: string;
  applies_to: FeatureKind | "any";
  field: string;
  op: "gte" | "lte" | "eq";
  value: number | string;
}

interface Codepack {
  id: string;
  label: string;
  rules: CodeRule[];
}
```

## 7. المخزن

| سطح | المحتوى | كتابة المحرر |
|---|---|---|
| `base` | مخزون مستورد | لا إلا استيراد واعٍ |
| `project` | رسوم المشروع | نعم |
| `snapshot` | إصدار مُقفل | لا |

محرّك v0: DuckDB Spatial أو GeoPackage فقط.

```
get / put / delete / query / slice
apply(patches)  // ذري
```

إعادة القص: معالم `source=user` تبقى. شريحة `base` تُحدَّث. التداخل يُخرج `Conflict` ولا يحذف رسم المستخدم.

## 8. المحركات

| الاسم | v0 |
|---|---|
| `clip` `reconcile` `topology` `street_row` `parcel_derive` `schedule` `check` `dashboard` | نعم |
| `theme` `mass` | بعد v0 |

```ts
interface Patch { op: "upsert" | "delete"; feature: Feature }

interface Conflict {
  feature_ids: string[];
  field: string;
  values: unknown[];
  winner?: string;
}

type RejectReason =
  | "self_intersection"
  | "overlap_parcel"
  | "unclosed"
  | "below_min_area";

interface Reject {
  ok: false;
  reason: RejectReason;
  message: string;
}

interface PlanSpec {
  scale: string;
  filter: { kind?: FeatureKind; use?: string };
  legend: boolean;
  table: boolean;
}
```

عند `Reject`: لا كتابة. الرسالة تُعرض على المؤشر.

## 9. مسار v0

```
boundary → clip ∪ fetch gaps → reconcile
  → draw street → topology → apply(street_row)
  → draw parcel → topology → apply(parcel_derive)
  → set use → schedule → check
  → export GeoJSON + CSV
```

## 10. الإخراج

| المخرج | المرحلة |
|---|---|
| GeoJSON + CSV | v0 |
| GeoPackage تصدير فقط | v0 مسموح كملف تبادل لا كمخزن حي |
| DXF / SHP / لوحة `PlanSpec` | بعد v0 |

## 11. مكدس v0 (مُثبَّت بعد مراجعة المكدس)

| طبقة | اختيار |
|---|---|
| خريطة | MapLibre GL JS |
| أساس | PMTiles |
| رسم | Terra Draw |
| معاينة هندسية في العرض فقط | Turf.js — لا يُكتب `area_m2` / `length_m` منه |
| مخزن حي | DuckDB Spatial فقط |
| قياس متري | مسقط UTM لمنطقة المشروع (وسط الحدود). السعودية: 36N–39N |
| بناء واختبار | Vite + TypeScript + Vitest |

ثوابت v0 بعد فجوات المراجع:

- سماحية التقاط: `0.01` م في فضاء UTM
- حرم الشارع = محور + عرض. المحور قد ينحني. شكل نهاية المقطع لا يُغلق الآن
- منطقة UTM: منطقة وسط مضلع المشروع. عبور منطقتين = قيد معروف في v0 لا يُحل الآن

## 12. التنفيذ

1. `model` + `store` + `slice` + `apply`
2. رسم + `topology` + `street_row` + `parcel_derive`
3. `use` + `schedule` + `Codepack` أدنى + `check`
4. تصدير GeoJSON وCSV

## 13. البيانات والترخيص

OSM: ODbL. بلدي وGEOSA: شروط المصدر. الشيفرة: MIT مرشّح غير مفعّل.

## 14. قرارات مراجعة 2026-09-15

| ملاحظة | القرار |
|---|---|
| تاريخ على صف Feature | رفض لـ v0 |
| `Neighbor.direction` | اعتماد `Cardinal` |
| إعادة قص base مقابل project | رسم المستخدم يبقى + Conflict |
| ذرية apply | اعتماد |
| مخطط Codepack | اعتماد أدنى |
| نوع theme | PlanSpec مؤجّل التنفيذ |
| رفض الطوبولوجيا | اعتماد Reject |
| قفل متعدد المستخدمين | رفض لـ v0 |
| إسقاط PostGIS من التصميم الموازي | اعتماد |
| تأجيل mass وsystem[] وDXF/SHP | اعتماد |

## 15. قرارات مراجعة المكدس والدليل العميق

| بند | القرار |
|---|---|
| DuckDB بدل GeoPackage مخزناً حياً | اعتماد |
| Turf معاينة فقط | اعتماد |
| UTM حسب وسط الحدود | اعتماد |
| Vite / TS / Vitest | اعتماد |
| سماحية التقاط | `0.01` م |
| غطاء نهاية الحرم | مرفوض كقرار v0. الحرم يتبع المحور المنحني |
| عبور منطقتي UTM | قيد v0، لا حل إضافي |
| خط أنابيب بناء بلاط PMTiles | فجوة تشغيل لاحق، ليس شرط إطلاق النواة |
