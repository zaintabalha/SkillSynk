export default function Slide09() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">التواصل المشترك</p></header>
      <h1 className="ss-heading">تواصل غني بالوسائط والذكاء السياقي</h1>
      <div className="ss-main ss-chat-layout">
        <section className="ss-chat-window" aria-label="تصوير توضيحي لمحادثة الشريك">
          <div className="ss-bubble">هل نراجع فكرة المشروع معاً؟</div>
          <div className="ss-bubble ss-bubble-own">نعم، أرسل لي مثالاً على الواجهة.</div>
          <div className="ss-voice"><span>▶</span><span>ملاحظة صوتية</span><span dir="ltr">0:18</span></div>
          <div className="ss-bubble">ردّ مقتبس: سأرسل نموذجاً أولياً.</div>
        </section>
        <section className="ss-feature-columns">
          <div className="ss-feature"><span className="ss-feature-number">01</span><h2 className="ss-feature-title">ردّ مقتبس</h2><p className="ss-label">اربط الإجابة برسالة سابقة بوضوح.</p></div>
          <div className="ss-feature"><span className="ss-feature-number">02</span><h2 className="ss-feature-title">صوت قابل للتفريغ</h2><p className="ss-label">تفريغ عند الطلب مع إظهار النص في المحادثة.</p></div>
          <div className="ss-feature"><span className="ss-feature-number">03</span><h2 className="ss-feature-title">صور خاصة</h2><p className="ss-label">رفع مباشر إلى التخزين الخاص مع ضغط على الجهاز.</p></div>
        </section>
      </div>
    </div>
  );
}
