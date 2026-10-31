import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp,
  Clock3, Compass, GraduationCap, HeartHandshake, Lightbulb, LoaderCircle, LogOut, MessageCircle,
  Plus, RefreshCw, Send, Sparkles, Users, WandSparkles,
} from 'lucide-react';
import {
  getGetSkillSyncDashboardQueryKey, getGetSkillSyncMatchesQueryKey, getGetSkillSyncProfileQueryKey,
  getGetSkillSyncRoomQueryKey, getGetSkillSyncRoomsQueryKey, useConnectSkillSyncMatch,
  useGenerateSkillSyncDailyChallenge, useGenerateSkillSyncRecommendations, useGetSkillSyncDashboard,
  useGetSkillSyncMatches, useGetSkillSyncProfile, useGetSkillSyncRoom, useGetSkillSyncRooms,
  useHealthCheck, useSaveSkillSyncProfile, useSendSkillSyncMessage, useSubmitSkillSyncProject,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import type { Dashboard, MatchCandidate, ProfileInput, RoomSummary } from '@workspace/api-client-react';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#3f745e', colorForeground: '#294238', colorMutedForeground: '#718077',
    colorDanger: '#b64b40', colorBackground: '#fbfaf6', colorInput: '#fffefa',
    colorInputForeground: '#294238', colorNeutral: '#d9ded6',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-[24px] w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#294238] font-bold tracking-tight',
    headerSubtitle: 'text-[#718077]',
    socialButtonsBlockButtonText: 'text-[#294238] font-semibold',
    formFieldLabel: 'text-[#294238] font-semibold',
    footerActionLink: 'text-[#3f745e] font-semibold',
    footerActionText: 'text-[#718077]',
    dividerText: 'text-[#718077]',
    identityPreviewEditButton: 'text-[#3f745e]',
    formFieldSuccessText: 'text-[#3f745e]',
    alertText: 'text-[#294238]',
    logoBox: 'mb-4',
    logoImage: 'h-9',
    socialButtonsBlockButton: 'rounded-xl border-[#d9ded6] bg-[#fffefa]',
    formButtonPrimary: 'rounded-xl bg-[#3f745e] hover:bg-[#315d4b] text-white',
    formFieldInput: 'rounded-xl border-[#d9ded6] bg-[#fffefa] text-[#294238]',
    footerAction: 'text-[#718077]',
    dividerLine: 'bg-[#d9ded6]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-xl border-[#d9ded6] text-[#294238]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand-mark ${light ? 'brand-light' : ''}`} aria-label="SkillSync home">
    <span className="brand-glyph"><span /><span /></span><span>skillsync<span className="brand-dot">.</span></span>
  </Link>;
}

