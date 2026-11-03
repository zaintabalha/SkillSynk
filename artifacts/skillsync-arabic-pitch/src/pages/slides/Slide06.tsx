export default function Slide06() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">المحاكي التفاعلي</p></header>
      <h1 className="ss-heading">محاكي الأكواد التفاعلي الحي</h1>
      <p className="ss-subtitle">من وصف المهمة إلى تطبيق مرئي قابل للتعديل والتشغيل.</p>
      <div className="ss-main ss-editor-layout">
        <section>
          <p className="ss-body">يولد SkillSync AI حلاً كاملاً داخل <span dir="ltr">solution.js</span>، ثم يعرض عناصر DOM أو Canvas في مساحة معاينة منفصلة.</p>
          <div className="ss-safety-row"><span className="ss-chip">تعديل مباشر</span><span className="ss-chip">تشغيل محلي</span><span className="ss-chip">مخرجات وأخطاء</span></div>
        </section>
        <div className="ss-editor" aria-label="تصوير توضيحي لمحرر المحاكي">
          <div className="ss-editor-top"><span dir="ltr">solution.js</span><span>محرر الحل</span></div>
          <div className="ss-code"><div><span className="ss-code-accent">function</span> calculateProgress(done, total) {'{'}</div><div>  <span className="ss-code-accent">if</span> (total === 0) <span className="ss-code-accent">return</span> 0;</div><div>  <span className="ss-code-accent">return</span> Math.round((done / total) * 100);</div><div>{'}'}</div><div className="ss-code-green">renderStudyCard(calculateProgress(3, 4));</div></div>
          <div className="ss-terminal"><span>معاينة DOM معزولة</span><span>الشبكة محظورة</span></div>
        </div>
      </div>
    </div>
  );
}
