import { aiErrorMessage } from '@/lib/ai-error';
import {
  SIMULATOR_BOOT_TIMEOUT_MS,
  SIMULATOR_MAX_CODE_CHARS,
  SIMULATOR_MAX_LOG_CHARS,
  SIMULATOR_MAX_LOG_ENTRIES,
  SIMULATOR_SESSION_TIMEOUT_MS,
  SIMULATOR_SETUP_TIMEOUT_MS,
  type SimulatorConsoleEntry,
  type SimulatorSandboxEvent,
} from '@/lib/simulator-sandbox';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleDashed, Code2, Eye, EyeOff, Languages, Layers, ListChecks, LoaderCircle, Play, RotateCcw, Sparkles, Square, Terminal, WandSparkles, X } from 'lucide-react';
import { getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey, useGenerateSkillSyncActivity, useGenerateSkillSyncSimulatorSolution, useListSkillSyncActivities, useSubmitSkillSyncActivityAttempt } from '@workspace/api-client-react';
import type { ActivityAttemptInput, ActivityGenerationInputKind, LearningRoom, SharedActivity } from '@workspace/api-client-react';
import { EmptyState, ErrorState, initials } from '@/components/shell';
import { formatDate, useI18n, type DictKey } from '@/lib/i18n';
import { SimulatorSandboxFrame } from './SimulatorSandboxFrame';

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
type SimulatorExecutionStatus = 'starting' | 'running' | 'complete' | 'error' | 'stopped' | 'timedOut';
type SimulatorExecution = {
  id: number;
  code: string;
  live: boolean;
  uiVisible: boolean;
  status: SimulatorExecutionStatus;
  logs: SimulatorConsoleEntry[];
  value?: string;
  error?: string;
  sourceOutputOmitted?: boolean;
  logsTruncated?: boolean;
};

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
  const [execution, setExecution] = useState<SimulatorExecution | null>(null);
  const lineGutter = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  const bootTimerRef = useRef<number | null>(null);
  const setupTimerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const { send, submit } = useAttempt(room, activity, actingUserId, onDone);
  const generateSolution = useGenerateSkillSyncSimulatorSolution();
  const clearRunTimers = () => {
    if (bootTimerRef.current !== null) window.clearTimeout(bootTimerRef.current);
    if (setupTimerRef.current !== null) window.clearTimeout(setupTimerRef.current);
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    bootTimerRef.current = null;
    setupTimerRef.current = null;
    sessionTimerRef.current = null;
  };
  useEffect(() => () => clearRunTimers(), []);
  if (!sim) return null;
  const coding = sim.mode === 'coding';
  const score = submit.data?.score;
  const lineCount = Math.max(14, value.split('\n').length);
  const endExecution = (id: number, status: SimulatorExecutionStatus, error?: string) => {
    clearRunTimers();
    setExecution((current) => current?.id === id
      ? { ...current, status, live: false, ...(error ? { error } : {}) }
      : current);
  };
  const resetExecution = () => {
    clearRunTimers();
    setExecution(null);
  };
  const generateCode = () => {
    resetExecution();
    generateSolution.mutate(
      { roomId: room.roomId, activityId: activity.id },
      { onSuccess: (result) => setValue(result.code) },
    );
  };
  const runCode = () => {
    const code = value.trim();
    if (!code || code.length > SIMULATOR_MAX_CODE_CHARS) return;
    clearRunTimers();
    const id = ++runIdRef.current;
    setExecution({ id, code, live: true, uiVisible: false, status: 'starting', logs: [] });
    bootTimerRef.current = window.setTimeout(() => endExecution(id, 'error', t('simRunnerUnavailable')), SIMULATOR_BOOT_TIMEOUT_MS);
    sessionTimerRef.current = window.setTimeout(() => endExecution(id, 'timedOut', t('simSessionTimeoutDetail')), SIMULATOR_SESSION_TIMEOUT_MS);
  };
  const handleSandboxMessage = (message: SimulatorSandboxEvent) => {
    if (message.type === 'navigation') {
      endExecution(message.runId, 'error', t('simNavigationBlocked'));
      return;
    }
    if (message.type === 'started') {
      if (bootTimerRef.current !== null) window.clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
      setupTimerRef.current = window.setTimeout(() => endExecution(message.runId, 'timedOut', t('simSetupTimeoutDetail')), SIMULATOR_SETUP_TIMEOUT_MS);
      setExecution((current) => current?.id === message.runId ? { ...current, status: 'running' } : current);
      return;
    }
    if (message.type === 'complete') {
      if (setupTimerRef.current !== null) window.clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
      setExecution((current) => current?.id === message.runId ? { ...current, status: 'complete' } : current);
      return;
    }
    if (message.type === 'ui') {
      setExecution((current) => current?.id === message.runId ? { ...current, uiVisible: true } : current);
      return;
    }
    if (message.type === 'log' && typeof message.level === 'string' && typeof message.text === 'string') {
      const text = message.text.slice(0, SIMULATOR_MAX_LOG_CHARS);
      setExecution((current) => {
        if (!current || current.id !== message.runId) return current;
        if (current.logs.length >= SIMULATOR_MAX_LOG_ENTRIES) return { ...current, logsTruncated: true };
        return { ...current, logs: [...current.logs, { level: message.level!, text }] };
      });
      return;
    }
    if (message.type === 'value' && typeof message.value === 'string') {
      setExecution((current) => current?.id === message.runId ? { ...current, value: message.value!.slice(0, SIMULATOR_MAX_CODE_CHARS) } : current);
      return;
    }
    if (message.type === 'error' && typeof message.error === 'string') {
      if (setupTimerRef.current !== null) window.clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
      setExecution((current) => current?.id === message.runId
        ? { ...current, status: 'error', error: message.error!.slice(0, 1000) }
        : current);
      return;
    }
    if (message.type === 'warning' && typeof message.text === 'string') {
      setExecution((current) => {
        if (!current || current.id !== message.runId) return current;
        if (current.logs.length >= SIMULATOR_MAX_LOG_ENTRIES) return { ...current, logsTruncated: true };
        return { ...current, logs: [...current.logs, { level: 'warn', text: message.text!.slice(0, SIMULATOR_MAX_LOG_CHARS) }] };
      });
      return;
    }
    if (message.type === 'source-hidden') {
      setExecution((current) => current?.id === message.runId ? { ...current, sourceOutputOmitted: true } : current);
      return;
    }
    if (message.type === 'logs-truncated') {
      setExecution((current) => current?.id === message.runId ? { ...current, logsTruncated: true } : current);
      return;
    }
    if (message.type === 'clear-logs') {
      setExecution((current) => current?.id === message.runId
        ? { ...current, logs: [], logsTruncated: false, sourceOutputOmitted: false }
        : current);
    }
  };
  const stopCode = () => {
    if (execution) endExecution(execution.id, 'stopped');
  };
  const isBooting = execution?.status === 'starting' || execution?.status === 'running';
  const statusLabel = execution?.status === 'complete' ? t('simRunComplete')
    : execution?.status === 'stopped' ? t('simRunStopped')
      : execution?.status === 'timedOut' ? t('simRunTimeout')
        : execution?.status === 'error' ? t('simRunFailed')
          : execution ? t('simRunning') : '';
  const statusIsError = execution?.status === 'error' || execution?.status === 'timedOut';
  const consoleMode = Boolean(
    execution &&
    !execution.uiVisible &&
    (execution.logs.length > 0 || ['complete', 'error', 'stopped', 'timedOut'].includes(execution.status)),
  );
  const handleEditorChange = (nextValue: string) => {
    setValue(nextValue);
    resetExecution();
    if (generateSolution.isSuccess || generateSolution.isError) generateSolution.reset();
  };
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (coding && event.key === 'Tab') {
      event.preventDefault();
      const editor = event.currentTarget;
      editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
      setValue(editor.value);
      resetExecution();
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
          onChange={(event) => handleEditorChange(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onScroll={(event) => { if (lineGutter.current) lineGutter.current.scrollTop = event.currentTarget.scrollTop; }}
          rows={coding ? 18 : 14}
          maxLength={12000}
          spellCheck={!coding}
          dir={coding ? 'ltr' : 'auto'}
          className="sim-editor-input"
          aria-label={t('yourResponse')}
          data-testid="input-simulator"
        />
      </div>
      <footer className="sim-editor-footer">
        <span>{t('simulatorGradingNote')}</span>
        <span className="sim-char-count">{value.length}/12000</span>
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
      {coding && <button type="button" className="button button-secondary sim-run-button" disabled={!value.trim() || isBooting} onClick={runCode} data-testid="button-run-simulator-code">
        {isBooting ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
        {isBooting ? t('simRunning') : t('simRunCode')}
      </button>}
      {coding && execution?.live && <button type="button" className="button button-secondary sim-stop-button" onClick={stopCode} data-testid="button-stop-simulator-code"><Square size={14} />{t('simStop')}</button>}
      {submit.isSuccess && <span className="saved-note"><Check size={14} /> {t('attemptSaved')}</span>}
      <button className="button sim-submit-button" disabled={!value.trim() || submit.isPending} onClick={() => send([value])} data-testid="button-submit-sim">
        {submit.isPending ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
        {submit.isPending ? t('evaluating') : coding ? t('runChecksSubmit') : t('evaluateSubmit')}
      </button>
    </div>
    {coding && <section className={`sim-output-panel ${execution?.status === 'complete' ? 'output-success' : statusIsError ? 'output-error' : ''}`} aria-live="polite">
      <header className="sim-output-heading"><div><Terminal size={15} /><b>{t('simOutput')}</b></div>
        {execution && <span className={`sim-output-status ${statusIsError ? 'is-error' : execution.status === 'complete' ? 'is-ok' : ''}`}>{statusLabel}</span>}
      </header>
      <div className={`sim-output-content ${consoleMode ? 'console-mode' : ''}`}>
        {!execution && <p className="sim-output-placeholder">{t('simOutputPlaceholder')}</p>}
        {execution && <div className={`sim-live-preview ${execution.uiVisible ? 'has-ui' : ''} ${consoleMode ? 'console-mode' : ''}`}>
          {execution.live && <SimulatorSandboxFrame key={execution.id} code={execution.code} runId={execution.id} onMessage={handleSandboxMessage} />}
          {!execution.uiVisible && <div className="sim-live-preview-placeholder">{execution.status === 'starting' || execution.status === 'running' ? t('simPreviewStarting') : t('simNoUi')}</div>}
        </div>}
        {execution && <div className="sim-output-logs">
          {execution.logs.map((entry, index) => <div className="sim-output-line" data-level={entry.level} key={`${entry.level}-${index}`}><span>{entry.level}</span><pre>{entry.text}</pre></div>)}
          {execution.value && <div className="sim-output-value"><small>{t('simReturnValue')}</small><pre>{execution.value}</pre></div>}
          {execution.sourceOutputOmitted && <p className="sim-output-placeholder">{t('simSourceOutputOmitted')}</p>}
          {execution.logsTruncated && <p className="sim-output-placeholder">{t('simLogLimitReached')}</p>}
          {execution.error && <div className="sim-output-error" role="alert"><b>{t('simError')}</b><pre>{execution.error}</pre></div>}
          {execution.status === 'complete' && !execution.uiVisible && !execution.logs.length && !execution.value && !execution.error && <p className="sim-output-placeholder">{t('simNoOutput')}</p>}
        </div>}
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
