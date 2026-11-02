import { aiErrorMessage } from '@/lib/ai-error';
import { runJavaScriptInSandbox, type SimulatorRunResult } from '@/lib/simulator-sandbox';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleDashed, Code2, Eye, EyeOff, Languages, Layers, ListChecks, LoaderCircle, Play, RotateCcw, Sparkles, Terminal, WandSparkles, X } from 'lucide-react';
import { getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey, useGenerateSkillSyncActivity, useGenerateSkillSyncSimulatorSolution, useListSkillSyncActivities, useSubmitSkillSyncActivityAttempt } from '@workspace/api-client-react';
import type { ActivityAttemptInput, ActivityGenerationInputKind, LearningRoom, SharedActivity } from '@workspace/api-client-react';
import { EmptyState, ErrorState, initials } from '@/components/shell';
import { formatDate, useI18n, type DictKey } from '@/lib/i18n';

const kindMeta: Record<string, { label: DictKey; icon: typeof ListChecks }> = {
  quiz: { label: 'kindQuiz', icon: ListChecks },
  flashcards: { label: 'kindFlashcards', icon: Layers },
  simulator: { label: 'kindSimulator', icon: Code2 },
};

type Props = { room: LearningRoom; actingUserId: string | null; selectedId: string | null; onSelect: (id: string) => void };

export function ActivitiesTab({ room, actingUserId, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const client = useQueryClient();
  const query = useListSkillSyncActivities(room.roomId, { query: { queryKey: getListSkillSyncActivitiesQueryKey(room.roomId), refetchInterval: 3000, initialData: room.activities } });
  const generate = useGenerateSkillSyncActivity();
  const [kind, setKind] = useState<ActivityGenerationInputKind>('quiz');
  const [prompt, setPrompt] = useState('');
  const activities = query.data || [];
  const selected = activities.find((a) => a.id === selectedId) || null;
  useEffect(() => { if (!selectedId && activities[0]) onSelect(activities[0].id); }, [selectedId, activities, onSelect]);
  const refresh = () => { client.invalidateQueries({ queryKey: getListSkillSyncActivitiesQueryKey(room.roomId) }); client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(room.roomId) }); };
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    generate.mutate({ roomId: room.roomId, data: { kind, prompt: prompt.trim() } }, { onSuccess: (a) => { setPrompt(''); refresh(); onSelect(a.id); } });
  };
  return <div className="activities-layout">
    <aside className="activity-rail">
      <div className="rail-head"><span className="eyebrow">{t('activitiesTitle')}</span><p>{t('activitiesDetail')}</p></div>
      <form className="activity-create" onSubmit={create}>
        <div className="kind-switch">{(['quiz', 'flashcards', 'simulator'] as const).map((k) => { const M = kindMeta[k]; return <button type="button" key={k} className={kind === k ? 'kind-on' : ''} onClick={() => setKind(k)} data-testid={`button-kind-${k}`}><M.icon size={13} />{t(M.label)}</button>; })}</div>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('activityPromptPh')} maxLength={300} dir="auto" data-testid="input-activity-prompt" />
        <button className="button button-small" disabled={!prompt.trim() || generate.isPending} data-testid="button-generate-activity">{generate.isPending ? <LoaderCircle size={14} className="spin" /> : <WandSparkles size={14} />}{generate.isPending ? t('generating') : t('generateActivity')}</button>
        {generate.isError && <p className="inline-error">{aiErrorMessage(generate.error, t('activityError'))}</p>}
      </form>
      <div className="activity-items">{activities.map((a) => { const M = kindMeta[a.kind] || kindMeta.quiz; return <button key={a.id} className={`activity-pick ${a.id === selectedId ? 'pick-on' : ''}`} onClick={() => onSelect(a.id)} data-testid={`button-activity-${a.id}`}><span className="pick-icon"><M.icon size={15} /></span><span className="pick-body"><b dir="auto">{a.title}</b><small>{t(M.label)} · {t('attemptsCount', { n: a.attempts.length })}</small></span></button>; })}</div>
    </aside>
    <section className="activity-stage">
      {query.isError && !activities.length ? <ErrorState label={t('activityLoadError')} onRetry={() => query.refetch()} /> :
        !activities.length ? <EmptyState icon={Sparkles} title={t('noActivitiesTitle')} detail={t('noActivitiesDetail')} /> :
        !selected ? <EmptyState title={t('selectActivity')} detail={t('activitiesDetail')} /> :
        <ActivityView key={`${selected.id}-${actingUserId ?? 'me'}`} activity={selected} room={room} actingUserId={actingUserId} onDone={refresh} />}
    </section>
  </div>;
}

