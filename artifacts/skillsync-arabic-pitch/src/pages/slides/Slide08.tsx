export default function Slide08() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">التعلم المباشر</p></header>
      <h1 className="ss-heading">غرفة الفيديو الذكية ومساعد المكالمة</h1>
      <p className="ss-subtitle">اجتماع Jitsi بجوار أدوات التعلم، لا بعيداً عنها.</p>
      <div className="ss-main ss-video-layout">
        <section className="ss-meeting">
          <div className="ss-editor-top"><span dir="ltr">meet.jit.si</span><span>غرفة SkillSync AI</span></div>
          <div className="ss-meeting-grid"><div className="ss-avatar-pane">المتعلم أ</div><div className="ss-avatar-pane ss-avatar-pane-alt">المتعلم ب</div></div>
          <p className="ss-label ss-dark-subtitle">فيديو وصوت ومشاركة شاشة داخل مساحة التعلم</p>
        </section>
        <section className="ss-card ss-copilot">
          <div><p className="ss-kicker">منظم الأدوار</p><div className="ss-timer">15:00</div><p className="ss-body">دورة تدريس ثم تبديل الأدوار</p></div>
          <div className="ss-rule" />
          <div><h2 className="ss-person-title">مساعد المكالمة</h2><p className="ss-label">تفريغ مقاطع قصيرة من ميكروفون الجهاز بعد الموافقة، ثم تلميح أو ملخص أو اختبار من النص.</p></div>
        </section>
      </div>
    </div>
  );
}
