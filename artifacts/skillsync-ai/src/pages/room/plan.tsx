import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Flag, Lightbulb, LoaderCircle, Plus, RefreshCw, Route, Send } from 'lucide-react';
import { getGetSkillSyncRoomQueryKey, useGenerateSkillSyncDailyChallenge, useSubmitSkillSyncProject } from '@workspace/api-client-react';
import type { LearningRoom } from '@workspace/api-client-react';
import { EmptyState } from '@/components/shell';
import { formatDate, useI18n } from '@/lib/i18n';

export function PlanTab({ room }: { room: LearningRoom }) {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const challenge = useGenerateSkillSyncDailyChallenge();
  const submit = useSubmitSkillSyncProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(room.roomId) });
  const stages = room.curriculum.stages;
  const doneCount = Math.round((room.progress / 100) * stages.length);
  const send = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate({ roomId: room.roomId, data: { title: title.trim(), content: content.trim() } }, { onSuccess: () => { setTitle(''); setContent(''); setOpen(false); refresh(); } });
  };
  const c = room.challenge;
  return <div className="plan-layout">
    <section className="plan-path">
      <div className="aside-card-top"><span className="aside-card-icon"><Route size={15} /></span><span className="eyebrow">{t('sharedPath')}</span></div>
      <h2 dir="auto">{room.curriculum.title}</h2><p dir="auto">{room.curriculum.description}</p>
      <div className="curriculum-goal"><small>{t('theGoal')}</small><b dir="auto">{room.curriculum.goal}</b></div>
      <ol className="plan-stages">{stages.map((s, i) => <li key={i} className={i < doneCount ? 'stage-done' : i === doneCount ? 'stage-now' : ''}><span className="mono">{String(i + 1).padStart(2, '0')}</span><b dir="auto">{s}</b><i>{i < doneCount && <Check size={11} />}</i></li>)}</ol>
      <div className="curriculum-progress"><div><span>{t('roomProgress')}</span><b>{room.progress}%</b></div><div className="progress-track"><i style={{ width: `${room.progress}%` }} /></div></div>
      <div className="challenge-card plan-challenge">
        <div className="challenge-head"><span><Flag size={13} /> {t('dailyChallenge')}</span><button className="challenge-refresh" onClick={() => challenge.mutate({ roomId: room.roomId }, { onSuccess: refresh })} disabled={challenge.isPending} aria-label={t('newChallenge')} data-testid="button-new-challenge">{challenge.isPending ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />}</button></div>
        {c ? <><div className="challenge-day">{t('day', { n: c.dayNumber })}{c.completed && <span><Check size={10} /> {t('done')}</span>}</div><p dir="auto">{c.prompt}</p><details><summary>{t('needHint')}</summary><span dir="auto">{c.hint}</span></details></> : <><p>{t('challengeReady')}</p><button className="challenge-generate" onClick={() => challenge.mutate({ roomId: room.roomId }, { onSuccess: refresh })} disabled={challenge.isPending}>{challenge.isPending ? t('thinkingChallenge') : t('createChallenge')} <Plus size={13} /></button></>}
        {challenge.isError && <span className="challenge-error">{t('challengeError')}</span>}
      </div>
    </section>
    <section className="plan-eval project-view">
      <div className="project-top"><div><span className="eyebrow">{t('madeTogether')}</span><h2>{t('sharedProject')}</h2><p>{t('sharedProjectDetail')}</p></div>{!open && <button className="button" onClick={() => setOpen(true)} data-testid="button-open-submission"><Plus size={15} /> {t('shareSubmission')}</button>}</div>
      {open && <form className="submission-form" onSubmit={send}>
        <label className="field"><span>{t('projectTitle')}</span><input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" data-testid="input-project-title" /></label>
        <label className="field"><span>{t('whatMade')}</span><textarea required rows={6} maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('whatMadePh')} dir="auto" data-testid="input-project-content" /></label>
        {submit.isError && <p className="inline-error">{t('submitError')}</p>}
        <div className="submission-actions"><button type="button" className="quiet-link" onClick={() => setOpen(false)}>{t('cancel')}</button><button className="button" disabled={submit.isPending || !title.trim() || !content.trim()} data-testid="button-submit-project">{submit.isPending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} className="flip-rtl" />}{submit.isPending ? t('sendingFeedback') : t('submitFeedback')}</button></div>
      </form>}
      {room.submissions.length ? <div className="submission-list">{room.submissions.map((s) => <article className="submission-card" key={s.id}>
        <div className="submission-heading"><div><span className="eyebrow">{t('submissionCaps', { date: formatDate(s.submittedAt, locale, t('recently')) })}</span><h3 dir="auto">{s.title}</h3></div><div className="overall-score"><b>{s.overallScore}</b><small>{t('overall')}</small></div></div>
        <p className="submission-content" dir="auto">{s.content}</p>
        <div className="evaluation-grid"><div><span>{t('technical')}</span><b>{s.technicalScore}<small>/100</small></b><p dir="auto">{s.technicalFeedback}</p></div><div><span>{t('communication')}</span><b>{s.communicationScore}<small>/100</small></b><p dir="auto">{s.communicationFeedback}</p></div></div>
        {s.nextSteps.length > 0 && <div className="next-steps"><b>{t('nextSteps')}</b>{s.nextSteps.map((n, i) => <p key={i}><Lightbulb size={12} /><span dir="auto">{n}</span></p>)}</div>}
      </article>)}</div> : !open && <EmptyState icon={Lightbulb} title={t('projectEmptyTitle')} detail={t('projectEmptyDetail')} action={<button className="button button-secondary" onClick={() => setOpen(true)}>{t('firstSubmission')}</button>} />}
    </section>
  </div>;
}
