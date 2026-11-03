import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(ROOT, "src/data/slides-manifest.json");
const OUTPUT_PATH = path.join(PUBLIC_DIR, "SkillSync_AI_Pitch_Deck.pptx");
const LIVE_URL = "https://skill-sync-ai--zeintabakha443t.replit.app";

const C = {
  forest: "162E24",
  forestMid: "1F4A38",
  ivory: "F8F6F1",
  white: "FFFFFF",
  terracotta: "C85A32",
  terracottaLight: "E07A5F",
  muted: "627267",
  line: "DDE4DC",
  paleGreen: "E8EEE8",
  paleSand: "F2EADF",
  darkMuted: "B8C7BD",
};

const W = 13.333333;
const H = 7.5;
const FONT_HEAD = "Cairo";
const FONT_BODY = "Tajawal";
const pptx = new PptxGenJS();
const TRANSITIONS = [
  { speed: "slow", xml: "<p:fade/>" },
  { speed: "med", xml: '<p:push dir="r"/>' },
  { speed: "fast", xml: '<p:wipe dir="r"/>' },
  { speed: "med", xml: '<p:split orient="vert" dir="out"/>' },
  { speed: "med", xml: '<p:wheel spokes="4"/>' },
  { speed: "fast", xml: '<p:zoom dir="in"/>' },
  { speed: "med", xml: '<p:push dir="l"/>' },
  { speed: "med", xml: '<p:cover dir="r"/>' },
  { speed: "fast", xml: "<p:dissolve/>" },
  { speed: "slow", xml: "<p:fade/>" },
  { speed: "med", xml: '<p:split orient="horz" dir="in"/>' },
  { speed: "slow", xml: "<p:fade/>" },
];

pptx.defineLayout({ name: "LAYOUT_16x9", width: W, height: H });
pptx.layout = "LAYOUT_16x9";
pptx.rtlMode = true;
pptx.author = "SkillSync AI";
pptx.subject = "عرض تحكيم عربي لمنظومة التعلم التشاركي";
pptx.title = "SkillSync AI — عرض تحكيم عربي";
pptx.company = "SkillSync AI";
pptx.lang = "ar-SA";
pptx.theme = { headFontFace: FONT_HEAD, bodyFontFace: FONT_BODY };

const rect = pptx.ShapeType.rect;
const roundRect = pptx.ShapeType.roundRect;
const ellipse = pptx.ShapeType.ellipse;
const line = pptx.ShapeType.line;

function addText(slide, value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: options.fontFace ?? FONT_BODY,
    fontSize: options.fontSize ?? 16,
    color: options.color ?? C.forest,
    bold: options.bold ?? false,
    align: options.align ?? "right",
    valign: options.valign ?? "mid",
    rtlMode: true,
    margin: options.margin ?? 0,
    breakLine: false,
    fit: "shrink",
    paraSpaceAfterPt: options.paraSpaceAfterPt ?? 0,
    ...options,
  });
}

function addBox(slide, x, y, w, h, fill, options = {}) {
  slide.addShape(options.shape ?? roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.1,
    fill: { color: fill, transparency: options.transparency ?? 0 },
    line: {
      color: options.lineColor ?? fill,
      transparency: options.lineTransparency ?? 0,
      width: options.lineWidth ?? 0.8,
    },
    radius: 0.12,
    ...options.shapeOptions,
  });
}

function addPill(slide, label, x, y, w, options = {}) {
  addBox(slide, x, y, w, options.h ?? 0.38, options.fill ?? C.paleGreen, {
    lineColor: options.lineColor ?? options.fill ?? C.paleGreen,
  });
  addText(slide, label, x + 0.08, y + 0.01, w - 0.16, (options.h ?? 0.38) - 0.02, {
    fontSize: options.fontSize ?? 11,
    bold: true,
    color: options.color ?? C.forestMid,
    align: "center",
  });
}