function HomePage() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function Landing() {
  const health = useHealthCheck();
  return <main className="landing noise">
    <header className="landing-nav">
      <Brand />
      <nav className="landing-links" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a><a href="#community">Our community</a>
      </nav>
      <div className="landing-actions"><Link href="/sign-in" className="nav-login">Sign in</Link><Link href="/sign-up" className="button button-small">Join the circle <ArrowRight size={15} /></Link></div>
    </header>
    <section className="hero">
      <div className="hero-copy page-enter">
        <div className="eyebrow"><span className="live-dot" /> A learning community for campus</div>
        <h1 className="display">You know a thing.<br />Someone else <em>needs</em><br />to know it.</h1>
        <p className="hero-description">Trade what you’re good at for what you’re curious about. Find your person, learn side by side, and make something real together.</p>
        <div className="hero-ctas"><Link href="/sign-up" className="button">Find your learning partner <ArrowRight size={17} /></Link><a href="#how-it-works" className="text-link">See how it works <ArrowDown size={15} /></a></div>
        <div className="hero-proof"><div className="proof-avatars"><span>MK</span><span>AJ</span><span>SR</span><span>+</span></div><div><strong>Good things grow together.</strong><small>Built for curious people on campus</small></div></div>
      </div>
      <div className="hero-art" aria-label="Illustration of complementary learning skills">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="orbit-label label-top">I can teach <b>Figma</b></div>
        <div className="orbit-label label-bottom">I want to learn <b>Python</b></div>
        <div className="art-center"><div className="art-sun"><span /></div><div className="art-person person-left"><i /><b /></div><div className="art-person person-right"><i /><b /></div><div className="art-sparkle s-one">+</div><div className="art-sparkle s-two">+</div><span className="art-note">different strengths<br />same table</span></div>
        <div className="art-stamp"><span>LEARN</span><b>↔</b><span>TEACH</span></div>
      </div>
      <span className="hero-index mono">01 — MADE OF MANY MINDS</span>
    </section>
    <section className="marquee-strip"><span>One skill shared</span><i>+</i><span>One new door opened</span><i>+</i><span>One project made together</span><i>+</i><span>One skill shared</span></section>
    <section id="how-it-works" className="how-section">
      <div className="section-intro"><span className="eyebrow">A better kind of study group</span><h2 className="display">Learning goes both ways.</h2><p>No tutors. No awkward networking. Just two people with different strengths building something neither could make alone.</p></div>
      <div className="step-line">
        <article className="step-card"><span className="step-num">01</span><div className="step-icon"><Compass /></div><h3>Bring your two things</h3><p>Tell us what you’re happy to teach and what you’d love to learn next.</p><span className="step-label">Your profile, your terms</span></article>
        <div className="step-connector"><span /></div>
        <article className="step-card step-featured"><span className="step-num">02</span><div className="step-icon"><HeartHandshake /></div><h3>Meet your match</h3><p>We pair complementary skills, shared interests, and students who are ready to show up.</p><span className="step-label">Thoughtful, not random</span></article>
        <div className="step-connector"><span /></div>
        <article className="step-card"><span className="step-num">03</span><div className="step-icon"><BookOpen /></div><h3>Make a little progress</h3><p>Follow a shared curriculum, tackle daily challenges, and make a project you can point to.</p><span className="step-label">Better, together</span></article>
      </div>
    </section>
    <section id="community" className="community-section">
      <div className="community-quote"><span className="eyebrow">The magic is in the exchange</span><blockquote className="display">“I teach the part I know. You teach the part I don’t. Somewhere in the middle, we both get better.”</blockquote><div className="quote-byline"><span className="quote-avatar">SS</span><span><b>The SkillSync idea</b><small>For people who learn by sharing</small></span></div></div>
      <div className="community-graphic"><div className="graphic-paper"><span className="graphic-overline">A SMALL PROMISE</span><div className="graphic-title display">More than<br /><i>notes.</i></div><div className="graphic-lines"><span /><span /><span /></div><div className="graphic-bottom">MAKE SOMETHING<br />THAT’S YOURS <ArrowUpRight size={18} /></div></div><div className="graphic-orbit" /><div className="graphic-leaf leaf-a" /><div className="graphic-leaf leaf-b" /></div>
    </section>
    <section className="final-cta"><div className="cta-orb">↗</div><span className="eyebrow">Your next good idea starts with a person</span><h2 className="display">What will you<br />teach each other?</h2><Link href="/sign-up" className="button button-cream">Start with your skills <ArrowRight size={17} /></Link><p>Free to join. Better with a buddy.</p></section>
    <footer className="landing-footer"><Brand /><span>Made for the curious, wherever you study.</span><span className="mono">© SKILLSYNC 2025</span></footer>
    {health.isError && <span className="sr-only">Service status unavailable</span>}
  </main>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function SignInPage() {
  return <div className="auth-page"><div className="auth-side"><Brand light /><div><span className="eyebrow">A note from the circle</span><h1 className="display">A little progress<br />goes a long way.</h1><p>Pick up right where you and your learning partner left off.</p></div><span className="auth-foot mono">SKILLSYNC / STUDY BETTER TOGETHER</span></div><div className="auth-form-wrap"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to SkillSync</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="auth-page"><div className="auth-side"><Brand light /><div><span className="eyebrow">Your campus, in good company</span><h1 className="display">Come with a skill.<br />Leave with <i>more.</i></h1><p>Make room for the things you know and the things you’re still figuring out.</p></div><span className="auth-foot mono">SKILLSYNC / THE BEST THINGS ARE SHARED</span></div><div className="auth-form-wrap"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to SkillSync</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Compass },
  { href: '/profile', label: 'My profile', icon: GraduationCap },
  { href: '/matches', label: 'Find a match', icon: Sparkles },
  { href: '/rooms', label: 'Learning rooms', icon: BookOpen },
];

