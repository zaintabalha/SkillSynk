import { useMemo, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, BarChart3, Check, Copy, Download, FileDown, Flag, KeyRound, LoaderCircle, Moon, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, Sun, TriangleAlert, Unlink, UserCheck, Users, WandSparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  getGetSkillSyncAdminOverviewQueryKey, getGetSkillSyncAdminReportQueryKey, getListSkillSyncAdminReportsQueryKey, getListSkillSyncAdminRoomsQueryKey, getListSkillSyncAdminUsersQueryKey,
  useGetSkillSyncAdminOverview, useGetSkillSyncAdminReport, useListSkillSyncAdminReports, useListSkillSyncAdminRooms, useListSkillSyncAdminUsers,
  useRegenerateSkillSyncAdminCurriculum, useSuspendSkillSyncAdminUser, useUnmatchSkillSyncAdminRoom, useUnsuspendSkillSyncAdminUser, useUpdateSkillSyncAdminReport, useWarnSkillSyncAdminUser,
} from '@workspace/api-client-react';
import type { AdminRoom, ListSkillSyncAdminReportsStatus, ReportUpdateInputStatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Brand, EmptyState, ErrorState, LanguageToggle, LoadingScreen, Modal, PortalSwitcher, StatusPill, initials, useAdminAccess } from '@/components/shell';
import { formatDate, formatTime, useI18n, type DictKey } from '@/lib/i18n';

const MIN = 60_000;
const intervals = [{ v: 0, k: 'autoOff' }, { v: 5 * MIN, k: 'every5' }, { v: 15 * MIN, k: 'every15' }, { v: 60 * MIN, k: 'every60' }] as const;
const statusKey: Record<string, DictKey> = { pending: 'statusPending', under_review: 'statusUnderReview', resolved: 'statusResolved' };
const pieColors = ['#d99676', '#e2c06f', '#5c8765'];

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminPage() {
  const access = useAdminAccess();
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  const body = access.isLoading ? <div className="admin-gate"><LoadingScreen /><p>{t('accessCheck')}</p></div>
    : access.isError ? <ErrorState onRetry={() => access.refetch()} />
    : !access.data?.isAdmin ? <AccessGate configured={!!access.data?.configured} />
    : <AdminDashboard />;
  return <div className={`admin-root ${dark ? 'dark' : ''}`}>
    <header className="admin-top no-print"><Brand /><PortalSwitcher current="admin" /><div className="admin-top-right"><LanguageToggle /><button className="admin-icon" onClick={() => setDark(!dark)} aria-label={t('darkMode')} title={t('darkMode')} data-testid="button-dark-mode">{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div></header>
    <main className="admin-main">{body}</main>
  </div>;
}

function AccessGate({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  const id = user?.id || '';
  return <div className="admin-gate page-enter"><span className="gate-icon">{configured ? <ShieldAlert size={24} /> : <KeyRound size={24} />}</span>
    <h1 className="display">{configured ? t('noAccessTitle') : t('unconfiguredTitle')}</h1>
    <p>{configured ? t('noAccessDetail') : t('unconfiguredDetail')}</p>
    {!configured && <div className="gate-id"><small>{t('yourUserId')}</small><div><code dir="ltr" data-testid="text-clerk-user-id">{id}</code><button onClick={() => { navigator.clipboard?.writeText(id); setCopied(true); }} data-testid="button-copy-user-id">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('copied') : t('copy')}</button></div><code className="gate-env" dir="ltr">SKILLSYNC_ADMIN_USER_IDS={id}</code></div>}
    <Link href="/dashboard" className="button button-secondary">{t('backToStudent')}</Link>
  </div>;
}

type AdminTab = 'overview' | 'reports' | 'users' | 'rooms';

function AdminDashboard() {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [interval, setIntervalMs] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date().toISOString());
  const refetchInterval = interval >= 5 * MIN ? interval : false;
  const refreshAll = () => {
    for (const key of [getGetSkillSyncAdminOverviewQueryKey(), getListSkillSyncAdminReportsQueryKey(), getListSkillSyncAdminUsersQueryKey(), getListSkillSyncAdminRoomsQueryKey()]) client.invalidateQueries({ queryKey: key });
    client.invalidateQueries({ queryKey: ['/api/skillsync/admin/reports'] });
    setRefreshedAt(new Date().toISOString());
  };
  const tabsDef: { id: AdminTab; label: DictKey; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'adminTabOverview', icon: BarChart3 }, { id: 'reports', label: 'adminTabReports', icon: Flag },
    { id: 'users', label: 'adminTabUsers', icon: Users }, { id: 'rooms', label: 'adminTabRooms', icon: ShieldCheck },
  ];
  return <div className="page-enter">
    <div className="admin-heading"><div><span className="eyebrow">{t('adminEyebrow')}</span><h1 className="display">{t('adminTitle')}</h1><p>{t('adminDetail')}</p></div>
      <div className="admin-controls no-print">
        <span className="admin-stamp mono">{t('lastRefresh', { time: formatTime(refreshedAt, locale) })}</span>
        <label className="admin-select"><span>{t('autoRefresh')}</span><select value={interval} onChange={(e) => setIntervalMs(Number(e.target.value))} data-testid="select-auto-refresh">{intervals.map((i) => <option key={i.v} value={i.v}>{t(i.k)}</option>)}</select></label>
        <button className="button button-secondary button-small" onClick={refreshAll} data-testid="button-admin-refresh"><RefreshCw size={14} /> {t('refresh')}</button>
        <button className="button button-small" onClick={() => window.print()} data-testid="button-export-pdf"><FileDown size={14} /> {t('exportPdf')}</button>
      </div></div>
    <nav className="admin-tabs no-print">{tabsDef.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'tab-active' : ''} onClick={() => setTab(id)} data-testid={`admin-tab-${id}`}><Icon size={15} />{t(label)}</button>)}</nav>
    {tab === 'overview' && <Overview refetchInterval={refetchInterval} />}
    {tab === 'reports' && <Reports refetchInterval={refetchInterval} />}
    {tab === 'users' && <UsersTable refetchInterval={refetchInterval} />}
    {tab === 'rooms' && <RoomsTable refetchInterval={refetchInterval} />}
  </div>;
}