function addBackground(slide, dark = false) {
  slide.background = { color: dark ? C.forest : C.ivory };
  slide.addShape(rect, {
    x: 0,
    y: 0,
    w: W,
    h: H,
    line: { color: dark ? C.forest : C.ivory, transparency: 100 },
    fill: { color: dark ? C.forest : C.ivory },
  });
  if (dark) {
    slide.addShape(ellipse, {
      x: -1.5,
      y: 4.8,
      w: 5.1,
      h: 5.1,
      line: { color: C.terracotta, transparency: 88, width: 1 },
      fill: { color: C.forest, transparency: 100 },
    });
  }
}

function addHeader(slide, section, title, subtitle, position, dark = false) {
  addText(slide, "SkillSync AI", 10.1, 0.27, 2.55, 0.28, {
    fontFace: FONT_HEAD,
    fontSize: 12,
    bold: true,
    color: dark ? C.ivory : C.forest,
    align: "right",
  });
  addText(slide, section, 0.68, 0.27, 6.5, 0.28, {
    fontSize: 11,
    bold: true,
    color: dark ? C.terracottaLight : C.terracotta,
  });
  addText(slide, title, 0.68, 0.82, 12, 0.6, {
    fontFace: FONT_HEAD,
    fontSize: 27,
    bold: true,
    color: dark ? C.ivory : C.forest,
  });
  if (subtitle) {
    addText(slide, subtitle, 0.68, 1.48, 12, 0.38, {
      fontSize: 14,
      color: dark ? C.darkMuted : C.muted,
    });
  }
  addText(slide, `${String(position).padStart(2, "0")} / 12`, 0.68, 7.1, 1.1, 0.18, {
    fontSize: 9,
    color: dark ? C.darkMuted : C.muted,
    align: "left",
  });
}

function addBase(section, title, subtitle, position, dark = false) {
  const slide = pptx.addSlide();
  addBackground(slide, dark);
  addHeader(slide, section, title, subtitle, position, dark);
  return slide;
}

function cardText(slide, x, y, w, label, body, options = {}) {
  addBox(slide, x, y, w, options.h ?? 1.25, options.fill ?? C.white, {
    lineColor: options.lineColor ?? C.line,
  });
  addText(slide, label, x + 0.16, y + 0.15, w - 0.32, 0.28, {
    fontSize: options.labelSize ?? 12,
    bold: true,
    color: options.labelColor ?? C.terracotta,
  });
  addText(slide, body, x + 0.16, y + 0.49, w - 0.32, (options.h ?? 1.25) - 0.6, {
    fontSize: options.bodySize ?? 15,
    bold: options.bodyBold ?? false,
    color: options.bodyColor ?? C.forest,
  });
}

function renderCover() {
  const slide = pptx.addSlide();
  addBackground(slide, true);
  addText(slide, "SkillSync AI", 10.1, 0.34, 2.55, 0.3, {
    fontFace: FONT_HEAD,
    fontSize: 13,
    bold: true,
    color: C.ivory,
  });
  addText(slide, "عرض لجنة التحكيم · 10 دقائق", 0.68, 0.34, 5.5, 0.3, {
    fontSize: 12,
    bold: true,
    color: C.terracottaLight,
  });

  slide.addShape(ellipse, {
    x: 1.0, y: 1.65, w: 5.15, h: 5.15,
    line: { color: "456354", width: 1.4, transparency: 18 },
    fill: { color: C.forest, transparency: 100 },
  });
  slide.addShape(ellipse, {
    x: 1.65, y: 2.3, w: 3.85, h: 3.85,
    line: { color: C.terracottaLight, width: 1.3, transparency: 18 },
    fill: { color: C.forest, transparency: 100 },
  });
  slide.addShape(ellipse, {
    x: 2.35, y: 3.0, w: 2.45, h: 2.45,
    line: { color: C.terracotta, width: 0.8 },
    fill: { color: C.terracotta },
  });
  addText(slide, "تعلم\nمشترك", 2.58, 3.62, 1.98, 1.05, {
    fontFace: FONT_HEAD, fontSize: 23, bold: true, color: C.white, align: "center",
  });
  addPill(slide, "مهارة أ", 4.15, 2.2, 1.25, {
    fill: C.forestMid, color: C.ivory, lineColor: "587365",
  });
  addPill(slide, "مهارة ب", 1.28, 5.85, 1.25, {
    fill: C.forestMid, color: C.ivory, lineColor: "587365",
  });

  addText(slide, "منظومة الذكاء التشاركي", 7.1, 1.92, 5.55, 0.42, {
    fontSize: 17, bold: true, color: C.terracottaLight,
  });
  addText(slide, "SkillSync AI:", 7.1, 2.62, 5.55, 0.72, {
    fontFace: FONT_HEAD, fontSize: 37, bold: true, color: C.terracottaLight,
  });
  addText(slide, "ثورة التعلم\nالتشاركي", 7.1, 3.42, 5.55, 1.65, {
    fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ivory, valign: "top",
  });
  addText(
    slide,
    "تحويل المعرفة الفردية الساكنة إلى خبرات تطبيقية حية عبر هندسة الذكاء الاصطناعي المتعدد",
    7.1, 5.28, 5.55, 0.84,
    { fontSize: 17, color: C.darkMuted, valign: "top" },
  );
  return slide;
}

