export default function Slide02() {
  return (
    <div className="w-screen h-screen overflow-hidden relative ss-slide ss-light" dir="rtl" lang="ar">
      <header className="ss-header"><div className="ss-brand">SkillSync AI</div><p className="ss-kicker">المشكلة</p></header>
      <h1 className="ss-heading">معضلة العزلة الأكاديمية</h1>
      <div className="ss-main ss-stat-layout">
        <section>
          <div className="ss-stat">73٪*</div>
          <p className="ss-stat-caption">من طلاب الجامعة يفتقرون إلى بيئة تفاعلية لممارسة المهارات مع أقرانهم خارج المحاضرات</p>
          <p className="ss-note">مستهدف أولي للمشروع، وليس نتيجة قياس أو مسح موثّق.</p>
        </section>
        <section className="ss-card">
          <p className="ss-kicker">الفجوة ليست في المحتوى</p>
          <h2 className="ss-person-title">الفجوة بين المعرفة والتطبيق</h2>
          <div className="ss-rule" />
          <p className="ss-body">يتعلم الطالب منفرداً، ثم يبحث عن شريك يشرح له ما لا يعرفه ويختبر معه ما يعرفه بالفعل.</p>
          <div className="ss-bottomline"><span>شرح متبادل</span><span>ممارسة واقعية</span><span>تغذية راجعة</span></div>
        </section>
      </div>
    </div>
  );
}
