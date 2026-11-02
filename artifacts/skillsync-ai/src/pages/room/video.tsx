import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowUpRight, Check, Clock3, Languages, LoaderCircle,
  Mic, MicOff, Pause, Play, RotateCcw, Send, Sparkles, UsersRound, Video as VideoIcon,
  WandSparkles,
} from 'lucide-react';
import {
  getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey,
  useRequestSkillSyncCallCopilot,
} from '@workspace/api-client-react';
import type { CallCopilotInputAction, LearningRoom } from '@workspace/api-client-react';
import { aiErrorMessage } from '@/lib/ai-error';
import { useI18n } from '@/lib/i18n';
import { AiChat, PartnerChat } from './chat';
import { ActivitiesTab } from './activities';

type SpeechResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type Props = {
  room: LearningRoom;
  actingUserId: string | null;
  viewerId: string | null;
  onOpenActivity: (id: string) => void;
  selectedId: string | null;
  onSelectActivity: (id: string) => void;
};

export function VideoRoom({ room, actingUserId, viewerId, onOpenActivity, selectedId, onSelectActivity }: Props) {
  const { t, locale } = useI18n();
  const aiLocale = locale === 'ar' ? 'ar' : 'en';
  const client = useQueryClient();
  const copilot = useRequestSkillSyncCallCopilot();
  const [joined, setJoined] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [wideVideo, setWideVideo] = useState(false);
  const [panel, setPanel] = useState<'chat' | 'activities'>('chat');
  const [transcript, setTranscript] = useState('');
  const [consent, setConsent] = useState(false);
  const [listening, setListening] = useState(false);
  const [turn, setTurn] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const recognition = useRef<Recognition | null>(null);
  const participants = room.participants ?? [];
  const currentTurn = participants[turn % Math.max(participants.length, 1)];
  const cleanRoomId = room.roomId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 100);
  const meetingName = `SkillSync_AI_Room_${cleanRoomId}`;
  const meetingUrl = `https://meet.jit.si/${encodeURIComponent(meetingName)}`;
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const shareText = transcript.trim();

  useEffect(() => {
    if (!timerRunning || secondsLeft === 0) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setTurn((value) => value === 0 ? 1 : 0);
          return 15 * 60;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, secondsLeft]);

  useEffect(() => {
    const scope = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const RecognitionClass = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!RecognitionClass) { recognition.current = null; return; }
    const instance = new RecognitionClass();
    instance.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      const finalText = Array.from({ length: event.results.length - event.resultIndex }, (_, i) => event.results[event.resultIndex + i])
        .filter((item) => item.isFinal)
        .map((item) => item[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (finalText) setTranscript((current) => `${current.trim()}${current.trim() ? '\n' : ''}${finalText}`);
    };
    instance.onerror = () => setListening(false);
    instance.onend = () => setListening(false);
    recognition.current = instance;
    return () => {
      instance.onresult = null;
      try { instance.stop(); } catch { /* Recognition may not have started. */ }
      recognition.current = null;
    };
  }, [locale]);

  const runTool = (action: CallCopilotInputAction, needsTranscript = true) => {
    if (needsTranscript && !shareText) return;
    copilot.mutate(
      { roomId: room.roomId, data: { action, transcript: shareText, locale: aiLocale } },
      { onSuccess: (result) => {
        if (result.activity) {
          setPanel('activities');
          onSelectActivity(result.activity.id);
          client.invalidateQueries({ queryKey: getListSkillSyncActivitiesQueryKey(room.roomId) });
        }
        client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(room.roomId) });
        if (action === 'summary') {
          recognition.current?.stop();
          setListening(false);
          setJoined(false);
          setTimerRunning(false);
          setPanel('chat');
        }
      } },
    );
  };
  const toggleListening = () => {
    if (!consent) return;
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    if (!recognition.current) return;
    try { recognition.current.start(); setListening(true); } catch { setListening(false); }
  };
  const leaveCall = () => {
    recognition.current?.stop();
    setListening(false);
    setTimerRunning(false);
    setJoined(false);
  };
  return <div className={`video-workspace ${wideVideo ? 'video-workspace-wide' : ''}`} data-testid="video-copilot">
    <section className="video-column">
      <header className="video-toolbar"><div><span className="eyebrow">{t('tabVideo')}</span><h2>{t('callTitle')}</h2></div>
        <div className="video-toolbar-actions">{joined && <button className="quiet-button" onClick={leaveCall}>{t('videoLeave')}</button>}
          <button className="quiet-button video-layout-toggle" onClick={() => setWideVideo((value) => !value)}>{wideVideo ? t('splitScreen') : t('splitFocus')}</button>
        </div>
      </header>
      {!joined ? <div className="video-join-card">
        <span className="video-symbol"><VideoIcon size={24} /></span>
        <p>{t('callIntro')}</p>
        <p className="video-privacy"><AlertTriangle size={14} />{t('callPrivacy')}</p>
        <button className="button" onClick={() => setJoined(true)} data-testid="button-join-video"><VideoIcon size={15} />{t('videoJoin')}</button>
      </div> : <div className="video-frame-wrap">
        <iframe
          title={t('callTitle')}
          src={meetingUrl}
          allow="camera; microphone; fullscreen; display-capture"
          allowFullScreen
          referrerPolicy="strict-origin"
          data-testid="jitsi-frame"
        />
      </div>}
      <div className="video-link-row"><span className="video-privacy"><AlertTriangle size={13} />{t('callPrivacy')}</span>
        <a href={meetingUrl} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={13} />{t('openJitsi')}</a></div>
    </section>
    {!wideVideo && <aside className="copilot-panel">
      <div className="copilot-tabs" role="tablist">
        <button role="tab" aria-selected={panel === 'chat'} onClick={() => setPanel('chat')} data-testid="tab-call-chat"><UsersRound size={14} />{t('callChat')}</button>
        <button role="tab" aria-selected={panel === 'activities'} onClick={() => setPanel('activities')} data-testid="tab-call-activities"><Sparkles size={14} />{t('callActivities')}</button>
      </div>
      <div className="copilot-companion" hidden={panel !== 'chat'}>
        <PartnerChat room={room} actingUserId={actingUserId} viewerId={viewerId} onOpenActivity={onOpenActivity} />
      </div>
      <div className="copilot-companion" hidden={panel !== 'activities'}>
        <ActivitiesTab room={room} actingUserId={actingUserId} selectedId={selectedId} onSelect={onSelectActivity} />
      </div>
      <section className="copilot-tools">
        <article className="role-card">
          <header><span><Clock3 size={14} />{t('roleTimer')}</span><b className="mono">{timerText}</b></header>
          <p>{currentTurn && t('roleTeaches', { name: currentTurn.displayName, skill: currentTurn.teachSkill })}</p>
          <small>{t('turn', { n: turn + 1 })}</small>
          <div className="call-tool-actions">
            <button className="button button-small" onClick={() => setTimerRunning((value) => !value)} aria-label={timerRunning ? t('pauseTimer') : t('startTimer')}>{timerRunning ? <Pause size={13} /> : <Play size={13} />}{timerRunning ? t('pauseTimer') : t('startTimer')}</button>
            <button className="quiet-button" onClick={() => { setTimerRunning(false); setSecondsLeft(900); setTurn(0); }} aria-label={t('resetTimer')}><RotateCcw size={13} /></button>
            <button className="quiet-button" onClick={() => runTool('speaking_prompt', false)} disabled={copilot.isPending}><WandSparkles size={13} />{t('speakingPrompt')}</button>
          </div>
        </article>
        <div className="transcript-heading"><span><Languages size={14} />{t('transcriptTitle')}</span>{listening && <b className="listening-pill"><i />{t('speechListening')}</b>}</div>
        <label className="transcript-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) { recognition.current?.stop(); setListening(false); } }} />{t('transcriptConsent')}</label>
        <div className="transcript-controls">
          <button className="quiet-button" onClick={toggleListening} disabled={!joined || !consent || !recognition.current} data-testid="button-toggle-listening">{listening ? <MicOff size={14} /> : <Mic size={14} />}{listening ? t('stopListening') : t('startListening')}</button>
          {!recognition.current && <span className="transcript-note">{t('transcriptUnsupported')}</span>}
        </div>
        <textarea className="call-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} maxLength={10000} rows={4} dir="auto" placeholder={t('transcriptPlaceholder')} data-testid="input-call-transcript" />
        <p className="transcript-note">{t('transcriptSendNotice')}</p>
        <div className="call-tool-grid">
          <button className="button button-secondary button-small" disabled={!shareText || copilot.isPending} onClick={() => runTool('hint')} data-testid="button-live-hint"><Sparkles size={13} />{t('voiceHint')}</button>
          <button className="button button-secondary button-small" disabled={!shareText || copilot.isPending} onClick={() => runTool('quiz')} data-testid="button-call-quiz"><WandSparkles size={13} />{t('callQuiz')}</button>
        </div>
        {copilot.data && copilot.data.action !== 'summary' && <div className="whisper-card" role="status"><Sparkles size={14} /><p dir="auto">{copilot.data.text}</p>{copilot.data.activity && <span><Check size={12} /></span>}</div>}
        {copilot.isError && <p className="inline-error">{aiErrorMessage(copilot.error, t('copilotError'))}</p>}
        <button className="button call-end-button" disabled={!joined || !shareText || copilot.isPending} onClick={() => runTool('summary')} data-testid="button-end-summarize">
          {copilot.isPending ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
          {t('endAndSummarize')}
        </button>
      </section>
    </aside>}
    {wideVideo && <button className="button video-restore" onClick={() => setWideVideo(false)}>{t('splitScreen')}</button>}
  </div>;
}