function renderProblem() {
  const slide = addBase(
    "المشكلة",
    "معضلة العزلة الأكاديمية",
    "الفجوة ليست في المحتوى، بل في غياب الممارسة التفاعلية.",
    2,
  );
  addText(slide, "73٪*", 7.45, 2.25, 5.15, 1.35, {
    fontFace: FONT_HEAD, fontSize: 58, bold: true, color: C.terracotta,
  });
  addText(slide, "من طلاب الجامعة يفتقرون إلى بيئة تفاعلية لممارسة المهارات مع أقرانهم خارج المحاضرات", 7.45, 3.62, 5.15, 0.95, {
    fontSize: 18, bold: true, color: C.forest,
  });
  addText(slide, "مستهدف أولي للمشروع؛ ليس نتيجة قياس أو مسح موثّق.", 7.45, 4.72, 5.15, 0.45, {
    fontSize: 12, color: C.muted,
  });
  addBox(slide, 0.7, 2.2, 5.95, 3.15, C.white, { lineColor: C.line });
  addText(slide, "الفجوة ليست في المحتوى", 1.02, 2.55, 5.25, 0.34, {
    fontSize: 13, bold: true, color: C.terracotta,
  });
  addText(slide, "الفجوة بين المعرفة والتطبيق", 1.02, 3.05, 5.25, 0.62, {
    fontFace: FONT_HEAD, fontSize: 22, bold: true,
  });
  addText(slide, "يتعلم الطالب منفرداً، ثم يبحث عن شريك يشرح له ما لا يعرفه ويختبر معه ما يعرفه بالفعل.", 1.02, 3.86, 5.25, 0.88, {
    fontSize: 16,
  });
  addPill(slide, "شرح متبادل", 4.52, 4.85, 1.45);
  addPill(slide, "ممارسة واقعية", 2.8, 4.85, 1.55);
  addPill(slide, "تغذية راجعة", 1.12, 4.85, 1.5);
  return slide;
}