type RI = { refetchInterval: number | false };

function ChartCard({ title, detail, onCsv, children }: { title: string; detail: string; onCsv: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return <section className="admin-card chart-card"><div className="chart-head"><div><h3>{title}</h3><p>{detail}</p></div><button className="admin-icon no-print" onClick={onCsv} title={t('exportCsv')} aria-label={t('exportCsv')} data-testid={`button-csv-${title}`}><Download size={15} /></button></div><div className="chart-body" dir="ltr">{children}</div></section>;
}

function Overview({ refetchInterval }: RI) {
  const { t } = useI18n();
  const q = useGetSkillSyncAdminOverview({ query: { queryKey: getGetSkillSyncAdminOverviewQueryKey(), refetchInterval } });
  if (q.isLoading) return <LoadingScreen />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const { stats, skillDistribution, reportStatuses, sampleDataIncluded } = q.data;
  const reportData = reportStatuses.map((r) => ({ name: t(statusKey[r.status] || 'statusPending'), value: r.count }));
  const aiData = [{ name: t('aiLive'), value: stats.geminiCalls }, { name: t('aiFallback'), value: stats.fallbackCalls }];
  const kpis: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: t('kpiStudents'), value: String(stats.totalStudents), sub: t('kpiDemoStudents', { n: stats.demoStudents }) },
    { label: t('kpiActiveRooms'), value: String(stats.activeRooms) },
    { label: t('kpiCompleted'), value: String(stats.completedProjects) },
    { label: t('kpiComplaints'), value: String(stats.openComplaints), tone: stats.openComplaints ? 'warn' : '' },
    { label: t('kpiConnections'), value: String(stats.connectionsMade), sub: t('kpiMatchAttempts', { n: stats.matchAttempts }) },
    { label: t('kpiMatchRate'), value: `${Math.round(stats.matchSuccessRate * 10) / 10}%`, sub: t('kpiMatchRateDetail') },
    { label: t('kpiAiActions'), value: String(stats.aiActions) },
  ];
  return <div className="admin-overview">
    {sampleDataIncluded && <div className="sample-flag"><TriangleAlert size={14} /> {t('sampleData')}</div>}
    <div className="kpi-grid">{kpis.map((k) => <div className={`kpi ${k.tone || ''}`} key={k.label}><span>{k.label}</span><b className="mono">{k.value}</b>{k.sub && <small>{k.sub}</small>}</div>)}</div>
    <div className="chart-grid">
      <ChartCard title={t('chartSkills')} detail={t('chartSkillsDetail')} onCsv={() => downloadCsv('skill-distribution', [['skill', 'count'], ...skillDistribution.map((s) => [s.skill, s.count])])}>
        {skillDistribution.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={skillDistribution} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><YAxis type="category" dataKey="skill" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="count" name={t('countLabel')} fill="#5c8765" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer> : <p className="chart-empty">{t('noChartData')}</p>}
      </ChartCard>
      <ChartCard title={t('chartReports')} detail={t('chartReportsDetail')} onCsv={() => downloadCsv('complaint-status', [['status', 'count'], ...reportStatuses.map((r) => [r.status, r.count])])}>
        {reportData.some((r) => r.value) ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={reportData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>{reportData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}</Pie><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer> : <p className="chart-empty">{t('noChartData')}</p>}
      </ChartCard>
      <ChartCard title={t('chartAi')} detail={t('chartAiDetail')} onCsv={() => downloadCsv('skillsync-ai-responses', [['type', 'count'], ['live', stats.geminiCalls], ['fallback', stats.fallbackCalls]])}>
        <ResponsiveContainer width="100%" height={280}><BarChart data={aiData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="value" name={t('countLabel')} radius={[6, 6, 0, 0]}>{aiData.map((_, i) => <Cell key={i} fill={i === 0 ? '#5c8765' : '#d99676'} />)}</Bar></BarChart></ResponsiveContainer>
      </ChartCard>
    </div>
  </div>;
}

function useInvalidateAdmin() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: getGetSkillSyncAdminOverviewQueryKey() });
    client.invalidateQueries({ queryKey: getListSkillSyncAdminUsersQueryKey() });
    client.invalidateQueries({ queryKey: getListSkillSyncAdminRoomsQueryKey() });
    client.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('/admin/reports') });
  };
}

