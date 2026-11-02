import { useEffect, useState, type FormEvent } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, GraduationCap, HeartHandshake, Lightbulb, LoaderCircle, MessageCircle, Plus, Sparkles, Users, WandSparkles } from 'lucide-react';
import {
  getGetSkillSyncDashboardQueryKey, getGetSkillSyncMatchesQueryKey, getGetSkillSyncProfileQueryKey, getGetSkillSyncRoomsQueryKey,
  useConnectSkillSyncMatch, useGenerateSkillSyncRecommendations, useGetSkillSyncDashboard, useGetSkillSyncMatches,
  useGetSkillSyncProfile, useGetSkillSyncRooms, useSaveSkillSyncProfile,
} from '@workspace/api-client-react';
import type { MatchCandidate, ProfileInput, RoomSummary } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { AppShell, EmptyState, ErrorState, LoadingScreen, SectionHeader, StatusPill, initials } from '@/components/shell';
import { formatDate, useI18n } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/ai-error';

export function DashboardPage() {
  const query = useGetSkillSyncDashboard();
  const { t, locale } = useI18n();
  if (query.isLoading) return <AppShell active="/dashboard"><LoadingScreen /></AppShell>;
  if (query.isError || !query.data) return <AppShell active="/dashboard"><ErrorState onRetry={() => query.refetch()} /></AppShell>;
  const data = query.data;
  return <AppShell active="/dashboard"><div className="page-enter">
    <div className="welcome-row"><div><span className="eyebrow">{t('dashEyebrow')}</span><h1 className="display">{t('dashTitleA')} <i>{t('dashTitleB')}</i></h1><p>{t('dashDetail')}</p></div><Link href="/matches" className="button" data-testid="link-find-match"><Sparkles size={16} /> {t('findLearningMatch')}</Link></div>
    {!data.profileComplete && <div className="profile-nudge"><div className="nudge-icon"><GraduationCap size={20} /></div><div><b>{t('nudgeTitle')}</b><p>{t('nudgeDetail')}</p></div><Link href="/profile" className="text-link">{t('finishProfile')} <ArrowRight size={14} className="flip-rtl" /></Link></div>}
    <div className="stats-row">
      <StatTile label={t('statRooms')} value={data.stats.activeRooms} icon={BookOpen} accent="mint" />
      <StatTile label={t('statConnections')} value={data.stats.connectionsMade} icon={Users} accent="peach" />
      <StatTile label={t('statProjects')} value={data.stats.projectsSubmitted} icon={Lightbulb} accent="cream" />
    </div>
    <div className="dashboard-grid">
      <section className="panel rooms-panel"><div className="panel-heading"><div><span className="eyebrow">{t('sideBySide')}</span><h2>{t('yourRooms')}</h2></div><Link href="/rooms" className="quiet-link">{t('allRooms')} <ArrowRight size={14} className="flip-rtl" /></Link></div>
        {data.rooms.length ? <div className="room-list">{data.rooms.slice(0, 3).map((room) => <RoomRow room={room} key={room.roomId} />)}</div> : <EmptyState icon={BookOpen} title={t('tableWaiting')} detail={t('tableWaitingDetail')} action={<Link href="/matches" className="text-link">{t('meetMatch')} <ArrowRight size={14} className="flip-rtl" /></Link>} />}
      </section>
      <section className="panel match-panel"><div className="panel-heading"><div><span className="eyebrow">{t('goodFitEyebrow')}</span><h2>{t('peopleToLearn')}</h2></div><Link href="/matches" className="quiet-link">{t('seeAll')} <ArrowRight size={14} className="flip-rtl" /></Link></div>
        {data.recommendations.length ? <div className="mini-match-list">{data.recommendations.slice(0, 2).map((c) => <MiniMatch candidate={c} key={c.userId} />)}</div> : <EmptyState title={t('noSuggestions')} detail={t('noSuggestionsDetail')} action={<Link href="/profile" className="text-link">{t('shapeProfile')} <ArrowRight size={14} className="flip-rtl" /></Link>} />}
      </section>
    </div>
    <section className="activity-panel"><div className="panel-heading"><div><span className="eyebrow">{t('recentMoments')}</span><h2>{t('whatsHappening')}</h2></div><span className="activity-count">{t('recentCount', { n: data.recentActivity.length })}</span></div>{data.recentActivity.length ? <div className="activity-list">{data.recentActivity.slice(0, 6).map((a) => <div className="activity-item" key={a.id}><span className="activity-dot" /><div><b>{a.label}</b><p>{a.detail}</p></div><time>{formatDate(a.createdAt, locale, t('recently'))}</time></div>)}</div> : <div className="activity-empty"><span>{t('justStarting')}</span><Link href="/matches">{t('findMatch')} <ArrowRight size={14} className="flip-rtl" /></Link></div>}</section>
  </div></AppShell>;
}