function renderMatching() {
  const slide = addBase("الحل", "مبدأ تبادل المهارات المتكافئ", "مطابقة تكاملية تحوّل اختلاف المهارات إلى خطة تعلم مشتركة.", 3);
  addBox(slide, 8.45, 2.25, 3.95, 3.55, C.white, { lineColor: C.line });
  addText(slide, "المتعلم أ", 8.78, 2.55, 3.3, 0.36, { fontSize: 17, bold: true });
  addText(slide, "يعرف البرمجة", 8.78, 3.1, 3.3, 0.4, { fontSize: 17 });
  addPill(slide, "يشارك · Code", 8.78, 3.75, 2.25, { fill: C.paleGreen });
  addText(slide, "يريد تعلم", 8.78, 4.38, 3.3, 0.28, { fontSize: 12, color: C.muted });
  addPill(slide, "Product Design", 8.78, 4.78, 2.5, { fill: C.paleSand, color: C.terracotta });

  addBox(slide, 0.92, 2.25, 3.95, 3.55, C.white, { lineColor: C.line });
  addText(slide, "المتعلم ب", 1.25, 2.55, 3.3, 0.36, { fontSize: 17, bold: true });
  addText(slide, "يعرف التصميم", 1.25, 3.1, 3.3, 0.4, { fontSize: 17 });
  addPill(slide, "يشارك · Product Design", 1.25, 3.75, 3.15, { fill: C.paleGreen });
  addText(slide, "يريد تعلم", 1.25, 4.38, 3.3, 0.28, { fontSize: 12, color: C.muted });
  addPill(slide, "Code", 1.25, 4.78, 1.35, { fill: C.paleSand, color: C.terracotta });

  addBox(slide, 5.15, 3.16, 2.95, 1.55, C.forestMid);
  addText(slide, "↔", 5.45, 3.25, 2.35, 0.46, { fontFace: FONT_HEAD, fontSize: 26, color: C.terracottaLight, bold: true, align: "center" });
  addText(slide, "مطابقة تكاملية", 5.38, 3.88, 2.5, 0.42, { fontSize: 15, bold: true, color: C.white, align: "center" });
  addBox(slide, 1.3, 6.02, 10.7, 0.55, C.paleGreen, { lineColor: C.paleGreen });
  addText(slide, "غرفة ثنائية اللغة     •     خطة تعلم مشتركة     •     مساعد SkillSync AI عند الطلب", 1.55, 6.13, 10.2, 0.28, { fontSize: 13, bold: true, align: "center" });
  return slide;
}

function renderArchitecture() {
  const slide = addBase("المعمارية", "معمارية الصمود والذكاء الهجين", "مسار موحّد للطلب، واختيار تلقائي لنموذج بديل عند تعذّر النموذج الحالي.", 4, true);
  const nodes = [
    { x: 9.22, title: "طلب الطالب", body: "محادثة أو نشاط تعليمي" },
    { x: 5.05, title: "موجّه النماذج", body: "اختيار المسار الأساسي والبديل" },
    { x: 0.88, title: "إجابة أو انتقال احتياطي", body: "استجابة موحّدة للواجهة" },
  ];
  for (const node of nodes) {
    addBox(slide, node.x, 3.05, 3.2, 1.7, C.forestMid, { lineColor: "5B7667" });
    addText(slide, node.title, node.x + 0.2, 3.38, 2.8, 0.4, { fontSize: 17, bold: true, color: C.ivory, align: "center" });
    addText(slide, node.body, node.x + 0.2, 3.92, 2.8, 0.5, { fontSize: 12, color: C.darkMuted, align: "center" });
  }
  addText(slide, "←", 8.0, 3.57, 0.9, 0.5, { fontSize: 26, bold: true, color: C.terracottaLight, align: "center" });
  addText(slide, "←", 3.82, 3.57, 0.9, 0.5, { fontSize: 26, bold: true, color: C.terracottaLight, align: "center" });
  addBox(slide, 2.1, 5.4, 9.2, 0.7, "244D3C", { lineColor: "496A59" });
  addText(slide, "الهدف: تقليل أثر تعذّر مزوّد واحد، لا ضمان توافر مطلق.", 2.35, 5.57, 8.7, 0.36, { fontSize: 14, color: C.ivory, align: "center" });
  return slide;
}