function Reports({ refetchInterval }: RI) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<ListSkillSyncAdminReportsStatus | ''>('');
  const params = status ? { status } : undefined;
  const q = useListSkillSyncAdminReports(params, { query: { queryKey: getListSkillSyncAdminReportsQueryKey(params), refetchInterval } });
  const [selected, setSelected] = useState<string | null>(null);
  const list = q.data || [];
  return <div className="reports-layout">
    <section className="admin-card reports-list">
      <div className="list-head"><select value={status} onChange={(e) => setStatus(e.target.value as ListSkillSyncAdminReportsStatus | '')} data-testid="select-report-status"><option value="">{t('allStatuses')}</option>{Object.keys(statusKey).map((s) => <option key={s} value={s}>{t(statusKey[s])}</option>)}</select>
        <button className="admin-icon" onClick={() => downloadCsv('complaints', [['id', 'status', 'category', 'reporter', 'reported', 'room', 'summary', 'created'], ...list.map((r) => [r.id, r.status, r.category, r.reporterName, r.reportedName ?? '', r.roomTitle ?? '', r.summary, r.createdAt])])} title={t('exportCsv')} aria-label={t('exportCsv')}><Download size={15} /></button></div>
      {q.isLoading ? <div className="skeleton" style={{ height: 240 }} /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !list.length ? <EmptyState icon={Flag} title={t('noReports')} detail={t('noReportsDetail')} /> :
        list.map((r) => <button key={r.id} className={`report-row ${selected === r.id ? 'row-on' : ''}`} onClick={() => setSelected(r.id)} data-testid={`button-report-${r.id}`}>
          <span className={`rstatus s-${r.status}`}>{t(statusKey[r.status])}</span><b dir="auto">{r.summary}</b>
          <small><span dir="auto">{r.reporterName}</span>{r.reportedName && <> → <span dir="auto">{r.reportedName}</span></>} · {formatDate(r.createdAt, locale, t('recently'))}{r.isDemo && <> · {t('demo')}</>}</small>
        </button>)}
    </section>
    <section className="admin-card report-detail">{selected ? <ReportDetail key={selected} reportId={selected} /> : <EmptyState icon={Flag} title={t('selectReport')} detail={t('noReportsDetail')} />}</section>
  </div>;
}

