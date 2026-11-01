import { useState, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CircleHelp, Compass, GraduationCap, Languages, Lightbulb, LogOut, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, UserRound, X } from 'lucide-react';
import { getGetSkillSyncNoticesQueryKey, useGetSkillSyncAdminAccess, useGetSkillSyncNotices, useMarkSkillSyncNoticeRead } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useI18n, type DictKey } from '@/lib/i18n';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function Brand({ light = false }: { light?: boolean }) {
  const { t } = useI18n();
  return <Link href="/" className={`brand-mark ${light ? 'brand-light' : ''}`} aria-label={t('brandHome')} data-testid="link-brand">
    <span className="brand-glyph"><span /><span /></span><span dir="ltr">skillsync<span className="brand-dot">.</span></span>
  </Link>;
}

export function LanguageToggle({ tone = 'default' }: { tone?: 'default' | 'dark' }) {
  const { lang, setLang, t } = useI18n();
  return <button type="button" className={`lang-toggle ${tone === 'dark' ? 'lang-dark' : ''}`} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} aria-label={t('language')} data-testid="button-toggle-language">
    <Languages size={15} /><span>{lang === 'en' ? t('switchToArabic') : t('switchToEnglish')}</span>
  </button>;
}

export function useAdminAccess() {
  return useGetSkillSyncAdminAccess({ query: { staleTime: 5 * 60 * 1000, retry: 0 } });
}

export function PortalSwitcher({ current }: { current: 'student' | 'admin' }) {
  const { t } = useI18n();
  const access = useAdminAccess();
  const isAdmin = access.data?.isAdmin === true;
  return <div className="portal-switch" role="tablist" aria-label={t('portalSwitch')}>
    <Link href="/dashboard" className={current === 'student' ? 'portal-on' : ''} data-testid="link-portal-student"><UserRound size={14} /><span>{t('studentView')}</span></Link>
    {(isAdmin || current === 'admin') && <Link href="/admin" className={current === 'admin' ? 'portal-on' : ''} data-testid="link-portal-admin"><ShieldCheck size={14} /><span>{t('adminDashboard')}</span></Link>}
  </div>;
}

const navItems: { href: string; label: DictKey; icon: typeof Compass }[] = [
  { href: '/dashboard', label: 'navOverview', icon: Compass },
  { href: '/profile', label: 'navProfile', icon: GraduationCap },
  { href: '/matches', label: 'navMatches', icon: Sparkles },
  { href: '/rooms', label: 'navRooms', icon: BookOpen },
];

function NoticeBanner() {
  const { t } = useI18n();
  const notices = useGetSkillSyncNotices({ query: { staleTime: 60_000 } });
  const mark = useMarkSkillSyncNoticeRead();
  const client = useQueryClient();
  const list = notices.data || [];
  if (!list.length) return null;
  return <div className="notice-stack">{list.map((notice) => <div className="notice-banner" key={notice.id} data-testid={`notice-${notice.id}`}>
    <span className="notice-icon"><TriangleAlert size={17} /></span>
    <div><b>{t('noticeTitle')}</b><p>{notice.message}</p></div>
    <button className="notice-dismiss" disabled={mark.isPending} onClick={() => mark.mutate({ noticeId: notice.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetSkillSyncNoticesQueryKey() }) })} data-testid={`button-dismiss-notice-${notice.id}`}><X size={14} /> {t('dismiss')}</button>
  </div>)}</div>;
}

export function AppShell({ children, active, wide = false }: { children: ReactNode; active: string; wide?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { t } = useI18n();
  const display = user?.firstName || user?.username || t('student');
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand light />
      <div className="sidebar-caption mono">{t('yourCampusCircle')}</div>
      <nav className="sidebar-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`side-link ${active === href ? 'side-active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={18} /><span>{t(label)}</span>{active === href && <span className="side-mark" />}</Link>)}</nav>
      <div className="sidebar-note"><div className="note-mark"><Lightbulb size={17} /></div><b>{t('goodLearningShared')}</b><p>{t('goodLearningSharedDetail')}</p><Link href="/matches">{t('findYourPerson')} <ArrowRight size={13} className="flip-rtl" /></Link></div>
      <div className="sidebar-user"><div className="user-avatar">{initials(display)}</div><div className="user-meta"><b>{display}</b><span>{t('campusLearner')}</span></div><button className="icon-button logout-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label={t('signOut')} data-testid="button-sign-out"><LogOut size={17} className="flip-rtl" /></button></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="mobile-brand"><Brand /></div>
        <PortalSwitcher current="student" />
        <div className="topbar-right">
          <div className="topbar-status"><span className="live-dot" /> {t('yourLearningCircle')}</div>
          <LanguageToggle />
          <button className="topbar-help" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-help"><CircleHelp size={17} /><span>{t('needHand')}</span></button>
        </div>
        {menuOpen && <div className="help-popover"><b>{t('helpTitle')}</b><p>{t('helpDetail')}</p><button onClick={() => setMenuOpen(false)}>{t('gotIt')}</button></div>}
      </header>
      <main className={`content-area ${wide ? 'content-wide' : ''}`}><NoticeBanner />{children}</main>
    </div>
    <nav className="mobile-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active === href ? 'mobile-active' : ''}><Icon size={18} /><span>{t(label)}</span></Link>)}</nav>
  </div>;
}

export function LoadingScreen() {
  return <div className="loading-screen" aria-busy="true"><span className="skeleton skeleton-logo" /><span className="skeleton skeleton-title" /><span className="skeleton skeleton-panel" /><span className="skeleton skeleton-panel short" /></div>;
}

export function ErrorState({ onRetry, label }: { onRetry: () => void; label?: string }) {
  const { t } = useI18n();
  return <div className="state-card error-card"><div className="state-symbol"><RefreshCw size={20} /></div><h3>{t('smallPause')}</h3><p>{label || t('defaultError')} {t('tryAgainSuffix')}</p><button className="button button-secondary" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} /> {t('tryAgain')}</button></div>;
}

export function EmptyState({ icon: Icon = Sparkles, title, detail, action }: { icon?: typeof Sparkles; title: string; detail: string; action?: ReactNode }) {
  return <div className="state-card"><div className="state-symbol"><Icon size={21} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

export function SectionHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h1 className="display">{title}</h1><p>{detail}</p></div>{action}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const key: DictKey = status === 'completed' ? 'statusCompleted' : status === 'unmatched' ? 'statusUnmatched' : 'statusActive';
  return <span className={`status-pill ${status}`}>{t(key)}</span>;
}

export function Modal({ title, detail, onClose, children }: { title: string; detail?: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div><button className="modal-close" onClick={onClose} aria-label={t('close')} data-testid="button-close-modal"><X size={17} /></button></div>
      {children}
    </div>
  </div>;
}
