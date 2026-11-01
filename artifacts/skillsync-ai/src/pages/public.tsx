import { SignIn, SignUp, useAuth } from '@clerk/react';
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, Compass, HeartHandshake, Plus } from 'lucide-react';
import { useHealthCheck } from '@workspace/api-client-react';
import { Link, Redirect } from 'wouter';
import { Brand, LanguageToggle, basePath } from '@/components/shell';
import { useI18n } from '@/lib/i18n';

export function HomePage() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function Landing() {
  const health = useHealthCheck();
  const { t } = useI18n();
  return <main className="landing noise">
    <header className="landing-nav">
      <Brand />
      <nav className="landing-links" aria-label="Main navigation"><a href="#how-it-works">{t('howItWorks')}</a><a href="#community">{t('ourCommunity')}</a></nav>
      <div className="landing-actions"><LanguageToggle /><Link href="/sign-in" className="nav-login" data-testid="link-sign-in">{t('signIn')}</Link><Link href="/sign-up" className="button button-small" data-testid="link-sign-up">{t('joinCircle')} <ArrowRight size={15} className="flip-rtl" /></Link></div>
    </header>
    <section className="hero">
      <div className="hero-copy page-enter">
        <div className="eyebrow"><span className="live-dot" /> {t('heroEyebrow')}</div>
        <h1 className="display">{t('heroLine1')}<br />{t('heroLine2')} <em>{t('heroNeeds')}</em><br />{t('heroLine3')}</h1>
        <p className="hero-description">{t('heroDescription')}</p>
        <div className="hero-ctas"><Link href="/sign-up" className="button" data-testid="link-hero-cta">{t('heroCta')} <ArrowRight size={17} className="flip-rtl" /></Link><a href="#how-it-works" className="text-link">{t('seeHow')} <ArrowDown size={15} /></a></div>
        <div className="hero-proof"><div className="proof-avatars" dir="ltr"><span>MK</span><span>AJ</span><span>SR</span><span><Plus size={11} /></span></div><div><strong>{t('proofTitle')}</strong><small>{t('proofDetail')}</small></div></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="orbit-label label-top">{t('artTeach')} <b>Figma</b></div>
        <div className="orbit-label label-bottom">{t('artLearn')} <b>Python</b></div>
        <div className="art-center"><div className="art-sun"><span /></div><div className="art-person person-left"><i /><b /></div><div className="art-person person-right"><i /><b /></div><div className="art-sparkle s-one"><Plus size={20} /></div><div className="art-sparkle s-two"><Plus size={14} /></div><span className="art-note">{t('artNote')}</span></div>
        <div className="art-stamp"><span>{t('stampLearn')}</span><b><ArrowLeftRight size={16} /></b><span>{t('stampTeach')}</span></div>
      </div>
      <span className="hero-index mono">{t('heroIndex')}</span>
    </section>
    <section className="marquee-strip"><span>{t('marquee1')}</span><i><Plus size={14} /></i><span>{t('marquee2')}</span><i><Plus size={14} /></i><span>{t('marquee3')}</span><i><Plus size={14} /></i><span>{t('marquee1')}</span></section>
    <section id="how-it-works" className="how-section">
      <div className="section-intro"><span className="eyebrow">{t('howEyebrow')}</span><h2 className="display">{t('howTitle')}</h2><p>{t('howDetail')}</p></div>
      <div className="step-line">
        <article className="step-card"><span className="step-num">01</span><div className="step-icon"><Compass /></div><h3>{t('step1Title')}</h3><p>{t('step1Detail')}</p><span className="step-label">{t('step1Label')}</span></article>
        <div className="step-connector"><span /></div>
        <article className="step-card step-featured"><span className="step-num">02</span><div className="step-icon"><HeartHandshake /></div><h3>{t('step2Title')}</h3><p>{t('step2Detail')}</p><span className="step-label">{t('step2Label')}</span></article>
        <div className="step-connector"><span /></div>
        <article className="step-card"><span className="step-num">03</span><div className="step-icon"><BookOpen /></div><h3>{t('step3Title')}</h3><p>{t('step3Detail')}</p><span className="step-label">{t('step3Label')}</span></article>
      </div>
    </section>
    <section id="community" className="community-section">
      <div className="community-quote"><span className="eyebrow">{t('communityEyebrow')}</span><blockquote className="display">{t('communityQuote')}</blockquote><div className="quote-byline"><span className="quote-avatar">SS</span><span><b>{t('communityByline')}</b><small>{t('communityBylineDetail')}</small></span></div></div>
      <div className="community-graphic"><div className="graphic-paper"><span className="graphic-overline">{t('graphicOverline')}</span><div className="graphic-title display">{t('graphicTitleA')}<br /><i>{t('graphicTitleB')}</i></div><div className="graphic-lines"><span /><span /><span /></div><div className="graphic-bottom">{t('graphicBottom')} <ArrowUpRight size={18} /></div></div><div className="graphic-orbit" /><div className="graphic-leaf leaf-a" /><div className="graphic-leaf leaf-b" /></div>
    </section>
    <section className="final-cta"><div className="cta-orb"><ArrowUpRight size={20} /></div><span className="eyebrow">{t('ctaEyebrow')}</span><h2 className="display">{t('ctaTitleA')}<br />{t('ctaTitleB')}</h2><Link href="/sign-up" className="button button-cream" data-testid="link-final-cta">{t('ctaButton')} <ArrowRight size={17} className="flip-rtl" /></Link><p>{t('ctaNote')}</p></section>
    <footer className="landing-footer"><Brand /><span>{t('footerNote')}</span><span className="mono">© SKILLSYNC 2025</span></footer>
    {health.isError && <span className="sr-only">{t('serviceUnavailable')}</span>}
  </main>;
}

export function SignInPage() {
  const { t } = useI18n();
  return <div className="auth-page"><div className="auth-side"><Brand light /><div><span className="eyebrow">{t('signInEyebrow')}</span><h1 className="display">{t('signInTitleA')}<br />{t('signInTitleB')}</h1><p>{t('signInDetail')}</p></div><span className="auth-foot mono">{t('signInFoot')}</span></div><div className="auth-form-wrap"><div className="auth-top"><Link href="/" className="auth-back"><ArrowLeft size={15} className="flip-rtl" /> {t('backToSkillSync')}</Link><LanguageToggle /></div><div dir="ltr" className="auth-clerk"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div></div>;
}

export function SignUpPage() {
  const { t } = useI18n();
  return <div className="auth-page"><div className="auth-side"><Brand light /><div><span className="eyebrow">{t('signUpEyebrow')}</span><h1 className="display">{t('signUpTitleA')}<br />{t('signUpTitleB')} <i>{t('signUpTitleC')}</i></h1><p>{t('signUpDetail')}</p></div><span className="auth-foot mono">{t('signUpFoot')}</span></div><div className="auth-form-wrap"><div className="auth-top"><Link href="/" className="auth-back"><ArrowLeft size={15} className="flip-rtl" /> {t('backToSkillSync')}</Link><LanguageToggle /></div><div dir="ltr" className="auth-clerk"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div></div>;
}

export function NotFoundPage() {
  const { t } = useI18n();
  return <div className="not-found"><Brand /><span className="eyebrow">{t('notFoundEyebrow')}</span><h1 className="display">{t('notFoundTitleA')}<br />{t('notFoundTitleB')}</h1><p>{t('notFoundDetail')}</p><Link href="/" className="button">{t('backToSkillSync')} <ArrowRight size={15} className="flip-rtl" /></Link></div>;
}