function ReportDetail({ reportId }: { reportId: string }) {
  const { t, locale } = useI18n();
  const q = useGetSkillSyncAdminReport(reportId, { query: { enabled: !!reportId, queryKey: getGetSkillSyncAdminReportQueryKey(reportId) } });
  const update = useUpdateSkillSyncAdminReport();
  const invalidate = useInvalidateAdmin();
  const [status, setStatus] = useState<ReportUpdateInputStatus | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [warnFor, setWarnFor] = useState<{ id: string; name: string } | null>(null);
  const [suspendFor, setSuspendFor] = useState<{ id: string; name: string } | null>(null);
  if (q.isLoading) return <LoadingScreen />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const { report, transcript } = q.data;
  const curStatus = status ?? report.status;
  const curNotes = notes ?? report.adminNotes ?? '';
  return <div className="rd">
    <div className="rd-head"><span className={`rstatus s-${report.status}`}>{t(statusKey[report.status])}</span><h3 dir="auto">{report.summary}</h3><p dir="auto">{report.details}</p>
      <dl><div><dt>{t('reporter')}</dt><dd dir="auto">{report.reporterName}</dd></div><div><dt>{t('reported')}</dt><dd dir="auto">{report.reportedName || '—'}</dd></div><div><dt>{t('room')}</dt><dd dir="auto">{report.roomTitle || '—'}</dd></div><div><dt>{t('date')}</dt><dd>{formatDate(report.createdAt, locale, t('recently'))}</dd></div></dl>
      {report.reportedUserId && <div className="rd-actions"><button className="button button-secondary button-small" onClick={() => setWarnFor({ id: report.reportedUserId as string, name: report.reportedName || '' })} data-testid="button-report-warn"><TriangleAlert size={14} /> {t('warnUser')}</button><button className="button button-small danger" onClick={() => setSuspendFor({ id: report.reportedUserId as string, name: report.reportedName || '' })} data-testid="button-report-suspend"><Ban size={14} /> {t('suspendUser')}</button></div>}
    </div>
    <div className="rd-transcript"><span className="eyebrow">{t('transcript')}</span>{transcript.length ? transcript.map((m) => <div className={`tline ${m.senderType}`} key={m.id}><span className="mono">{formatTime(m.createdAt, locale)}</span><b dir="auto">{m.senderType === 'assistant' ? t('aiName') : m.senderName}</b><p dir="auto">{m.content}</p></div>) : <p className="chart-empty">{t('noTranscript')}</p>}</div>
    <div className="rd-review">
      <label className="field"><span>{t('status')}</span><select value={curStatus} onChange={(e) => setStatus(e.target.value as ReportUpdateInputStatus)} data-testid="select-review-status">{Object.keys(statusKey).map((s) => <option key={s} value={s}>{t(statusKey[s])}</option>)}</select></label>
      <label className="field"><span>{t('adminNotes')}</span><textarea rows={3} maxLength={2000} value={curNotes} onChange={(e) => setNotes(e.target.value)} placeholder={t('adminNotesPh')} dir="auto" data-testid="input-admin-notes" /></label>
      <div className="modal-actions">{update.isSuccess && <span className="saved-note"><Check size={14} /> {t('reviewSaved')}</span>}{update.isError && <span className="inline-error">{t('actionError')}</span>}<button className="button button-small" disabled={update.isPending} onClick={() => update.mutate({ reportId, data: { status: curStatus, adminNotes: curNotes || null } }, { onSuccess: invalidate })} data-testid="button-save-review">{update.isPending && <LoaderCircle size={14} className="spin" />}{t('saveReview')}</button></div>
    </div>
    {warnFor && <WarnDialog userId={warnFor.id} name={warnFor.name} onClose={() => setWarnFor(null)} />}
    {suspendFor && <SuspendDialog userId={suspendFor.id} name={suspendFor.name} onClose={() => setSuspendFor(null)} />}
  </div>;
}

function WarnDialog({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const warn = useWarnSkillSyncAdminUser();
  const invalidate = useInvalidateAdmin();
  const [message, setMessage] = useState('');
  return <Modal title={t('warnTitle', { name })} onClose={onClose}><div className="modal-form">
    <label className="field"><span>{t('warnMessage')}</span><textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('warnPh')} dir="auto" data-testid="input-warn-message" /></label>
    {warn.isError && <p className="inline-error">{t('actionError')}</p>}
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>{t('cancel')}</button><button className="button" disabled={message.trim().length < 4 || warn.isPending} onClick={() => warn.mutate({ userId, data: { message: message.trim() } }, { onSuccess: () => { invalidate(); onClose(); } })} data-testid="button-confirm-warn">{warn.isPending && <LoaderCircle size={14} className="spin" />}{t('sendWarning')}</button></div>
  </div></Modal>;
}

