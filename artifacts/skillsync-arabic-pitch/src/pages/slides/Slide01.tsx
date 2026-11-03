export default function Slide01() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-dark ss-cover" dir="rtl" lang="ar">
      <header className="ss-header">
        <div className="ss-brand">SkillSync AI</div>
        <div className="ss-kicker">عرض لجنة التحكيم · 10 دقائق</div>
      </header>
      <div className="ss-cover-grid">
        <section>
          <p className="ss-kicker">منظومة الذكاء التشاركي</p>
          <h1 className="ss-hero-title"><span className="ss-latin">SkillSync AI:</span><span>ثورة التعلم التشاركي</span></h1>
          <p className="ss-subtitle ss-dark-subtitle">تحويل المعرفة الفردية الساكنة إلى خبرات تطبيقية حية عبر هندسة الذكاء الاصطناعي المتعدد</p>
        </section>
        <div className="ss-hero-graphic" aria-hidden="true">
          <div className="ss-orbit" />
          <div className="ss-hero-node"><span>تعلم</span><span>مشترك</span></div>
          <div className="ss-orbit-label ss-orbit-label-a">مهارة أ</div>
          <div className="ss-orbit-label ss-orbit-label-b">مهارة ب</div>
        </div>
      </div>
    </div>
  );
}