function renderModels() {
  const slide = addBase("التعافي التلقائي", "تناوب النماذج الأربعة دون انقطاع", "ترتيب احتياطي ينتقل تلقائياً عند حدود الاستخدام أو فشل الاستجابة.", 5);
  const models = [
    ["01", "openai/gpt-oss-20b", "المسار الأساسي · سرعة الاستجابة"],
    ["02", "openai/gpt-oss-120b", "استدلال أعمق"],
    ["03", "qwen/qwen3.8-27b", "تنظيم المنطق والمخرجات"],
    ["04", "allam-2-7b", "دعم عربي"],
  ];
  models.forEach(([number, model, detail], i) => {
    const x = 0.68 + i * 3.12;
    addBox(slide, x, 2.55, 2.78, 2.65, i === 0 ? C.forestMid : C.white, {
      lineColor: i === 0 ? C.forestMid : C.line,
    });
    addText(slide, number, x + 0.2, 2.8, 2.35, 0.42, { fontFace: FONT_HEAD, fontSize: 24, bold: true, color: C.terracotta, align: "center" });
    addText(slide, model, x + 0.2, 3.45, 2.35, 0.68, {
      fontFace: FONT_HEAD, fontSize: 14, bold: true,
      color: i === 0 ? C.white : C.forest, align: "center",
    });
    addText(slide, detail, x + 0.2, 4.34, 2.35, 0.52, {
      fontSize: 12, color: i === 0 ? C.darkMuted : C.muted, align: "center",
    });
  });
  addText(slide, "تتطلب أزمنة الانتقال ومعدلات النجاح قياساً مستمراً.", 0.95, 5.85, 11.4, 0.42, { fontSize: 13, color: C.muted, align: "center" });
  return slide;
}

function renderSimulator() {
  const slide = addBase("المحاكي التفاعلي", "محاكي الأكواد التفاعلي الحي", "من وصف المهمة إلى تطبيق مرئي قابل للتعديل والتشغيل.", 6);
  addBox(slide, 6.45, 2.25, 6.0, 3.92, "162E24", { lineColor: "162E24" });
  addText(slide, "solution.js  ·  محرر الحل", 6.8, 2.5, 5.3, 0.34, { fontSize: 13, bold: true, color: C.ivory });
  addText(slide, "function calculateProgress(done, total) {", 6.8, 3.02, 5.3, 0.32, { fontFace: "Arial", fontSize: 12, color: "A7D9BA", align: "left" });
  addText(slide, "  if (total === 0) return 0;", 6.8, 3.47, 5.3, 0.32, { fontFace: "Arial", fontSize: 12, color: C.terracottaLight, align: "left" });
  addText(slide, "  return Math.round((done / total) * 100);", 6.8, 3.92, 5.3, 0.32, { fontFace: "Arial", fontSize: 12, color: "A7D9BA", align: "left" });
  addText(slide, "}", 6.8, 4.37, 5.3, 0.32, { fontFace: "Arial", fontSize: 12, color: C.terracottaLight, align: "left" });
  addPill(slide, "تعديل مباشر", 9.98, 5.43, 1.85, { fill: "294C3B", color: C.ivory });
  addBox(slide, 0.88, 2.25, 5.0, 3.92, C.white, { lineColor: C.line });
  addText(slide, "معاينة DOM معزولة", 1.2, 2.62, 4.36, 0.38, { fontSize: 15, bold: true });
  addBox(slide, 1.38, 3.35, 4.0, 1.6, C.paleGreen, { lineColor: "C8D7CB" });
  addText(slide, "تقدم التعلم", 1.65, 3.62, 3.45, 0.3, { fontSize: 13, bold: true });
  addText(slide, "75٪", 1.65, 3.99, 3.45, 0.62, { fontFace: FONT_HEAD, fontSize: 31, bold: true, color: C.forestMid });
  addText(slide, "يظهر التطبيق داخل مساحة المعاينة؛ الشبكة الخارجية محظورة.", 1.2, 5.3, 4.36, 0.5, { fontSize: 12, color: C.muted });
  return slide;
}