function AppShell({ children, active }: { children: ReactNode; active: string }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const display = user?.firstName || user?.username || 'Student';
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand light />
      <div className="sidebar-caption mono">YOUR CAMPUS CIRCLE</div>
      <nav className="sidebar-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`side-link ${active === href ? 'side-active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} /><span>{label}</span>{active === href && <span className="side-mark" />}</Link>)}</nav>
      <div className="sidebar-note"><div className="note-mark"><Lightbulb size={17} /></div><b>Good learning is shared.</b><p>A little curiosity goes a long way when you bring a friend.</p><Link href="/matches">Find your person <ArrowRight size={13} /></Link></div>
      <div className="sidebar-user"><div className="user-avatar">{display.slice(0, 2).toUpperCase()}</div><div className="user-meta"><b>{display}</b><span>Campus learner</span></div><button className="icon-button logout-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" data-testid="button-sign-out"><LogOut size={17} /></button></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="mobile-brand"><Brand /></div><div className="topbar-status"><span className="live-dot" /> Your learning circle</div><button className="topbar-help" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-help"><CircleHelp size={17} /><span>Need a hand?</span></button>{menuOpen && <div className="help-popover"><b>Start with one small step.</b><p>Update your profile, find a complementary match, then open a learning room together.</p><button onClick={() => setMenuOpen(false)}>Got it</button></div>}</header>
      <main className="content-area">{children}</main>
    </div>
    <nav className="mobile-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active === href ? 'mobile-active' : ''}><Icon size={18} /><span>{label}</span></Link>)}</nav>
  </div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><span className="skeleton skeleton-logo" /><span className="skeleton skeleton-title" /><span className="skeleton skeleton-panel" /><span className="skeleton skeleton-panel short" /></div>;
}

function ErrorState({ onRetry, label = 'We couldn’t bring this in just yet.' }: { onRetry: () => void; label?: string }) {
  return <div className="state-card error-card"><div className="state-symbol"><RefreshCw size={20} /></div><h3>A small pause.</h3><p>{label} Give it another try.</p><button className="button button-secondary" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} /> Try again</button></div>;
}

function EmptyState({ icon: Icon = Sparkles, title, detail, action }: { icon?: typeof Sparkles; title: string; detail: string; action?: ReactNode }) {
  return <div className="state-card"><div className="state-symbol"><Icon size={21} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function SectionHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h1 className="display">{title}</h1><p>{detail}</p></div>{action}</div>;
}

function DashboardPage() {
  const query = useGetSkillSyncDashboard();
  if (query.isLoading) return <AppShell active="/dashboard"><LoadingScreen /></AppShell>;
  if (query.isError || !query.data) return <AppShell active="/dashboard"><ErrorState onRetry={() => query.refetch()} /></AppShell>;
  const data = query.data as Dashboard;
  return <AppShell active="/dashboard"><div className="page-enter">
    <div className="welcome-row"><div><span className="eyebrow">YOUR LEARNING CIRCLE / OVERVIEW</span><h1 className="display">A good day to <i>grow.</i></h1><p>Small steps, shared with someone, add up.</p></div><Link href="/matches" className="button"><Sparkles size={16} /> Find a learning match</Link></div>
    {!data.profileComplete && <div className="profile-nudge"><div className="nudge-icon"><GraduationCap size={20} /></div><div><b>Let people know what you bring.</b><p>Add the skills you can share and the ones you’re curious about.</p></div><Link href="/profile" className="text-link">Finish your profile <ArrowRight size={14} /></Link></div>}
    <div className="stats-row">
      <StatTile label="Active learning rooms" value={data.stats.activeRooms} icon={BookOpen} accent="mint" />
      <StatTile label="Connections made" value={data.stats.connectionsMade} icon={Users} accent="peach" />
      <StatTile label="Projects shared" value={data.stats.projectsSubmitted} icon={Lightbulb} accent="cream" />
    </div>
    <div className="dashboard-grid">
      <section className="panel rooms-panel"><div className="panel-heading"><div><span className="eyebrow">SIDE BY SIDE</span><h2>Your learning rooms</h2></div><Link href="/rooms" className="quiet-link">All rooms <ArrowRight size={14} /></Link></div>
        {data.rooms.length ? <div className="room-list">{data.rooms.slice(0, 3).map((room) => <RoomRow room={room} key={room.roomId} />)}</div> : <EmptyState icon={BookOpen} title="Your table is waiting." detail="Find a learning partner and start building something together." action={<Link href="/matches" className="text-link">Meet your match <ArrowRight size={14} /></Link>} />}
      </section>
      <section className="panel match-panel"><div className="panel-heading"><div><span className="eyebrow">GOOD PEOPLE, GOOD FIT</span><h2>People to learn with</h2></div><Link href="/matches" className="quiet-link">See all <ArrowRight size={14} /></Link></div>
        {data.recommendations.length ? <div className="mini-match-list">{data.recommendations.slice(0, 2).map((candidate) => <MiniMatch candidate={candidate} key={candidate.userId} />)}</div> : <EmptyState title="No suggestions just yet." detail="Add your teach and learn skills to make a thoughtful introduction." action={<Link href="/profile" className="text-link">Shape your profile <ArrowRight size={14} /></Link>} />}
      </section>
    </div>
    <section className="activity-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT MOMENTS</span><h2>What’s been happening</h2></div><span className="activity-count">{data.recentActivity.length} recent</span></div>{data.recentActivity.length ? <div className="activity-list">{data.recentActivity.slice(0, 5).map((activity) => <div className="activity-item" key={activity.id}><span className="activity-dot" /><div><b>{activity.label}</b><p>{activity.detail}</p></div><time>{formatDate(activity.createdAt)}</time></div>)}</div> : <div className="activity-empty"><span>Good things are just getting started.</span><Link href="/matches">Find a match <ArrowRight size={14} /></Link></div>}</section>
  </div></AppShell>;
}

