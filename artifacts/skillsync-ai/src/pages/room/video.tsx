import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowUpRight, Check, Clock3, Languages, LoaderCircle,
  Mic, MicOff, Pause, Play, RotateCcw, Send, Sparkles, UsersRound, Video as VideoIcon,
  WandSparkles,
} from 'lucide-react';
import {
  getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey,
  transcribeSkillSyncCallAudio, useRequestSkillSyncCallCopilot,
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
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [turn, setTurn] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const recognition = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  const fallbackStarting = useRef(false);
  const transcriptRef = useRef('');
  const participants = room.participants ?? [];
  const currentTurn = participants[turn % Math.max(participants.length, 1)];
  const cleanRoomId = room.roomId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 100);
  const meetingName = `SkillSync_AI_Room_${cleanRoomId}`;
  const meetingUrl = `https://meet.jit.si/${encodeURIComponent(meetingName)}#config.prejoinPageEnabled=true`;
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const shareText = transcriptRef.current.trim();

  const appendTranscript = useCallback((text: string) => {
    const piece = text.trim();
    if (!piece) return;
    const current = transcriptRef.current;
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const normalizedPiece = normalize(piece);
    if (normalizedPiece && normalize(current).includes(normalizedPiece)) return;
    const next = `${current.trim()}${current.trim() ? '\n' : ''}${piece}`.slice(-10000);
    transcriptRef.current = next;
    setTranscript(next);
  }, []);

  const transcribeChunk = useCallback(async (chunk: Blob) => {
    if (chunk.size < 1024) return;
    setTranscribing(true);
    setTranscriptionError('');
    try {
      const result = await transcribeSkillSyncCallAudio(room.roomId, chunk, {
        headers: {
          'Content-Type': chunk.type || 'application/octet-stream',
          'Accept-Language': aiLocale,
        },
      });
      appendTranscript(result.text);
    } catch (error) {
      setTranscriptionError(aiErrorMessage(error, t('transcriptionError')));
    } finally {
      setTranscribing(false);
    }
  }, [aiLocale, appendTranscript, room.roomId, t]);

  const startMediaRecorderFallback = useCallback(async () => {
    if (fallbackStarting.current || mediaStream.current || !listeningRef.current) return;
    fallbackStarting.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Media recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStream.current = stream;
      const supportedMime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((mime) => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(mime));

      const startSegment = () => {
        if (!listeningRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          mediaStream.current = null;
          mediaRecorder.current = null;
          return;
        }
        try {
          const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
          const chunks: BlobPart[] = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          recorder.onerror = () => {
            setTranscriptionError(t('transcriptionError'));
            listeningRef.current = false;
            setListening(false);
            stream.getTracks().forEach((track) => track.stop());
            mediaStream.current = null;
            mediaRecorder.current = null;
          };
          recorder.onstop = () => {
            if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
            recordingTimer.current = null;
            const blob = new Blob(chunks, { type: recorder.mimeType || supportedMime || 'audio/webm' });
            if (blob.size >= 1024) {
              uploadQueue.current = uploadQueue.current.then(() => transcribeChunk(blob));
            }
            if (listeningRef.current) {
              recordingTimer.current = window.setTimeout(startSegment, 100);
            } else {
              stream.getTracks().forEach((track) => track.stop());
              mediaStream.current = null;
              mediaRecorder.current = null;
            }
          };
          mediaRecorder.current = recorder;
          recorder.start();
          recordingTimer.current = window.setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
          }, 8000);
        } catch (error) {
          setTranscriptionError(aiErrorMessage(error, t('transcriptionError')));
          listeningRef.current = false;
          setListening(false);
          stream.getTracks().forEach((track) => track.stop());
          mediaStream.current = null;
          mediaRecorder.current = null;
        }
      };

      setTranscriptionError('');
      setListening(true);
      startSegment();
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setTranscriptionError(
        error instanceof Error && error.name === 'NotAllowedError'
          ? t('microphonePermissionError')
          : aiErrorMessage(error, t('transcriptionError')),
      );
    } finally {
      fallbackStarting.current = false;
    }
  }, [t, transcribeChunk]);

  const stopTranscription = useCallback(() => {
    listeningRef.current = false;
    try { recognition.current?.stop(); } catch { /* Recognition may already have stopped. */ }
    if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* The final audio chunk is best-effort. */ }
    } else {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      mediaRecorder.current = null;
    }
    setListening(false);
  }, []);

  const toggleListening = useCallback(async () => {
    if (!consent || !joined) return;
    if (listeningRef.current) {
      stopTranscription();
      return;
    }
    setTranscriptionError('');
    listeningRef.current = true;
    setListening(true);
    if (recognition.current) {
      try {
        recognition.current.start();
        return;
      } catch {
        // Older Safari implementations can expose SpeechRecognition but fail to start it.
      }
    }
    await startMediaRecorderFallback();
  }, [consent, joined, startMediaRecorderFallback, stopTranscription]);

  useEffect(() => {
    setRecorderAvailable(typeof navigator.mediaDevices !== 'undefined' && typeof MediaRecorder !== 'undefined');
  }, []);

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
    if (!RecognitionClass) {
      recognition.current = null;
      setRecognitionAvailable(false);
      return;
    }
    const instance = new RecognitionClass();
    setRecognitionAvailable(true);
    instance.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      const finalText = Array.from({ length: event.results.length - event.resultIndex }, (_, i) => event.results[event.resultIndex + i])
        .filter((item) => item.isFinal)
        .map((item) => item[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (finalText) appendTranscript(finalText);
    };
    instance.onerror = () => {
      if (listeningRef.current) void startMediaRecorderFallback();
    };
    instance.onend = () => {
      if (listeningRef.current) void startMediaRecorderFallback();
    };
    recognition.current = instance;
    return () => {
      instance.onresult = null;
      try { instance.stop(); } catch { /* Recognition may not have started. */ }
      recognition.current = null;
      setRecognitionAvailable(false);
    };
  }, [appendTranscript, locale, startMediaRecorderFallback]);

  useEffect(() => () => {
    listeningRef.current = false;
    try { recognition.current?.stop(); } catch { /* Recognition may already have stopped. */ }
    if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
    if (mediaRecorder.current?.state === 'recording') {
      try { mediaRecorder.current.stop(); } catch { /* Best-effort cleanup. */ }
    }
    mediaStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
          stopTranscription();
          setJoined(false);
          setTimerRunning(false);
          setPanel('chat');
        }
      } },
    );
  };
  const leaveCall = () => {
    stopTranscription();
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
          allow="camera https://meet.jit.si; microphone https://meet.jit.si; fullscreen https://meet.jit.si; display-capture https://meet.jit.si; autoplay https://meet.jit.si"
          allowFullScreen
          referrerPolicy="strict-origin"
          data-testid="jitsi-frame"
        />
      </div>}
      {joined && <p className="video-diagnostics" role="status">{t('jitsiMediaHelp')}</p>}
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
        <label className="transcript-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) stopTranscription(); }} />{t('transcriptConsent')}</label>
        <div className="transcript-controls">
          <button className="quiet-button" onClick={() => void toggleListening()} disabled={!joined || !consent || (!recognitionAvailable && !recorderAvailable)} data-testid="button-toggle-listening">{listening ? <MicOff size={14} /> : <Mic size={14} />}{listening ? t('stopListening') : t('startListening')}</button>
          {!recognitionAvailable && <span className="transcript-note">{t('transcriptUnsupported')}</span>}
          {transcribing && <span className="listening-pill"><LoaderCircle size={12} className="spin" />{t('transcribing')}</span>}
        </div>
        {transcriptionError && <p className="inline-error" role="alert">{transcriptionError}</p>}
        <textarea className="call-transcript" value={transcript} onChange={(event) => { transcriptRef.current = event.target.value; setTranscript(event.target.value); }} maxLength={10000} rows={4} dir="auto" placeholder={t('transcriptPlaceholder')} data-testid="input-call-transcript" />
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