function renderComparison() {
  const slide = addBase("التجربة", "من المطابقة النصية إلى التشغيل البصري", "التقييم يختبر الفهم؛ والمحاكي يتيح رؤية نتيجة الحل أثناء العمل.", 7);
  addBox(slide, 7.0, 2.3, 5.5, 3.85, C.paleSand, { lineColor: "E4D7C6" });
  addText(slide, "النهج التقليدي", 7.35, 2.65, 4.8, 0.45, { fontFace: FONT_HEAD, fontSize: 20, bold: true });
  const oldItems = ["إجابة ساكنة", "نص أو مخرجات مختصرة", "تصحيح بعد التسليم", "لا واجهة للاختبار التفاعلي"];
  oldItems.forEach((item, i) => addText(slide, `• ${item}`, 7.35, 3.32 + i * 0.55, 4.8, 0.36, { fontSize: 14, color: C.muted }));
  addBox(slide, 0.82, 2.3, 5.5, 3.85, C.forestMid, { lineColor: C.forestMid });
  addText(slide, "SkillSync AI", 1.17, 2.65, 4.8, 0.45, { fontFace: FONT_HEAD, fontSize: 20, bold: true, color: C.white });
  const newItems = ["DOM وCanvas داخل iframe", "تفاعل ونتائج لحظية", "قيود شبكة ووقت ومخرجات", "بيئة تشغيل معزولة"];
  newItems.forEach((item, i) => addText(slide, `✓ ${item}`, 1.17, 3.32 + i * 0.55, 4.8, 0.36, { fontSize: 14, color: C.ivory }));
  return slide;
}

function renderVideo() {
  const slide = addBase("التعلم المباشر", "غرفة الفيديو الذكية ومساعد المكالمة", "اجتماع Jitsi بجوار أدوات التعلم، لا بعيداً عنها.", 8);
  addBox(slide, 6.5, 2.25, 5.95, 3.95, "162E24", { lineColor: "162E24" });
  addText(slide, "meet.jit.si", 6.82, 2.48, 5.3, 0.28, { fontSize: 12, color: C.darkMuted });
  addBox(slide, 6.86, 2.95, 5.2, 2.35, "294C3B", { lineColor: "456354" });
  addText(slide, "غرفة SkillSync AI", 7.25, 3.4, 4.42, 0.45, { fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.white, align: "center" });
  addText(slide, "المتعلم أ     •     المتعلم ب", 7.25, 4.08, 4.42, 0.35, { fontSize: 14, color: C.darkMuted, align: "center" });
  addText(slide, "فيديو وصوت ومشاركة شاشة داخل مساحة التعلم", 6.85, 5.55, 5.2, 0.36, { fontSize: 12, color: C.ivory, align: "center" });

  addBox(slide, 0.88, 2.25, 5.0, 1.4, C.white, { lineColor: C.line });
  addText(slide, "منظم الأدوار", 1.2, 2.48, 2.4, 0.34, { fontSize: 15, bold: true });
  addText(slide, "15:00", 3.76, 2.43, 1.75, 0.5, { fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.terracotta, align: "center" });
  addText(slide, "دورة تدريس ثم تبديل الأدوار", 1.2, 3.02, 4.25, 0.32, { fontSize: 13, color: C.muted });
  addBox(slide, 0.88, 3.92, 5.0, 2.28, C.white, { lineColor: C.line });
  addText(slide, "مساعد المكالمة", 1.2, 4.2, 4.25, 0.36, { fontSize: 15, bold: true });
  addText(slide, "بموافقة المستخدم: تفريغ مقاطع قصيرة من ميكروفون الجهاز، ثم إنشاء تلميح أو ملخص أو اختبار من النص.", 1.2, 4.74, 4.25, 0.95, { fontSize: 13, color: C.muted });
  return slide;
}