function StatTile({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof BookOpen; accent: string }) {
  return <div className={`stat-tile ${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18} /></span></div><strong>{value}</strong><small>and counting</small></div>;
}

function ProfilePage() {
  const query = useGetSkillSyncProfile();
  const save = useSaveSkillSyncProfile();
  const client = useQueryClient();
  const { user } = useUser();
  const [form, setForm] = useState<ProfileInput>({ displayName: '', university: '', teachSkill: '', learnSkill: '', bio: '' });
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data && !initialized) {
      const existing = query.data.profile;
      setForm(existing ? { displayName: existing.displayName, university: existing.university, teachSkill: existing.teachSkill, learnSkill: existing.learnSkill, bio: existing.bio } : { ...form, displayName: user?.fullName || user?.firstName || '' });
      setInitialized(true);
    }
  }, [query.data, initialized, user?.fullName, user?.firstName]);
  const update = (field: keyof ProfileInput, value: string) => { setForm((old) => ({ ...old, [field]: value })); setSaved(false); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ data: form }, { onSuccess: () => { setSaved(true); client.invalidateQueries({ queryKey: getGetSkillSyncProfileQueryKey() }); client.invalidateQueries({ queryKey: getGetSkillSyncDashboardQueryKey() }); } });
  };
  if (query.isLoading) return <AppShell active="/profile"><LoadingScreen /></AppShell>;
  if (query.isError) return <AppShell active="/profile"><ErrorState onRetry={() => query.refetch()} /></AppShell>;
  return <AppShell active="/profile"><div className="page-enter">
    <SectionHeader eyebrow="YOUR PROFILE / YOUR STORY" title="A little about you." detail="The best matches start with an honest picture of what you love sharing and learning." />
    <div className="profile-layout">
      <form className="panel profile-form" onSubmit={submit}>
        <div className="form-section-title"><span className="form-step">01</span><div><h2>Make your introduction</h2><p>Help your campus community get to know you.</p></div></div>
        <div className="form-grid">
          <label className="field"><span>Your name</span><input required maxLength={80} value={form.displayName} onChange={(e) => update('displayName', e.target.value)} placeholder="How should people know you?" data-testid="input-display-name" /></label>
          <label className="field"><span>University or campus</span><input required maxLength={120} value={form.university} onChange={(e) => update('university', e.target.value)} placeholder="Where are you learning?" data-testid="input-university" /></label>
        </div>
        <label className="field"><span>A few words about you <small>Optional, but helpful</small></span><textarea maxLength={500} rows={3} value={form.bio} onChange={(e) => update('bio', e.target.value)} placeholder="What are you curious about lately?" data-testid="input-bio" /><small className="field-count">{form.bio.length}/500</small></label>
        <div className="form-divider" />
        <div className="form-section-title"><span className="form-step">02</span><div><h2>Your skill exchange</h2><p>One thing to give. One thing to get curious about.</p></div></div>
        <div className="form-grid">
          <label className="field skill-field"><span>I can share <i>→</i></span><input required maxLength={80} value={form.teachSkill} onChange={(e) => update('teachSkill', e.target.value)} placeholder="e.g. visual storytelling" data-testid="input-teach-skill" /></label>
          <label className="field skill-field"><span>I’d love to learn <i>←</i></span><input required maxLength={80} value={form.learnSkill} onChange={(e) => update('learnSkill', e.target.value)} placeholder="e.g. creative coding" data-testid="input-learn-skill" /></label>
        </div>
        <div className="form-submit-row">{saved && <span className="saved-note"><Check size={15} /> Your profile is saved</span>}<button type="submit" className="button" disabled={save.isPending} data-testid="button-save-profile">{save.isPending ? <LoaderCircle className="spin" size={16} /> : null}{save.isPending ? 'Saving…' : 'Save my profile'} <ArrowRight size={15} /></button></div>
        {save.isError && <p className="inline-error">We couldn’t save that just now. Your writing is still here — try again.</p>}
      </form>
      <aside className="profile-aside"><div className="profile-preview"><div className="preview-top"><span className="preview-tag">YOUR INTRODUCTION</span><span className="preview-symbol">↗</span></div><div className="preview-avatar">{form.displayName.slice(0, 2).toUpperCase() || 'YOU'}</div><h3>{form.displayName || 'Your name here'}</h3><p>{form.university || 'Your campus'}</p>{form.bio && <blockquote>“{form.bio}”</blockquote>}<div className="preview-skills"><div><small>CAN SHARE</small><b>{form.teachSkill || 'Your skill'}</b></div><span>+</span><div><small>CURIOUS ABOUT</small><b>{form.learnSkill || 'A new skill'}</b></div></div></div><div className="aside-tip"><span className="tip-icon"><Lightbulb size={18} /></span><div><b>Specific is generous.</b><p>“I can help with beginner Python” makes it easier for someone to say hello.</p></div></div></aside>
    </div>
  </div></AppShell>;
}

function MatchesPage() {
  const query = useGetSkillSyncMatches();
  const generate = useGenerateSkillSyncRecommendations();
  const connect = useConnectSkillSyncMatch();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [connectingId, setConnectingId] = useState('');
  const recommendations = generate.data?.recommendations || query.data || [];
  const matchesError = query.isError && !generate.data;
  const startRoom = (candidate: MatchCandidate) => {
    setConnectingId(candidate.userId);
    connect.mutate({ data: { partnerUserId: candidate.userId } }, {
      onSuccess: (room) => { client.invalidateQueries({ queryKey: getGetSkillSyncRoomsQueryKey() }); client.invalidateQueries({ queryKey: getGetSkillSyncDashboardQueryKey() }); setLocation(`/rooms/${room.roomId}`); },
      onSettled: () => setConnectingId(''),
    });
  };
  return <AppShell active="/matches"><div className="page-enter">
    <SectionHeader eyebrow="FIND YOUR PEOPLE / COMPLEMENTARY SKILLS" title="The right kind of different." detail="We look for the overlap between what you can share and what someone else wants to learn." action={<button className="button button-secondary" onClick={() => generate.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getGetSkillSyncMatchesQueryKey() }) })} disabled={generate.isPending} data-testid="button-refresh-matches">{generate.isPending ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />}{generate.isPending ? 'Looking around…' : 'Find fresh matches'}</button>} />
    <div className="match-intro-strip"><div className="match-intro-icon"><HeartHandshake size={21} /></div><div><b>Not just matching skill tags.</b><span>We’re looking for the kind of exchange where both people leave knowing more.</span></div><span className="intro-star">+</span></div>
    {query.isLoading && !generate.data ? <div className="match-grid">{[1, 2, 3].map((item) => <div className="skeleton match-skeleton" key={item} />)}</div> : matchesError ? <ErrorState onRetry={() => query.refetch()} /> : recommendations.length ? <div className="match-grid">{recommendations.map((candidate, index) => <article className={`match-card ${index === 0 ? 'match-card-lead' : ''}`} key={candidate.userId} data-testid={`card-match-${candidate.userId}`}>
      <div className="match-card-top"><div className="match-avatar">{candidate.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="match-score"><span>GOOD FIT</span><b>{candidate.compatibilityScore}<small>%</small></b></div></div>
      <div className="match-name">{candidate.displayName}</div><div className="match-campus"><GraduationCap size={14} /> {candidate.university}</div>
      <div className="exchange-pair"><div><small>THEY CAN SHARE</small><b>{candidate.teachSkill}</b></div><span className="exchange-arrow">↔</span><div><small>THEY WANT TO LEARN</small><b>{candidate.learnSkill}</b></div></div>
      <p className="match-bio">{candidate.bio}</p><div className="why-match"><Sparkles size={14} /><span>{candidate.whyMatch}</span></div>
      <button className="button match-action" onClick={() => startRoom(candidate)} disabled={connect.isPending} data-testid={`button-start-room-${candidate.userId}`}>{connectingId === candidate.userId ? <LoaderCircle className="spin" size={16} /> : <MessageCircle size={16} />}{connectingId === candidate.userId ? 'Opening your room…' : 'Start a learning room'} <ArrowRight size={15} /></button>
      {connect.isError && connectingId === '' && <p className="inline-error">Couldn’t open a room. Please try again.</p>}
    </article>)}</div> : <EmptyState title="Your next good conversation is out there." detail="Add a skill you can share and one you’d like to learn, then we’ll look for complementary people on campus." action={<Link href="/profile" className="button button-secondary">Set up your profile <ArrowRight size={15} /></Link>} />}
  </div></AppShell>;
}

function RoomsPage() {
  const query = useGetSkillSyncRooms();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  if (query.isLoading) return <AppShell active="/rooms"><LoadingScreen /></AppShell>;
  if (query.isError) return <AppShell active="/rooms"><ErrorState onRetry={() => query.refetch()} /></AppShell>;
  const rooms = (query.data || []).filter((room) => filter === 'all' || room.status === filter);
  return <AppShell active="/rooms"><div className="page-enter">
    <SectionHeader eyebrow="LEARN TOGETHER / YOUR ROOMS" title="A shared place to make progress." detail="Your conversations, challenges, and projects all live here." action={<Link href="/matches" className="button"><Plus size={16} /> Find a learning partner</Link>} />
    <div className="room-filters">{(['all', 'active', 'completed'] as const).map((value) => <button key={value} className={filter === value ? 'filter-active' : ''} onClick={() => setFilter(value)} data-testid={`button-filter-${value}`}>{value === 'all' ? 'All rooms' : value === 'active' ? 'In progress' : 'Completed'}</button>)}</div>
    {rooms.length ? <div className="rooms-grid">{rooms.map((room) => <RoomCard room={room} key={room.roomId} />)}</div> : <EmptyState icon={BookOpen} title={filter === 'all' ? 'No rooms yet. That’s a lovely blank page.' : `No ${filter} rooms.`} detail={filter === 'all' ? 'Find someone whose skills complement yours and open up a shared learning space.' : 'Your other rooms will show up here.'} action={filter === 'all' && <Link href="/matches" className="button button-secondary">Meet your match <ArrowRight size={15} /></Link>} />}
  </div></AppShell>;
}

function RoomRow({ room }: { room: RoomSummary }) {
  return <Link href={`/rooms/${room.roomId}`} className="room-row" data-testid={`link-room-${room.roomId}`}><div className="room-person">{room.partnerName.slice(0, 2).toUpperCase()}</div><div className="room-row-main"><div className="room-row-title"><b>{room.projectTitle}</b><span className={`status-pill ${room.status}`}>{room.status === 'active' ? 'In progress' : 'Complete'}</span></div><span>{room.lastMessage || `Learning with ${room.partnerName}`}</span></div><div className="room-progress-wrap"><span>{room.progress}%</span><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div></div><ChevronRight size={17} className="row-chevron" /></Link>;
}

function RoomCard({ room }: { room: RoomSummary }) {
  return <Link href={`/rooms/${room.roomId}`} className="room-card" data-testid={`link-room-card-${room.roomId}`}><div className="room-card-top"><span className="room-card-id mono">LEARNING ROOM</span><span className={`status-pill ${room.status}`}>{room.status === 'active' ? 'In progress' : 'Complete'}</span></div><div className="room-card-title">{room.projectTitle}</div><div className="room-card-person"><span>{room.partnerName.slice(0, 2).toUpperCase()}</span> With {room.partnerName}</div><div className="room-card-bottom"><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div><b>{room.progress}%</b></div><div className="room-card-last">{room.lastMessage || 'Your shared work is ready for another step.'}</div><div className="room-card-footer"><span><Clock3 size={13} /> Updated {formatDate(room.updatedAt)}</span><ArrowUpRight size={16} /></div></Link>;
}

function MiniMatch({ candidate }: { candidate: MatchCandidate }) {
  return <div className="mini-match"><span className="mini-avatar">{candidate.displayName.slice(0, 2).toUpperCase()}</span><div><b>{candidate.displayName}</b><small>{candidate.teachSkill} ↔ {candidate.learnSkill}</small></div><span className="mini-score">{candidate.compatibilityScore}%</span></div>;
}

function RoomDetailPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const query = useGetSkillSyncRoom(roomId, { query: { queryKey: getGetSkillSyncRoomQueryKey(roomId), refetchInterval: 3000 } });
  const generateChallenge = useGenerateSkillSyncDailyChallenge();
  const sendMessage = useSendSkillSyncMessage();
  const submitProject = useSubmitSkillSyncProject();
  const client = useQueryClient();
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectContent, setProjectContent] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [tab, setTab] = useState<'conversation' | 'project'>('conversation');
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (query.data && !projectTitle) setProjectTitle(query.data.projectTitle); }, [query.data, projectTitle]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [query.data?.messages.length]);
  const refreshRoom = () => client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(roomId) });
  const onSend = (event: FormEvent) => {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    sendMessage.mutate({ roomId, data: { content } }, { onSuccess: () => { setMessage(''); refreshRoom(); } });
  };
  const onSubmitProject = (event: FormEvent) => {
    event.preventDefault();
    submitProject.mutate({ roomId, data: { title: projectTitle, content: projectContent } }, { onSuccess: () => { setProjectContent(''); setShowSubmit(false); setTab('project'); refreshRoom(); } });
  };
  if (query.isLoading) return <AppShell active="/rooms"><LoadingScreen /></AppShell>;
  if (query.isError || !query.data) return <AppShell active="/rooms"><ErrorState onRetry={() => query.refetch()} label="We couldn’t open this learning room." /></AppShell>;
  const room = query.data;
  return <AppShell active="/rooms"><div className="page-enter">
    <Link href="/rooms" className="back-link"><ArrowLeft size={15} /> All learning rooms</Link>
    <div className="room-detail-heading"><div><span className="eyebrow">LEARNING ROOM / WITH {room.partnerName.toUpperCase()}</span><h1 className="display">{room.projectTitle}</h1><p>A shared project is a good reason to learn something new.</p></div><span className={`status-pill ${room.status}`}>{room.status === 'active' ? 'In progress' : 'Complete'}</span></div>
    <div className="room-detail-layout">
      <div className="room-main-panel">
        <div className="room-tabs"><button className={tab === 'conversation' ? 'tab-active' : ''} onClick={() => setTab('conversation')} data-testid="tab-conversation"><MessageCircle size={15} /> Conversation <span>{room.messages.length}</span></button><button className={tab === 'project' ? 'tab-active' : ''} onClick={() => setTab('project')} data-testid="tab-project"><Lightbulb size={15} /> Project <span>{room.submissions.length}</span></button></div>
        {tab === 'conversation' ? <section className="conversation-view"><div className="conversation-intro"><span className="room-partner-avatar">{room.partnerName.slice(0, 2).toUpperCase()}</span><div><b>You + {room.partnerName}</b><span>Ideas welcome. Questions encouraged.</span></div><span className="polling-indicator"><i /> LIVE</span></div>
          <div className="message-feed" ref={feedRef} data-testid="list-chat-messages">{room.messages.length ? room.messages.map((item) => <div className={`chat-message ${item.senderType === 'moderator' ? 'moderator-message' : item.senderId === user?.id ? 'own-message' : ''}`} key={item.id} data-testid={`message-${item.id}`}><span className="message-avatar">{item.senderType === 'moderator' ? 'S' : item.senderName.slice(0, 1).toUpperCase()}</span><div className="message-content"><div className="message-meta"><b>{item.senderType === 'moderator' ? 'SkillSync guide' : item.senderName}</b><time>{formatTime(item.createdAt)}</time></div><p>{item.content}</p></div></div>) : <div className="chat-empty"><span className="empty-chat-icon"><MessageCircle size={20} /></span><b>Start with a hello.</b><p>Share what you’re excited to learn or ask your partner where they’d like to begin.</p></div>}</div>
          <form className="message-composer" onSubmit={onSend}><input value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} placeholder="Write a message to your partner…" aria-label="Message" data-testid="input-chat-message" /><button className="send-button" disabled={!message.trim() || sendMessage.isPending} aria-label="Send message" data-testid="button-send-message">{sendMessage.isPending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button></form>{sendMessage.isError && <p className="inline-error">Your message didn’t go through. Please try again.</p>}
        </section> : <section className="project-view"><div className="project-top"><div><span className="eyebrow">MADE TOGETHER</span><h2>Your shared project</h2><p>Bring your perspectives together into something you can be proud of.</p></div><button className="button button-secondary" onClick={() => setShowSubmit(!showSubmit)} data-testid="button-submit-project"><Plus size={15} /> Share a submission</button></div>
          {showSubmit && <form className="submission-form" onSubmit={onSubmitProject}><label className="field"><span>Project title</span><input required maxLength={120} value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} data-testid="input-project-title" /></label><label className="field"><span>What did you make?</span><textarea required maxLength={12000} rows={5} value={projectContent} onChange={(e) => setProjectContent(e.target.value)} placeholder="Share your work, what you learned, and how you worked together…" data-testid="input-project-content" /></label><div className="submission-actions"><button type="button" className="quiet-link" onClick={() => setShowSubmit(false)}>Cancel</button><button type="submit" className="button" disabled={submitProject.isPending} data-testid="button-submit-evaluation">{submitProject.isPending ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{submitProject.isPending ? 'Sending for feedback…' : 'Submit for feedback'} <ArrowRight size={14} /></button></div>{submitProject.isError && <p className="inline-error">Couldn’t submit your project. Please try again.</p>}</form>}
          {room.submissions.length ? <div className="submission-list">{[...room.submissions].reverse().map((submission) => <article className="submission-card" key={submission.id}><div className="submission-heading"><div><span className="eyebrow">PROJECT SUBMISSION / {formatDate(submission.submittedAt)}</span><h3>{submission.title}</h3></div><div className="overall-score"><b>{submission.overallScore}</b><small>OVERALL</small></div></div><p className="submission-content">{submission.content}</p><div className="evaluation-grid"><div><span>TECHNICAL</span><b>{submission.technicalScore}<small>/100</small></b><p>{submission.technicalFeedback}</p></div><div><span>COMMUNICATION</span><b>{submission.communicationScore}<small>/100</small></b><p>{submission.communicationFeedback}</p></div></div>{submission.nextSteps.length > 0 && <div className="next-steps"><b>Ideas for the next step</b>{submission.nextSteps.map((next, i) => <p key={i}><Check size={14} /> {next}</p>)}</div>}</article>)}</div> : <EmptyState icon={Lightbulb} title="The project is yours to shape." detail="When you have something to share, send it in for thoughtful feedback on both the craft and the collaboration." action={<button className="button button-secondary" onClick={() => setShowSubmit(true)}>Share your first submission <ArrowRight size={15} /></button>} />}
        </section>}
      </div>
      <aside className="room-sidebar">
        <section className="room-aside-card curriculum-card"><div className="aside-card-top"><span className="aside-card-icon"><BookOpen size={17} /></span><span className="eyebrow">YOUR SHARED PATH</span></div><h2>{room.curriculum.title}</h2><p>{room.curriculum.description}</p><div className="curriculum-goal"><small>THE GOAL</small><b>{room.curriculum.goal}</b></div><div className="curriculum-stages">{room.curriculum.stages.map((stage, index) => <div className="curriculum-stage" key={`${stage}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{stage}</b><i className={index < Math.floor(room.progress / 25) ? 'stage-done' : ''}>{index < Math.floor(room.progress / 25) ? <Check size={12} /> : null}</i></div>)}</div><div className="curriculum-progress"><div><span>Room progress</span><b>{room.progress}%</b></div><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div></div></section>
        <section className="challenge-card"><div className="challenge-head"><span><Sparkles size={16} /> DAILY CHALLENGE</span><button className="challenge-refresh" onClick={() => generateChallenge.mutate({ roomId }, { onSuccess: refreshRoom })} disabled={generateChallenge.isPending} aria-label="Generate a new daily challenge" data-testid="button-generate-challenge">{generateChallenge.isPending ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}</button></div>{room.challenge ? <><div className="challenge-day">DAY {room.challenge.dayNumber}{room.challenge.completed && <span><Check size={12} /> DONE</span>}</div><p>{room.challenge.prompt}</p>{room.challenge.hint && <details><summary>Need a hint?</summary><span>{room.challenge.hint}</span></details>}</> : <><p>Ready for a small shared challenge?</p><button className="challenge-generate" onClick={() => generateChallenge.mutate({ roomId }, { onSuccess: refreshRoom })} disabled={generateChallenge.isPending} data-testid="button-create-challenge">{generateChallenge.isPending ? 'Thinking of one…' : 'Create today’s challenge'} <ArrowRight size={14} /></button></>}{generateChallenge.isError && <small className="challenge-error">Couldn’t make a challenge right now.</small>}</section>
      </aside>
    </div>
  </div></AppShell>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== id) cache.clear();
      previous.current = id;
    });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}

function RoutedPages() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={appearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your learning circle is right this way.' } }, signUp: { start: { title: 'Find your learning circle', subtitle: 'Start with a skill you can share.' } } }}
    routerPush={(to: string) => setLocation(stripBase(to))}
    routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
        <Route path="/profile"><Protected><ProfilePage /></Protected></Route>
        <Route path="/matches"><Protected><MatchesPage /></Protected></Route>
        <Route path="/rooms"><Protected><RoomsPage /></Protected></Route>
        <Route path="/rooms/:roomId"><Protected><RoomDetailPage /></Protected></Route>
        <Route component={NotFoundPage} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function NotFoundPage() {
  return <div className="not-found"><Brand /><span className="eyebrow">THIS PAGE GOT LOST ON THE WAY TO CLASS</span><h1 className="display">Not quite the<br />right room.</h1><p>Let’s get you back to your learning circle.</p><Link href="/" className="button">Back to SkillSync <ArrowRight size={15} /></Link></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><RoutedPages /></WouterRouter>;
}

export default App;