function SuspendDialog({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const suspend = useSuspendSkillSyncAdminUser();
  const invalidate = useInvalidateAdmin();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  return <Modal title={t('suspendTitle', { name })} onClose={onClose}><div className="modal-form">
    <label className="field"><span>{t('suspendReason')}</span><textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('suspendReasonPh')} dir="auto" data-testid="input-suspend-reason" /></label>
    <label className="field"><span>{t('duration')}</span><input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} placeholder={t('durationPh')} data-testid="input-suspend-days" /></label>
    {suspend.isError && <p className="inline-error">{t('actionError')}</p>}
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>{t('cancel')}</button><button className="button danger" disabled={reason.trim().length < 4 || suspend.isPending} onClick={() => suspend.mutate({ userId, data: { reason: reason.trim(), durationDays: days.trim() ? Number(days) : null } }, { onSuccess: () => { invalidate(); onClose(); } })} data-testid="button-confirm-suspend">{suspend.isPending && <LoaderCircle size={14} className="spin" />}{t('confirmSuspend')}</button></div>
  </div></Modal>;
}

function UsersTable({ refetchInterval }: RI) {
  const { t, locale } = useI18n();
  const q = useListSkillSyncAdminUsers({ query: { queryKey: getListSkillSyncAdminUsersQueryKey(), refetchInterval } });
  const unsuspend = useUnsuspendSkillSyncAdminUser();
  const invalidate = useInvalidateAdmin();
  const [search, setSearch] = useState('');
  const [warnFor, setWarnFor] = useState<{ id: string; name: string } | null>(null);
  const [suspendFor, setSuspendFor] = useState<{ id: string; name: string } | null>(null);
  const users = useMemo(() => { const s = search.trim().toLowerCase(); return (q.data || []).filter((u) => !s || [u.displayName, u.university, u.teachSkill, u.learnSkill].some((v) => v.toLowerCase().includes(s))); }, [q.data, search]);
  if (q.isLoading) return <LoadingScreen />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return <section className="admin-card">
    <div className="list-head"><label className="admin-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchUsers')} data-testid="input-search-users" /></label><button className="admin-icon" onClick={() => downloadCsv('users', [['userId', 'name', 'university', 'teaches', 'learns', 'rooms', 'warnings', 'suspended', 'demo'], ...users.map((u) => [u.userId, u.displayName, u.university, u.teachSkill, u.learnSkill, u.roomCount, u.warningCount, u.isSuspended ? 'yes' : 'no', u.isDemo ? 'yes' : 'no'])])} title={t('exportCsv')} aria-label={t('exportCsv')}><Download size={15} /></button></div>
    {!users.length ? <EmptyState icon={Users} title={t('noUsers')} detail={t('searchUsers')} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{t('name')}</th><th>{t('teaches')}</th><th>{t('learns')}</th><th>{t('rooms')}</th><th>{t('warnings')}</th><th>{t('status')}</th><th>{t('joined')}</th><th className="no-print">{t('actions')}</th></tr></thead><tbody>{users.map((u) => <tr key={u.userId} data-testid={`row-user-${u.userId}`}>
      <td><span className="cell-person"><span className="mini-avatar">{initials(u.displayName)}</span><span><b dir="auto">{u.displayName}</b><small dir="auto">{u.university}{u.isDemo && ` · ${t('demo')}`}</small></span></span></td>
      <td dir="auto">{u.teachSkill}</td><td dir="auto">{u.learnSkill}</td><td className="mono">{u.roomCount}</td><td className="mono">{u.warningCount}</td>
      <td>{u.isSuspended ? <span className="rstatus s-suspended">{t('suspended')} · {u.suspensionEndsAt ? t('suspendedUntil', { date: formatDate(u.suspensionEndsAt, locale, '') }) : t('indefinite')}</span> : <span className="rstatus s-resolved">{t('active')}</span>}</td>
      <td>{formatDate(u.createdAt, locale, t('recently'))}</td>
      <td className="no-print"><span className="row-actions"><button onClick={() => setWarnFor({ id: u.userId, name: u.displayName })} data-testid={`button-warn-${u.userId}`}><TriangleAlert size={13} /> {t('warnUser')}</button>{u.isSuspended ? <button onClick={() => unsuspend.mutate({ userId: u.userId }, { onSuccess: invalidate })} disabled={unsuspend.isPending} data-testid={`button-unsuspend-${u.userId}`}><UserCheck size={13} /> {t('unsuspendUser')}</button> : <button className="danger-text" onClick={() => setSuspendFor({ id: u.userId, name: u.displayName })} data-testid={`button-suspend-${u.userId}`}><Ban size={13} /> {t('suspendUser')}</button>}</span></td>
    </tr>)}</tbody></table></div>}
    {unsuspend.isError && <p className="inline-error">{t('actionError')}</p>}
    {warnFor && <WarnDialog userId={warnFor.id} name={warnFor.name} onClose={() => setWarnFor(null)} />}
    {suspendFor && <SuspendDialog userId={suspendFor.id} name={suspendFor.name} onClose={() => setSuspendFor(null)} />}
  </section>;
}