function renderChat() {
  const slide = addBase("التواصل المشترك", "تواصل غني بالوسائط والذكاء السياقي", "المحادثة جزء من مساحة التعلم، وترتبط بالخطة والأنشطة.", 9);
  addBox(slide, 7.1, 2.3, 5.3, 3.8, C.white, { lineColor: C.line });
  addText(slide, "محادثة الشريك", 7.42, 2.6, 4.65, 0.36, { fontSize: 14, bold: true });
  addBox(slide, 8.48, 3.2, 3.55, 0.68, C.paleGreen, { lineColor: C.paleGreen });
  addText(slide, "هل نراجع فكرة المشروع معاً؟", 8.68, 3.37, 3.15, 0.28, { fontSize: 13 });
  addBox(slide, 7.42, 4.03, 3.58, 0.68, C.paleSand, { lineColor: C.paleSand });
  addText(slide, "نعم، أرسل لي مثالاً على الواجهة.", 7.62, 4.2, 3.15, 0.28, { fontSize: 13 });
  addText(slide, "▶   ملاحظة صوتية · 0:18", 7.42, 5.12, 4.65, 0.32, { fontSize: 13, color: C.terracotta, bold: true });

  const features = [
    ["ردّ مقتبس", "اربط الإجابة برسالة سابقة بوضوح."],
    ["صوت قابل للتفريغ", "تفريغ عند الطلب وإظهار النص في المحادثة."],
    ["صور خاصة", "ضغط على الجهاز ورفع إلى تخزين خاص."],
  ];
  features.forEach(([label, body], i) => {
    const y = 2.3 + i * 1.27;
    cardText(slide, 0.85, y, 5.55, label, body, { h: 1.05, bodySize: 13 });
  });
  return slide;
}

function renderTargets() {
  const slide = addBase("مقاييس قيد التحقق", "مستهدفات الأداء الهندسي", "قيم طموحة لمتابعة التطوير، وليست نتائج تشغيلية موثقة.", 10);
  const metrics = [
    ["99.9٪", "مستهدف توافر مساعد الذكاء الاصطناعي"],
    ["96٪", "مستهدف دقة تفريغ الصوت العربي"],
    ["85٪", "مستهدف خفض حجم الصورة بعد الضغط"],
    ["100٪", "مستهدف عزل تشغيل المحاكي"],
  ];
  metrics.forEach(([value, label], i) => {
    const x = 0.75 + i * 3.12;
    addBox(slide, x, 2.55, 2.78, 2.75, i % 2 === 0 ? C.white : C.paleGreen, { lineColor: C.line });
    addText(slide, value, x + 0.2, 2.94, 2.35, 0.78, { fontFace: FONT_HEAD, fontSize: 32, bold: true, color: C.terracotta, align: "center" });
    addText(slide, "هدف", x + 0.2, 3.84, 2.35, 0.3, { fontSize: 11, bold: true, color: C.terracotta, align: "center" });
    addText(slide, label, x + 0.2, 4.3, 2.35, 0.62, { fontSize: 13, bold: true, align: "center" });
  });
  addText(slide, "يجب قياس هذه القيم ميدانياً قبل عرضها بوصفها نتائج محققة.", 1.0, 5.75, 11.3, 0.4, { fontSize: 13, color: C.muted, align: "center" });
  return slide;
}

function renderMetrics() {
  const slide = addBase("مواصفات النسخة الحالية", "أرقام تختصر القوة التقنية", "قيم تنفيذية قابلة للتحقق في النظام الحالي.", 11, true);
  const metrics = [
    ["4", "نماذج متسلسلة في مسار الذكاء الاصطناعي"],
    ["4,000", "حد رموز توليد حل المحاكي"],
    ["12,000", "حد أحرف كود الحل"],
    ["15", "دقيقة قبل تبديل دور الشرح"],
  ];
  metrics.forEach(([value, label], i) => {
    const x = 0.75 + i * 3.12;
    addBox(slide, x, 2.7, 2.78, 2.8, "1F4A38", { lineColor: "5B7667" });
    addText(slide, value, x + 0.2, 3.12, 2.35, 0.85, { fontFace: FONT_HEAD, fontSize: value.length > 3 ? 26 : 36, bold: true, color: C.terracottaLight, align: "center" });
    addText(slide, label, x + 0.2, 4.18, 2.35, 0.76, { fontSize: 13, color: C.ivory, align: "center" });
  });
  return slide;
}