function useAttempt(room: LearningRoom, activity: SharedActivity, actingUserId: string | null, onDone: () => void) {
  const submit = useSubmitSkillSyncActivityAttempt();
  const send = (responses: string[]) => {
    const data: ActivityAttemptInput = { responses, simulatedUserId: actingUserId };
    submit.mutate({ roomId: room.roomId, activityId: activity.id, data }, { onSuccess: onDone });
  };
  return { send, submit };
}

function ActivityView({ activity, room, actingUserId, onDone }: { activity: SharedActivity; room: LearningRoom; actingUserId: string | null; onDone: () => void }) {
  const { t } = useI18n();
  const M = kindMeta[activity.kind] || kindMeta.quiz;
  return <div className="activity-view page-enter">
    <header className="activity-head"><span className="activity-kind"><M.icon size={14} /> {t(M.label)}</span><h2 dir="auto">{activity.title}</h2><p dir="auto">{activity.instructions}</p></header>
      <div className={`activity-body ${activity.kind === 'simulator' ? 'simulator-body' : ''}`}>
      <div className="activity-work">
        {activity.kind === 'quiz' && <QuizRunner activity={activity} room={room} actingUserId={actingUserId} onDone={onDone} />}
        {activity.kind === 'flashcards' && <FlashcardRunner activity={activity} room={room} actingUserId={actingUserId} onDone={onDone} />}
        {activity.kind === 'simulator' && <SimulatorRunner activity={activity} room={room} actingUserId={actingUserId} onDone={onDone} />}
      </div>
      <AttemptStatus activity={activity} room={room} />
    </div>
  </div>;
}

type RunnerProps = { activity: SharedActivity; room: LearningRoom; actingUserId: string | null; onDone: () => void };

function QuizRunner({ activity, room, actingUserId, onDone }: RunnerProps) {
  const { t } = useI18n();
  const questions = activity.content.questions || [];
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const { send, submit } = useAttempt(room, activity, actingUserId, onDone);
  const done = submit.isSuccess;
  return <div className="quiz">
    {questions.map((q, qi) => <fieldset className="quiz-q" key={q.id}><legend><span className="mono">{t('question', { n: qi + 1 })}</span><b dir="auto">{q.prompt}</b></legend>
      <div className="quiz-choices">{q.choices.map((c, ci) => { const picked = answers[qi] === ci; const state = done ? (ci === q.answerIndex ? 'choice-right' : picked ? 'choice-wrong' : '') : picked ? 'choice-picked' : ''; return <button type="button" key={ci} disabled={done} className={`quiz-choice ${state}`} onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))} data-testid={`button-choice-${qi}-${ci}`}><span className="choice-letter">{String.fromCharCode(65 + ci)}</span><span dir="auto">{c}</span>{done && ci === q.answerIndex && <Check size={14} />}{done && picked && ci !== q.answerIndex && <X size={14} />}</button>; })}</div>
      {done && <p className={`quiz-explain ${answers[qi] === q.answerIndex ? 'ok' : 'no'}`}><b>{answers[qi] === q.answerIndex ? t('correct') : t('incorrect')}.</b> <span dir="auto">{q.explanation}</span></p>}
    </fieldset>)}
    <div className="runner-actions">{done && <span className="saved-note"><Check size={14} /> {t('attemptSaved')}</span>}{done ? <button className="button button-secondary button-small" onClick={() => { submit.reset(); setAnswers(questions.map(() => null)); }}><RotateCcw size={14} /> {t('tryAgain')}</button> : <button className="button button-small" disabled={answers.some((a) => a === null) || submit.isPending} onClick={() => send(answers.map((a) => String(a)))} data-testid="button-submit-quiz">{submit.isPending && <LoaderCircle size={14} className="spin" />}{t('submitAnswers')}</button>}</div>
    {submit.isError && <p className="inline-error">{t('attemptError')}</p>}
  </div>;
}