function StatTile({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof BookOpen; accent: string }) {
  const { t } = useI18n();
  return <div className={`stat-tile ${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18} /></span></div><strong>{value}</strong><small>{t('andCounting')}</small></div>;
}

export function ProfilePage() {
  const query = useGetSkillSyncProfile();
  const save = useSaveSkillSyncProfile();
  const client = useQueryClient();
  const { user } = useUser();
  const { t } = useI18n();
  const [form, setForm] = useState<ProfileInput>({ displayName: '', university: '', teachSkill: '', learnSkill: '', bio: '' });
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data && !initialized) {
      const p = query.data.profile;
      setForm(p ? { displayName: p.displayName, university: p.university, teachSkill: p.teachSkill, learnSkill: p.learnSkill, bio: p.bio } : { displayName: user?.fullName || user?.firstName || '', university: '', teachSkill: '', learnSkill: '', bio: '' });
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
    <SectionHeader eyebrow={t('profileEyebrow')} title={t('profileTitle')} detail={t('profileDetail')} />
    <div className="profile-layout">
      <form className="panel profile-form" onSubmit={submit}>
        <div className="form-section-title"><span className="form-step">01</span><div><h2>{t('introTitle')}</h2><p>{t('introDetail')}</p></div></div>
        <div className="form-grid">
          <label className="field"><span>{t('yourName')}</span><input required maxLength={80} value={form.displayName} onChange={(e) => update('displayName', e.target.value)} placeholder={t('yourNamePh')} dir="auto" data-testid="input-display-name" /></label>
          <label className="field"><span>{t('university')}</span><input required maxLength={120} value={form.university} onChange={(e) => update('university', e.target.value)} placeholder={t('universityPh')} dir="auto" data-testid="input-university" /></label>
        </div>
        <label className="field"><span>{t('bio')} <small>{t('bioOptional')}</small></span><textarea maxLength={500} rows={3} value={form.bio} onChange={(e) => update('bio', e.target.value)} placeholder={t('bioPh')} dir="auto" data-testid="input-bio" /><small className="field-count">{form.bio.length}/500</small></label>
        <div className="form-divider" />
        <div className="form-section-title"><span className="form-step">02</span><div><h2>{t('exchangeTitle')}</h2><p>{t('exchangeDetail')}</p></div></div>
        <div className="form-grid">
          <label className="field skill-field"><span>{t('canShare')}</span><input required maxLength={80} value={form.teachSkill} onChange={(e) => update('teachSkill', e.target.value)} placeholder={t('canSharePh')} dir="auto" data-testid="input-teach-skill" /></label>
          <label className="field skill-field"><span>{t('loveToLearn')}</span><input required maxLength={80} value={form.learnSkill} onChange={(e) => update('learnSkill', e.target.value)} placeholder={t('loveToLearnPh')} dir="auto" data-testid="input-learn-skill" /></label>
        </div>
        <div className="form-submit-row">{saved && <span className="saved-note"><Check size={15} /> {t('profileSaved')}</span>}<button type="submit" className="button" disabled={save.isPending} data-testid="button-save-profile">{save.isPending && <LoaderCircle className="spin" size={16} />}{save.isPending ? t('saving') : t('saveProfile')} <ArrowRight size={15} className="flip-rtl" /></button></div>
        {save.isError && <p className="inline-error">{t('saveError')}</p>}
      </form>
      <aside className="profile-aside"><div className="profile-preview"><div className="preview-top"><span className="preview-tag">{t('yourIntroduction')}</span><ArrowUpRight size={17} className="preview-symbol" /></div><div className="preview-avatar">{form.displayName ? initials(form.displayName) : t('you')}</div><h3 dir="auto">{form.displayName || t('yourNameHere')}</h3><p dir="auto">{form.university || t('yourCampus')}</p>{form.bio && <blockquote dir="auto">{form.bio}</blockquote>}<div className="preview-skills"><div><small>{t('canShareCaps')}</small><b dir="auto">{form.teachSkill || t('yourSkill')}</b></div><ArrowLeftRight size={14} className="preview-swap" /><div><small>{t('curiousCaps')}</small><b dir="auto">{form.learnSkill || t('aNewSkill')}</b></div></div></div><div className="aside-tip"><span className="tip-icon"><Lightbulb size={18} /></span><div><b>{t('tipTitle')}</b><p>{t('tipDetail')}</p></div></div></aside>
    </div>
  </div></AppShell>;
}

export function MatchesPage() {
  const { t, locale } = useI18n();
  const request = { headers: { 'Accept-Language': locale } };
  const query = useGetSkillSyncMatches({ request });
  const generate = useGenerateSkillSyncRecommendations({ request });
  const connect = useConnectSkillSyncMatch({ request });
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [connectingId, setConnectingId] = useState('');
  const [errorId, setErrorId] = useState('');
  const recommendations = generate.data?.recommendations || query.data || [];
  const profileRequired =
    isProfileRequired(query.error) || isProfileRequired(generate.error);
  const startRoom = (candidate: MatchCandidate) => {
    setConnectingId(candidate.userId); setErrorId('');
    connect.mutate({ data: { partnerUserId: candidate.userId } }, {
      onSuccess: (room) => { client.invalidateQueries({ queryKey: getGetSkillSyncRoomsQueryKey() }); client.invalidateQueries({ queryKey: getGetSkillSyncDashboardQueryKey() }); setLocation(`/rooms/${room.roomId}`); },
      onError: () => setErrorId(candidate.userId),
      onSettled: () => setConnectingId(''),
    });
  };
  return <AppShell active="/matches"><div className="page-enter">
    <SectionHeader eyebrow={t('matchesEyebrow')} title={t('matchesTitle')} detail={t('matchesDetail')} action={<button className="button button-secondary" onClick={() => generate.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getGetSkillSyncMatchesQueryKey() }) })} disabled={generate.isPending} data-testid="button-refresh-matches">{generate.isPending ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />}{generate.isPending ? t('lookingAround') : t('findFresh')}</button>} />
    <div className="match-intro-strip"><div className="match-intro-icon"><HeartHandshake size={21} /></div><div><b>{t('matchIntroTitle')}</b><span>{t('matchIntroDetail')}</span></div><Plus className="intro-star" size={20} /></div>
    {generate.isError && (profileRequired ? <p className="inline-error">{t('matchProfileRequired')} <Link href="/profile">{t('setupProfile')}</Link></p> : <p className="inline-error">{aiErrorMessage(generate.error, t('actionError'))}</p>)}
    {query.isLoading && !generate.data ? <div className="match-grid">{[1, 2, 3, 4].map((i) => <div className="skeleton match-skeleton" key={i} />)}</div> : query.isError && !generate.data ? profileRequired
      ? <EmptyState title={t('matchProfileTitle')} detail={t('matchProfileRequired')} action={<Link href="/profile" className="button button-secondary">{t('setupProfile')} <ArrowRight size={15} className="flip-rtl" /></Link>} />
      : <ErrorState onRetry={() => query.refetch()} /> : recommendations.length ? <div className="match-grid">{recommendations.map((c, index) => <article className={`match-card ${index === 0 ? 'match-card-lead' : ''}`} key={c.userId} data-testid={`card-match-${c.userId}`}>
      <div className="match-card-top"><div className="match-avatar">{initials(c.displayName)}</div><div className="match-score"><span>{t('goodFit')}</span><b dir="ltr">{c.compatibilityScore}<small>%</small></b></div></div>
      <div className="match-name" dir="auto">{c.displayName}</div><div className="match-campus"><GraduationCap size={14} /> <span dir="auto">{c.university}</span></div>
      <div className="exchange-pair"><div><small>{t('theyShare')}</small><b dir="auto">{c.teachSkill}</b></div><ArrowLeftRight size={16} className="exchange-arrow" /><div><small>{t('theyLearn')}</small><b dir="auto">{c.learnSkill}</b></div></div>
      <p className="match-bio" dir="auto">{c.bio}</p><div className="why-match"><Sparkles size={14} /><span dir="auto">{c.whyMatch}</span></div>
      <button className="button match-action" onClick={() => startRoom(c)} disabled={connect.isPending} data-testid={`button-start-room-${c.userId}`}>{connectingId === c.userId ? <LoaderCircle className="spin" size={16} /> : <MessageCircle size={16} />}{connectingId === c.userId ? t('openingRoom') : t('startRoom')} <ArrowRight size={15} className="flip-rtl" /></button>
      {errorId === c.userId && <p className="inline-error">{aiErrorMessage(connect.error, t('roomOpenError'))}</p>}
     </article>)}</div> : <EmptyState title={t('noMatchesTitle')} detail={t('noMatchesDetail')} action={<Link href="/rooms" className="button button-secondary">{t('yourRooms')} <ArrowRight size={15} className="flip-rtl" /></Link>} />}
  </div></AppShell>;
}

function isProfileRequired(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'status' in error && (error as { status?: unknown }).status === 409;
}

export function RoomsPage() {
  const query = useGetSkillSyncRooms();
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  if (query.isLoading) return <AppShell active="/rooms"><LoadingScreen /></AppShell>;
  if (query.isError) return <AppShell active="/rooms"><ErrorState onRetry={() => query.refetch()} /></AppShell>;
  const rooms = (query.data || []).filter((room) => filter === 'all' || room.status === filter);
  const labels = { all: t('filterAll'), active: t('filterActive'), completed: t('filterCompleted') };
  return <AppShell active="/rooms"><div className="page-enter">
    <SectionHeader eyebrow={t('roomsEyebrow')} title={t('roomsTitle')} detail={t('roomsDetail')} action={<Link href="/matches" className="button" data-testid="link-find-partner"><Plus size={16} /> {t('findPartner')}</Link>} />
    <div className="room-filters">{(['all', 'active', 'completed'] as const).map((v) => <button key={v} className={filter === v ? 'filter-active' : ''} onClick={() => setFilter(v)} data-testid={`button-filter-${v}`}>{labels[v]}</button>)}</div>
    {rooms.length ? <div className="rooms-grid">{rooms.map((room) => <RoomCard room={room} key={room.roomId} />)}</div> : <EmptyState icon={BookOpen} title={filter === 'all' ? t('noRoomsTitle') : t('noFilteredRooms')} detail={filter === 'all' ? t('noRoomsDetail') : t('noFilteredRoomsDetail')} action={filter === 'all' && <Link href="/matches" className="button button-secondary">{t('meetMatch')} <ArrowRight size={15} className="flip-rtl" /></Link>} />}
  </div></AppShell>;
}

function RoomRow({ room }: { room: RoomSummary }) {
  const { t } = useI18n();
  return <Link href={`/rooms/${room.roomId}`} className="room-row" data-testid={`link-room-${room.roomId}`}><div className="room-person">{initials(room.partnerName)}</div><div className="room-row-main"><div className="room-row-title"><b dir="auto">{room.projectTitle}</b><StatusPill status={room.status} />{room.isDemo && <span className="demo-pill">{t('demo')}</span>}</div><span dir="auto">{room.lastMessage || t('learningWith', { name: room.partnerName })}</span></div><div className="room-progress-wrap"><span>{room.progress}%</span><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div></div><ChevronRight size={17} className="row-chevron flip-rtl" /></Link>;
}

function RoomCard({ room }: { room: RoomSummary }) {
  const { t, locale } = useI18n();
  return <Link href={`/rooms/${room.roomId}`} className="room-card" data-testid={`link-room-card-${room.roomId}`}><div className="room-card-top"><span className="room-card-id mono">{t('learningRoomCaps')}</span><span className="pill-group">{room.isDemo && <span className="demo-pill">{t('demo')}</span>}<StatusPill status={room.status} /></span></div><div className="room-card-title" dir="auto">{room.projectTitle}</div><div className="room-card-person"><span>{initials(room.partnerName)}</span> {t('withName', { name: room.partnerName })}</div><div className="room-card-bottom"><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div><b>{room.progress}%</b></div><div className="room-card-last" dir="auto">{room.lastMessage || t('readyForStep')}</div><div className="room-card-footer"><span><Clock3 size={13} /> {t('updated', { date: formatDate(room.updatedAt, locale, t('recently')) })}</span><ArrowUpRight size={16} /></div></Link>;
}

function MiniMatch({ candidate }: { candidate: MatchCandidate }) {
  return <div className="mini-match"><span className="mini-avatar">{initials(candidate.displayName)}</span><div><b dir="auto">{candidate.displayName}</b><small dir="auto">{candidate.teachSkill} / {candidate.learnSkill}</small></div><span className="mini-score">{candidate.compatibilityScore}%</span></div>;
}
