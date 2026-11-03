export default function Slide07() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">التجربة</p></header>
      <h1 className="ss-heading">من المطابقة النصية إلى التشغيل البصري</h1>
      <p className="ss-subtitle">التقييم يختبر الفهم؛ والمحاكي يتيح رؤية نتيجة الحل أثناء العمل.</p>
      <div className="ss-main ss-compare">
        <section className="ss-card ss-compare-side">
          <p className="ss-kicker">النهج التقليدي</p>
          <h2 className="ss-compare-title">إجابة ساكنة</h2>
          <ul className="ss-compare-list">
            <li><span className="ss-dot" />نص أو مخرجات مختصرة</li>
            <li><span className="ss-dot" />تصحيح بعد التسليم</li>
            <li><span className="ss-dot" />لا واجهة للاختبار التفاعلي</li>
          </ul>
        </section>
        <section className="ss-card ss-card-green ss-compare-side">
          <p className="ss-kicker">SkillSync AI</p>
          <h2 className="ss-compare-title">بيئة تشغيل معزولة</h2>
          <ul className="ss-compare-list">
            <li><span className="ss-dot" />DOM وCanvas داخل iframe</li>
            <li><span className="ss-dot" />تفاعل ونتائج لحظية</li>
            <li><span className="ss-dot" />قيود شبكة ووقت ومخرجات</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
