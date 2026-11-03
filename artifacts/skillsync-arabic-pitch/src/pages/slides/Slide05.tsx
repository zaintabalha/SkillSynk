export default function Slide05() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">التعافي التلقائي</p></header>
      <h1 className="ss-heading">تناوب النماذج الأربعة دون انقطاع</h1>
      <p className="ss-subtitle">ترتيب احتياطي ينتقل تلقائياً عند حدود الاستخدام أو فشل الاستجابة.</p>
      <div className="ss-main">
        <div className="ss-flow">
          <section className="ss-model"><span className="ss-model-num">01</span><b className="ss-model-name">openai/gpt-oss-20b</b><span className="ss-model-purpose">المسار الأساسي · سرعة الاستجابة</span></section>
          <section className="ss-model"><span className="ss-model-num">02</span><b className="ss-model-name">openai/gpt-oss-120b</b><span className="ss-model-purpose">استدلال أعمق</span></section>
          <section className="ss-model"><span className="ss-model-num">03</span><b className="ss-model-name">qwen/qwen3.8-27b</b><span className="ss-model-purpose">تنظيم المنطق والمخرجات</span></section>
          <section className="ss-model ss-card-green"><span className="ss-model-num">04</span><b className="ss-model-name">allam-2-7b</b><span className="ss-model-purpose">دعم عربي</span></section>
        </div>
      </div>
    </div>
  );
}