function renderFinale() {
  const slide = pptx.addSlide();
  addBackground(slide, true);
  addHeader(slide, "التجربة الحية", "المستقبل لا يُروى نظرياً.. بل يُعاش الآن", "منصة تعلم تشاركي تعمل الآن؛ لننتقل من العرض إلى التجربة.", 12, true);
  addText(slide, "افتح SkillSync AI", 2.15, 3.05, 9.05, 0.62, {
    fontFace: FONT_HEAD, fontSize: 25, bold: true, color: C.white, align: "center",
  });
  slide.addShape(roundRect, {
    x: 4.5, y: 4.05, w: 4.35, h: 0.82,
    rectRadius: 0.16,
    fill: { color: C.terracotta },
    line: { color: C.terracotta, width: 1 },
    hyperlink: { url: LIVE_URL, tooltip: "افتح SkillSync AI" },
  });
  addText(slide, "ابدأ التجربة الحية  ↗", 4.7, 4.23, 3.95, 0.42, {
    fontSize: 18, bold: true, color: C.white, align: "center",
    hyperlink: { url: LIVE_URL, tooltip: "افتح SkillSync AI" },
  });
  addText(slide, LIVE_URL, 2.0, 5.35, 9.35, 0.42, {
    fontFace: "Arial", fontSize: 14, color: C.darkMuted, align: "center",
    hyperlink: { url: LIVE_URL, tooltip: "افتح رابط SkillSync AI" },
    rtlMode: false,
  });
  addText(slide, "المطابقة  ←  غرفة التعلم  ←  المحاكي", 2.2, 6.1, 8.95, 0.36, {
    fontSize: 14, bold: true, color: C.ivory, align: "center",
  });
  return slide;
}

async function embedTransitions() {
  const zip = await JSZip.loadAsync(await fs.readFile(OUTPUT_PATH));

  for (let index = 0; index < TRANSITIONS.length; index += 1) {
    const slidePath = `ppt/slides/slide${index + 1}.xml`;
    const slideFile = zip.file(slidePath);
    if (!slideFile) throw new Error(`Missing PowerPoint slide XML: ${slidePath}`);

    let xml = await slideFile.async("string");
    xml = xml.replace(/<p:transition\b[\s\S]*?<\/p:transition>/g, "");
    const transition = TRANSITIONS[index];
    const transitionXml = `<p:transition spd="${transition.speed}" advClick="1">${transition.xml}</p:transition>`;
    const clrMapEnd = "</p:clrMapOvr>";
    if (!xml.includes(clrMapEnd)) {
      throw new Error(`Could not insert transition into ${slidePath}`);
    }
    xml = xml.replace(clrMapEnd, `${clrMapEnd}${transitionXml}`);
    zip.file(slidePath, xml);
  }

  const transitionedFile = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await fs.writeFile(OUTPUT_PATH, transitionedFile);
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  if (manifest.length !== 12) {
    throw new Error(`Expected 12 slides in the manifest, found ${manifest.length}`);
  }

  const renderers = [
    renderCover,
    renderProblem,
    renderMatching,
    renderArchitecture,
    renderModels,
    renderSimulator,
    renderComparison,
    renderVideo,
    renderChat,
    renderTargets,
    renderMetrics,
    renderFinale,
  ];

  for (let index = 0; index < renderers.length; index += 1) {
    const slide = renderers[index]();
    const notes = manifest[index]?.speakerNotes;
    if (!notes) throw new Error(`Missing speaker notes for slide ${index + 1}`);
    slide.addNotes(notes);
  }

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await pptx.writeFile({ fileName: OUTPUT_PATH });
  await embedTransitions();
  const stat = await fs.stat(OUTPUT_PATH);
  console.log(`Generated ${path.basename(OUTPUT_PATH)} (${stat.size} bytes, 12 slides, 12 transitions).`);
}

main().catch((error) => {
  console.error("PowerPoint generation failed:", error);
  process.exitCode = 1;
});