function RoomsTable({ refetchInterval }: RI) {
  const { t, locale } = useI18n();
  const q = useListSkillSyncAdminRooms({ query: { queryKey: getListSkillSyncAdminRoomsQueryKey(), refetchInterval } });
  const unmatch = useUnmatchSkillSyncAdminRoom();
  const regen = useRegenerateSkillSyncAdminCurriculum();
  const invalidate = useInvalidateAdmin();
  const [confirm, setConfirm] = useState<AdminRoom | null>(null);
  const [regenDone, setRegenDone] = useState<string | null>(null);
  if (q.isLoading) return <LoadingScreen />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rooms = q.data || [];
  return <section className="admin-card">
    <div className="list-head"><span className="eyebrow">{t('adminTabRooms')} · {rooms.length}</span><button className="admin-icon" onClick={() => downloadCsv('rooms', [['roomId', 'project', 'partners', 'status', 'progress', 'demo', 'updated'], ...rooms.map((r) => [r.roomId, r.projectTitle, r.partnerNames.join(' / '), r.status, r.progress, r.isDemo ? 'yes' : 'no', r.updatedAt])])} title={t('exportCsv')} aria-label={t('exportCsv')}><Download size={15} /></button></div>
    {!rooms.length ? <EmptyState title={t('noRooms')} detail={t('adminDetail')} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{t('project')}</th><th>{t('partners')}</th><th>{t('status')}</th><th>{t('progress')}</th><th>{t('date')}</th><th className="no-print">{t('actions')}</th></tr></thead><tbody>{rooms.map((r) => <tr key={r.roomId} data-testid={`row-room-${r.roomId}`}>
      <td><b dir="auto">{r.projectTitle}</b>{r.isDemo && <small className="demo-pill">{t('demo')}</small>}</td><td dir="auto">{r.partnerNames.join(' · ')}</td><td><StatusPill status={r.status} /></td>
      <td><span className="cell-progress"><span className="progress-track"><i style={{ width: `${r.progress}%` }} /></span><span className="mono">{r.progress}%</span></span></td><td>{formatDate(r.updatedAt, locale, t('recently'))}</td>
      <td className="no-print"><span className="row-actions"><button onClick={() => regen.mutate({ roomId: r.roomId }, { onSuccess: () => { setRegenDone(r.roomId); invalidate(); } })} disabled={regen.isPending || r.status === 'unmatched'} data-testid={`button-regen-${r.roomId}`}>{regen.isPending && regen.variables?.roomId === r.roomId ? <LoaderCircle size={13} className="spin" /> : regenDone === r.roomId ? <Check size={13} /> : <WandSparkles size={13} />} {regenDone === r.roomId ? t('curriculumRegenerated') : t('regenerate')}</button><button className="danger-text" onClick={() => setConfirm(r)} disabled={r.status === 'unmatched'} data-testid={`button-unmatch-${r.roomId}`}><Unlink size={13} /> {t('unmatch')}</button></span></td>
    </tr>)}</tbody></table></div>}
    {(regen.isError) && <p className="inline-error">{t('actionError')}</p>}
    {confirm && <Modal title={t('unmatch')} detail={t('unmatchConfirm', { names: confirm.partnerNames.join(' & ') })} onClose={() => setConfirm(null)}><div className="modal-actions">{unmatch.isError && <span className="inline-error">{t('actionError')}</span>}<button className="quiet-button" onClick={() => setConfirm(null)}><RotateCcw size={13} /> {t('cancel')}</button><button className="button danger" disabled={unmatch.isPending} onClick={() => unmatch.mutate({ roomId: confirm.roomId }, { onSuccess: () => { invalidate(); setConfirm(null); } })} data-testid="button-confirm-unmatch">{unmatch.isPending && <LoaderCircle size={14} className="spin" />}{t('confirmUnmatch')}</button></div></Modal>}
  </section>;
}
