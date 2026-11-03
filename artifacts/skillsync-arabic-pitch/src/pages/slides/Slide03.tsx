export default function Slide03() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">الحل</p></header>
      <h1 className="ss-heading">مبدأ تبادل المهارات المتكافئ</h1>
      <p className="ss-subtitle">مطابقة تكاملية تحوّل اختلاف المهارات إلى خطة تعلم مشتركة.</p>
      <div className="ss-main">
        <div className="ss-three-col">
          <section className="ss-person">
            <div><p className="ss-kicker">المتعلم أ</p><h2 className="ss-person-title">يعرف البرمجة</h2></div>
            <div className="ss-skill"><span>يشارك</span><b>Code</b></div>
            <div className="ss-skill"><span>يريد تعلم</span><b>Product Design</b></div>
          </section>
          <div className="ss-match-center"><div className="ss-match-mark">↔</div><span>مطابقة</span><span>تكاملية</span></div>
          <section className="ss-person ss-person-b">
            <div><p className="ss-kicker">المتعلم ب</p><h2 className="ss-person-title">يعرف التصميم</h2></div>
            <div className="ss-skill"><span>يشارك</span><b>Product Design</b></div>
            <div className="ss-skill"><span>يريد تعلم</span><b>Code</b></div>
          </section>
        </div>
        <div className="ss-bottomline"><span>غرفة ثنائية اللغة</span><span>خطة تعلم مشتركة</span><span>مساعد SkillSync AI عند الطلب</span></div>
      </div>
    </div>
  );
}
