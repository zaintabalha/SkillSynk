import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { ArrowLeft, Flag, FlaskConical, Layers, MessageCircle, Route, Sparkles, Video } from 'lucide-react';
import { getGetSkillSyncRoomQueryKey, useGetSkillSyncRoom } from '@workspace/api-client-react';
import { Link, useParams } from 'wouter';
import { AppShell, ErrorState, LoadingScreen, StatusPill } from '@/components/shell';
import { ReportDialog } from '@/components/report-dialog';
import { useI18n, type DictKey } from '@/lib/i18n';
import { AiChat, PartnerChat } from './chat';
import { ActivitiesTab } from './activities';
import { PlanTab } from './plan';
import { VideoRoom } from './video';

type Tab = 'partner' | 'ai' | 'activities' | 'plan' | 'video';
const tabs: { id: Tab; label: DictKey; icon: typeof MessageCircle }[] = [
  { id: 'partner', label: 'tabPartner', icon: MessageCircle },
  { id: 'ai', label: 'tabAi', icon: Sparkles },
  { id: 'activities', label: 'tabActivities', icon: Layers },
  { id: 'plan', label: 'tabPlan', icon: Route },
  { id: 'video', label: 'tabVideo', icon: Video },
];

export function RoomDetailPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId || '';
  const { t } = useI18n();
  const { user } = useUser();
  const query = useGetSkillSyncRoom(roomId, { query: { queryKey: getGetSkillSyncRoomQueryKey(roomId), enabled: !!roomId, refetchInterval: 3000 } });
  const [tab, setTab] = useState<Tab>('partner');
  const [activityId, setActivityId] = useState<string | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const room = query.data;
  const participants = room?.participants || [];
  const simEnabled = !!room?.isDemo && participants.length >= 2;
  const firstParticipant = participants[0]?.userId;
  useEffect(() => { if (simEnabled && !participants.some((p) => p.userId === actingUserId) && firstParticipant) setActingUserId(firstParticipant); }, [simEnabled, actingUserId, firstParticipant, roomId, participants]);
  const openActivity = useCallback((id: string) => { setActivityId(id); setTab('activities'); }, []);
  const selectActivity = useCallback((id: string) => setActivityId(id), []);

  if (query.isLoading) return <AppShell active="/rooms" wide><LoadingScreen /></AppShell>;
  if (query.isError || !room) return <AppShell active="/rooms" wide><ErrorState label={t('roomOpenErrorLabel')} onRetry={() => query.refetch()} /></AppShell>;
  const acting = simEnabled ? actingUserId : null;
  const counts: Record<Tab, number | null> = { partner: room.messages.filter((m) => m.channel === 'partner').length, ai: room.messages.filter((m) => m.channel === 'ai').length, activities: room.activities.length, plan: null, video: null };

  return <AppShell active="/rooms" wide><div className="room-full page-enter">
    <Link href="/rooms" className="back-link"><ArrowLeft size={14} className="flip-rtl" /> {t('allLearningRooms')}</Link>
    <div className="room-detail-heading"><div><span className="eyebrow">{t('roomEyebrow', { name: room.partnerName })}</span><h1 className="display" dir="auto">{room.projectTitle}</h1><p className="room-head-pills"><StatusPill status={room.status} />{room.isDemo && <span className="demo-pill">{t('demo')}</span>}<span className="mono">{room.progress}%</span></p></div>
      <button className="button button-secondary button-small" onClick={() => setReporting(true)} data-testid="button-report-room"><Flag size={14} /> {t('reportIssue')}</button></div>
    {simEnabled && <div className="sim-bar" data-testid="simulation-toggle"><span className="sim-badge"><FlaskConical size={14} /> {t('simulationMode')}</span><p>{t('simulationDetail')}</p><div className="sim-switch" role="radiogroup" aria-label={t('actingAs')}>{participants.slice(0, 2).map((p, i) => <button key={p.userId} role="radio" aria-checked={actingUserId === p.userId} className={actingUserId === p.userId ? 'sim-on' : ''} onClick={() => setActingUserId(p.userId)} data-testid={`button-act-as-${i === 0 ? 'a' : 'b'}`}><b>{i === 0 ? t('userA') : t('userB')}</b><span dir="auto">{p.displayName}</span></button>)}</div></div>}
    <nav className="room-tabbar" role="tablist">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab-active' : ''} onClick={() => setTab(id)} data-testid={`tab-${id}`}><Icon size={15} /><span>{t(label)}</span>{counts[id] !== null && <em>{counts[id]}</em>}</button>)}</nav>
    {room.status === 'unmatched' && <p role="status">{t('roomReadOnly')}</p>}
    <div className="room-stage">
      <div hidden={tab !== 'partner'} className="room-tab-panel">{tab === 'partner' && <PartnerChat room={room} actingUserId={acting} viewerId={user?.id ?? null} onOpenActivity={openActivity} />}</div>
      <div hidden={tab !== 'ai'} className="room-tab-panel">{tab === 'ai' && <AiChat room={room} actingUserId={acting} viewerId={user?.id ?? null} onOpenActivity={openActivity} />}</div>
      <div hidden={tab !== 'activities'} className="room-tab-panel">{tab === 'activities' && <ActivitiesTab room={room} actingUserId={acting} selectedId={activityId} onSelect={selectActivity} />}</div>
      <div hidden={tab !== 'plan'} className="room-tab-panel">{tab === 'plan' && <PlanTab room={room} />}</div>
      <div hidden={tab !== 'video'} className="room-tab-panel"><VideoRoom room={room} actingUserId={acting} viewerId={user?.id ?? null} onOpenActivity={openActivity} selectedId={activityId} onSelectActivity={selectActivity} /></div>
    </div>
    {reporting && <ReportDialog roomId={room.roomId} reportedUserId={room.partnerUserId} onClose={() => setReporting(false)} />}
  </div></AppShell>;
}
