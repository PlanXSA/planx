# Plan X — النموذج البياني (آلية ArcGIS Pro لا المنتج)

تاريخ: 2026-09-16.
المرجع: Geodatabase + Topology + Parcel Fabric في ArcGIS Pro.
القرار: ننسخ العلاقات والقواعد. لا ننسخ الطبقات المؤسسية ولا الإصدارات ولا شبكة الضبط ولا المرافق.

---

## 1. لماذا لا نستنسخ المنتج كاملاً

ArcGIS Pro يحزم: قاعدة مؤسسية، versioning، نسيج قطع قانوني (سجل صك + نقاط + خطوط COGO + Adjustment)، utility network، raster، scene، بوابة نشر.

نسخ هذا فوق DuckDB ملف واحد = إعادة بناء Esri. يكسر قيد المصدر المفتوح ومستخدم واحد والنواة.

ما نستنسخه هو **آلية العمل**:

| آلية ArcGIS Pro | المكافئ في Plan X | v0 |
|---|---|---|
| Feature Dataset (مرجع واحد لمجموعة طبقات) | `projects` + `utm_epsg` + `boundary` | نعم |
| Feature Class هندسة موحّدة | صف في `features` مع `kind` | نعم — جدول واحد لا عشر طبقات |
| Subtype / Domain | عمود `use` + جدول `use_defs` مفتوح | قاموس لا قائمة مغلقة |
| Geodatabase topology rules | جدول `topo_rules` + `apply` يرفض أو يكتب `conflicts` | نواة: قواعد ثابتة. لاحقاً قابلة للتوسيع |
| Parcel Fabric: مضلع + خط حدود + نقطة ركن | القطعة مضلع الآن؛ الخط والنقطة اشتقاق داخلي في `props` ثم جداول عند الحاجة | مضلع أولاً |
| Attribute rules (حد أدنى مساحة…) | `codepack` + `code_status` | بعد ثبات الأمتار |
| Records (صك / معاملة) | خارج v0 | لا |
| Versioning / branch | `surface`: base / project / snapshot | بديل رخيص لملف واحد |
| Dirty areas + Error Inspector | `conflicts` + شريط تعارض ظاهر | نعم مبسّط |
| Relationship class | مفاتيح: `project_id`، جيران في `props` ثم جدول `adjacencies` | لاحقاً |
| Map / Layout | واجهة MapLibre + تصدير جدول/GeoJSON | ليس MXD |

طبقة واحدة متعددة الأنواع (`kind`) أرخص من Feature Class لكل نوع ما دام الاستعلام بـ `kind` و`use`. هذا انحراف واعٍ عن Esri لا نقص فهم.

---

## 2. النموذج المستهدف (ER للنواة وما يليها مباشرة)

```
projects 1──* features
projects 1──* conflicts
projects 1──* use_defs
projects 0──1 codepacks 1──* code_rules
features 0──* conflicts          (عبر feature_ids)
features.kind يحدّد أي أعمدة قياس تُملأ
use_defs.key = features.use      (غياب المفتاح لا يفشل الصف)
```

### 2.1 `projects` — مكافئ Feature Dataset + هوية محلية

| حقل | دور |
|---|---|
| id | مفتاح المشروع / الملف |
| title, planner_name, org_name, city_name | هوية بلا سيرفر |
| boundary | نطاق العمل 4326 |
| phase | مرحلة الورشة |
| utm_epsg | مسقط الأمتار يُقفل عند الإنشاء |
| codepack_id | حزمة قواعد اختيارية |

### 2.2 `features` — مكافئ كل Feature Classes في جدول واحد

هندسة + نوع + استعمال + مصدر + أمتار مخزّنة.

| kind | هندسة متوقعة | أمتار |
|---|---|---|
| street, path, utility | LineString | length_m |
| parcel, green | Polygon مغلق | area_m2، frontage_m للقطعة |
| amenity | Point | لا أمتار إلزامية |
| other | أي | حسب الحاجة |

`surface`: base مخزون مستورد، project رسم أحمد، snapshot تجميد.

`source`: osm | balady | planx | user. إعادة الاستيراد لا تمسح `user`.

### 2.3 `use_defs` — مكافئ Domain + Subtype المفتوح

أحمد ينشئ نوع استعمال ويضع قواعده. ليس قائمة مغلقة.

| حقل | دور |
|---|---|
| project_id, key | مفتاح منطقي |
| label, color | واجهة |
| default_height_m, default_coverage | فرضيات لاحقاً |
| min_area_m2 | يغذّي `below_min_area` بدل الثابت 1 م² |

### 2.4 `topo_rules` — مكافئ قواعد الطوبولوجيا لا محرّك Esri

قواعد النواة المضمّنة (لا تُحذف):

1. مضلع القطعة لا يتقاطع مع نفسه.
2. مضلع القطعة مغلق و≥ 4 رؤوس.
3. قطعتان على `project` لا تتداخلان إلا إذا سمح نوع الاستعمال لاحقاً.
4. خط الشارع بدون نهايات معلقة في شبكة المشروع — تحذير في v0 لا رفض (Must Not Have Dangles مؤجّل كرفض).
5. حدود القطعة يجب أن تطابق خط شارع أو قطعة مجاورة ضمن سماحية — بعد محرك الجوار.

 ArcGIS Parcel Fabric يفرض أيضاً: الخط يغطي حدود المضلع، والنقطة تغطي نهاية الخط. في Plan X هذه تُشتق من المضلع حتى نحتاج تحرير ضلع مستقل.

### 2.5 `conflicts` — مكافئ Error Inspector

تعارض مصدرين أو تداخل هندسي. ظاهر. لا حذف صامت.

### 2.6 `codepacks` / `code_rules` — مكافئ Attribute Rules

بعد ثبات الأعمدة المترية. `gte` / `lte` / `eq` على حقل مخزن. الناتج `code_status`.

### 2.7 مؤجّل عن عمد (موجود في Pro، ليس في النواة)

- نقاط الأركان وخطوط الحدود كصفوف مستقلة (Parcel Fabric الكامل)
- COGO وأبعاد الصك
- Adjustment network
- Utility network
- Raster / Terrain / Scene
- Versioning متعدد المستخدمين
- Relationship classes الغنية
- Annotation / dimension feature class

---

## 3. مسار التحسين إذا احتجنا ما في Pro لاحقاً

الترتيب الوحيد المسموح:

1. أعمدة الأمتار تُملأ من المحرك (العقد الحالي).
2. `use_defs` في نفس الملف.
3. رفض الطوبولوجيا في `apply` + صف `conflicts`.
4. جيران ومحيط مشترك.
5. إن ثبت أن تحرير الضلع مستقل عن المضلع ضروري: نُخرج `parcel_edges` و`parcel_nodes` كجداول مشتقة، لا كطبقات Esri من اليوم الأول.

كل قفزة تتخطى 1–3 تُرفض في الورشة.

---

## 4. جملة القفل

Plan X قاعدة مشروع واحدة، معلم واحد متعدد الأنواع، استعمال مفتوح، أمتار على الصف، طوبولوجيا عند الكتابة، تعارض ظاهر، لقطة بدل الإصدار المؤسسي.

هذا هو استنساخ **آلية** ArcGIS Pro بحجم ملف يعمل في المتصفح.