function FlashcardRunner({ activity, room, actingUserId, onDone }: RunnerProps) {
  const { t } = useI18n();
  const cards = activity.content.flashcards || [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<string[]>([]);
  const { send, submit } = useAttempt(room, activity, actingUserId, onDone);
  const card = cards[index];
  const mark = (value: 'known' | 'review') => {
    const next = [...marks, value];
    setMarks(next); setFlipped(false);
    if (next.length >= cards.length) send(next); else setIndex(index + 1);
  };
  if (!card) return null;
  const finished = marks.length >= cards.length;
  return <div className="flash">
    <div className="flash-progress mono">{t('cardOf', { n: Math.min(index + 1, cards.length), total: cards.length })}</div>
    {!finished ? <>
      <button className={`flash-card ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={t('flip')} data-testid="button-flip-card">
        <span className="flash-face flash-front"><small>{t('front')}</small><b dir="auto">{card.front}</b></span>
        <span className="flash-face flash-back"><small>{t('back')}</small><b dir="auto">{card.back}</b></span>
      </button>
      <div className="runner-actions"><button className="button button-secondary button-small" onClick={() => mark('review')} disabled={!flipped} data-testid="button-card-review"><RotateCcw size={14} /> {t('reviewCard')}</button><button className="button button-small" onClick={() => mark('known')} disabled={!flipped} data-testid="button-card-known"><Check size={14} /> {t('gotItCard')}</button></div>
    </> : <div className="flash-done">{submit.isPending ? <LoaderCircle className="spin" size={18} /> : submit.isSuccess ? <span className="saved-note"><Check size={14} /> {t('attemptSaved')}</span> : null}<b>{marks.filter((m) => m === 'known').length} / {cards.length}</b><button className="button button-secondary button-small" onClick={() => { setMarks([]); setIndex(0); submit.reset(); }}><RotateCcw size={14} /> {t('tryAgain')}</button></div>}
    {submit.isError && <p className="inline-error">{t('attemptError')}</p>}
  </div>;
}

function SimulatorRunner({ activity, room, actingUserId, onDone }: RunnerProps) {
  const { t } = useI18n();
  const sim = activity.content.simulator;
  const [value, setValue] = useState(sim?.starter || '');
  const [hint, setHint] = useState(false);
  const [compare, setCompare] = useState(false);
  const [runResult, setRunResult] = useState<SimulatorRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const lineGutter = useRef<HTMLDivElement>(null);
  const { send, submit } = useAttempt(room, activity, actingUserId, onDone);
  const generateSolution = useGenerateSkillSyncSimulatorSolution();
  if (!sim) return null;
  const coding = sim.mode === 'coding';
  const score = submit.data?.score;
  const lineCount = Math.max(14, value.split('\n').length);
  const generateCode = () => generateSolution.mutate(
    { roomId: room.roomId, activityId: activity.id },
    { onSuccess: (result) => { setValue(result.code); setRunResult(null); } },
  );
  const runCode = async () => {
    setRunResult(null);
    setIsRunning(true);
    try {
      setRunResult(await runJavaScriptInSandbox(value));
    } catch {
      setRunResult({ ok: false, logs: [], error: t('simRunnerUnavailable') });
    } finally {
      setIsRunning(false);
    }
  };
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (coding && event.key === 'Tab') {
      event.preventDefault();
      const editor = event.currentTarget;
      editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
      setValue(editor.value);
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && value.trim() && !submit.isPending) {
      event.preventDefault();
      send([value]);
    }
  };

  return <div className="sim">
    <div className="sim-mode">{coding ? <Code2 size={14} /> : <Languages size={14} />} {coding ? t('codingSim') : t('languageSim')}</div>
    <section className="sim-brief">
      <div><small>{t('scenario')}</small><p dir="auto">{sim.scenario}</p></div>
      <div><small>{t('task')}</small><p dir="auto">{sim.prompt}</p></div>
    </section>
    <section className={`sim-editor-card ${coding ? 'is-code' : 'is-language'}`}>
      <header className="sim-editor-toolbar">
        <div><Terminal size={15} /><b>{t('yourResponse')}</b></div>
        <div className="sim-editor-toolbar-actions">
          {coding && <button type="button" className="sim-ai-solution-button" onClick={generateCode} disabled={generateSolution.isPending} data-testid="button-generate-simulator-solution">
            {generateSolution.isPending ? <LoaderCircle size={14} className="spin" /> : <WandSparkles size={14} />}
            {generateSolution.isPending ? t('simGeneratingSolution') : t('simGenerateSolution')}
          </button>}
          <span className="sim-file-label" dir="ltr">{coding ? 'solution.js' : t('languageResponse')}</span>
        </div>
      </header>
      <div className={`sim-editor-surface ${coding ? 'code-surface' : 'language-surface'}`} dir={coding ? 'ltr' : 'auto'}>
        {coding && <div className="sim-line-gutter" ref={lineGutter} aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>}
        <textarea
          value={value}
          onChange={(event) => { setValue(event.target.value); setRunResult(null); if (generateSolution.isSuccess || generateSolution.isError) generateSolution.reset(); }}
          onKeyDown={handleEditorKeyDown}
          onScroll={(event) => { if (lineGutter.current) lineGutter.current.scrollTop = event.currentTarget.scrollTop; }}
          rows={coding ? 18 : 14}
          maxLength={4000}
          spellCheck={!coding}
          dir={coding ? 'ltr' : 'auto'}
          className="sim-editor-input"
          aria-label={t('yourResponse')}
          data-testid="input-simulator"
        />
      </div>
      <footer className="sim-editor-footer">
        <span>{t('simulatorGradingNote')}</span>
        <span className="sim-char-count">{value.length}/4000</span>
      </footer>
    </section>
    {coding && generateSolution.isSuccess && <p className="sim-inline-success" role="status"><Check size={13} />{t('simSolutionGenerated')}</p>}
    {coding && generateSolution.isError && <p className="inline-error">{aiErrorMessage(generateSolution.error, t('simGenerateError'))}</p>}
    <div className="sim-tools">
      <button type="button" className="quiet-button" onClick={() => setHint((visible) => !visible)} data-testid="button-sim-hint">{hint ? <EyeOff size={14} /> : <Eye size={14} />}{hint ? t('hideHint') : t('showHint')}</button>
      <button type="button" className="quiet-button" onClick={() => setCompare((visible) => !visible)} data-testid="button-sim-compare">{compare ? <EyeOff size={14} /> : <Eye size={14} />}{compare ? t('hideExpected') : t('showExpected')}</button>
    </div>
    {hint && <div className="sim-note" dir="auto">{sim.hint}</div>}
    {compare && <div className="sim-note sim-expected"><small>{t('expected')}</small><pre dir={coding ? 'ltr' : 'auto'}>{sim.expected}</pre></div>}
    <div className="sim-actions">
      {coding && <button type="button" className="button button-secondary sim-run-button" disabled={!value.trim() || isRunning} onClick={runCode} data-testid="button-run-simulator-code">
        {isRunning ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
        {isRunning ? t('simRunning') : t('simRunCode')}
      </button>}
      {submit.isSuccess && <span className="saved-note"><Check size={14} /> {t('attemptSaved')}</span>}
      <button className="button sim-submit-button" disabled={!value.trim() || submit.isPending} onClick={() => send([value])} data-testid="button-submit-sim">
        {submit.isPending ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
        {submit.isPending ? t('evaluating') : coding ? t('runChecksSubmit') : t('evaluateSubmit')}
      </button>
    </div>
    {coding && <section className={`sim-output-panel ${runResult?.ok ? 'output-success' : runResult ? 'output-error' : ''}`} aria-live="polite">
      <header className="sim-output-heading"><div><Terminal size={15} /><b>{t('simOutput')}</b></div>
        {runResult && <span className={`sim-output-status ${runResult.ok ? 'is-ok' : 'is-error'}`}>{runResult.ok ? t('simRunComplete') : runResult.timedOut ? t('simRunTimeout') : t('simRunFailed')}</span>}
      </header>
      <div className="sim-output-content">
        {!runResult && <p className="sim-output-placeholder">{t('simOutputPlaceholder')}</p>}
        {runResult?.logs.map((entry, index) => <div className="sim-output-line" key={`${entry.level}-${index}`}><span>{entry.level}</span><pre>{entry.text}</pre></div>)}
        {runResult?.value && <div className="sim-output-value"><small>{t('simReturnValue')}</small><pre>{runResult.value}</pre></div>}
        {runResult?.error && <p className="sim-output-error">{runResult.timedOut ? t('simRunTimeoutDetail') : runResult.error}</p>}
        {runResult?.ok && !runResult.logs.length && !runResult.value && <p className="sim-output-placeholder">{t('simNoOutput')}</p>}
      </div>
      <footer className="sim-output-footer">{t('simSandboxNote')}</footer>
    </section>}
    {submit.isSuccess && score !== null && score !== undefined && <section className={`sim-result ${score >= 80 ? 'result-strong' : score >= 50 ? 'result-partial' : 'result-revise'}`} role="status" aria-live="polite">
      <div className="sim-result-heading"><div><Terminal size={15} /><b>{t('simEvaluation')}</b></div><strong>{score}%</strong></div>
      <div className="sim-score-track"><span style={{ width: `${score}%` }} /></div>
      <p>{score >= 80 ? t('simFeedbackStrong') : score >= 50 ? t('simFeedbackPartial') : t('simFeedbackRevise')}</p>
    </section>}
    {submit.isError && <p className="inline-error">{t('attemptError')}</p>}
  </div>;
}

function AttemptStatus({ activity, room }: { activity: SharedActivity; room: LearningRoom }) {
  const { t, locale } = useI18n();
  const people = room.participants?.length ? room.participants : Array.from(new Map(activity.attempts.map((a) => [a.userId, { userId: a.userId, displayName: a.displayName }])).values());
  return <aside className="attempt-status"><span className="eyebrow">{t('attemptStatus')}</span>
    {people.map((p, i) => {
      const mine = activity.attempts.filter((a) => a.userId === p.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = mine[0];
      return <div className={`attempt-person ${latest ? 'has-attempt' : ''}`} key={p.userId} data-testid={`attempt-status-${p.userId}`}>
        <span className="message-avatar">{initials(p.displayName)}</span>
        <div><b dir="auto">{p.displayName}</b>{room.isDemo && <small className="sim-tag">{i === 0 ? t('userA') : t('userB')}</small>}
          <span>{latest ? <>{latest.score !== null && <>{t('score')} <b className="mono">{latest.score}%</b> · </>}{t('attemptsCount', { n: mine.length })} · {formatDate(latest.createdAt, locale, t('recently'))}</> : <><CircleDashed size={11} /> {t('notAttempted')}</>}</span>
        </div>
        {latest && <Check size={15} className="attempt-check" />}
      </div>;
    })}
  </aside>;
}
