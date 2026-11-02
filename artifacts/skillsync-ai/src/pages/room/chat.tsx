import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AtSign, Bot, ImagePlus, LoaderCircle, MessageCircle, Mic, Pause, Quote, Send, ShieldCheck, Sparkles, SquareArrowOutUpRight, Trash2, X } from 'lucide-react';
import { deletePendingSkillSyncRoomMedia, getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey, getSkillSyncRoomMedia, requestSkillSyncRoomMediaUpload, transcribeSkillSyncVoiceNote, useSendSkillSyncAiMessage, useSendSkillSyncMessage } from '@workspace/api-client-react';
import type { ChatMessage, LearningRoom, RoomMediaUploadInputContentType } from '@workspace/api-client-react';
import { initials } from '@/components/shell';
import { formatTime, useI18n } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/ai-error';

export const AI_MENTION = /(^|\s)@(AI|SkillSync)(?=$|[\s,.!?،:])/iu;

type ChatProps = { room: LearningRoom; actingUserId: string | null; viewerId: string | null; onOpenActivity: (id: string) => void };
const CALL_SUMMARY_MARKER = 'SKILLSYNC_CALL_SUMMARY:';
type CallSummary = { takeaways: string[]; terms: string[]; corrections: string[]; nextSteps: string[] };
type ImageDraft = { file: File; url: string };
type AudioDraft = { blob: Blob; url: string; duration: number; name: string; contentType: string };
type TaggedRecorder = MediaRecorder & { __cancelled?: boolean };

function callSummary(content: string): CallSummary | null {
  if (!content.startsWith(CALL_SUMMARY_MARKER)) return null;
  try {
    const value = JSON.parse(content.slice(CALL_SUMMARY_MARKER.length)) as Partial<CallSummary>;
    if (![value.takeaways, value.terms, value.corrections, value.nextSteps].every((items) => Array.isArray(items) && items.every((item) => typeof item === 'string'))) return null;
    return value as CallSummary;
  } catch { return null; }
}

function useSendHelpers(roomId: string) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(roomId) });
    client.invalidateQueries({ queryKey: getListSkillSyncActivitiesQueryKey(roomId) });
  };
}

function mediaIdFromUrl(mediaUrl: string) {
  try {
    const segments = new URL(mediaUrl, window.location.origin).pathname.split('/').filter(Boolean);
    const mediaIndex = segments.lastIndexOf('media');
    return mediaIndex >= 0 ? decodeURIComponent(segments[mediaIndex + 1] || '') : '';
  } catch { return ''; }
}

function PrivateImage({ roomId, mediaUrl, name, onOpen, messageId }: { roomId: string; mediaUrl: string; name: string | null; onOpen: (url: string) => void; messageId: string }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    const mediaId = mediaIdFromUrl(mediaUrl);
    if (!mediaId) { setState('error'); return; }
    setState('loading');
    void getSkillSyncRoomMedia(roomId, mediaId).then((blob) => {
      if (!active) return;
      localUrl = URL.createObjectURL(blob);
      setUrl(localUrl);
      setState('ready');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [roomId, mediaUrl, retry]);
  return state === 'error' ? <button type="button" className="private-media-retry" onClick={() => setRetry((value) => value + 1)} data-testid={`button-retry-image-${messageId}`}><span role="alert">{t('mediaLoadError')}</span></button> :
    <button type="button" className="chat-image-button" disabled={!url} onClick={() => url && onOpen(url)} aria-label={t('openImage')} data-testid={`button-open-image-${messageId}`}>
    {state === 'loading' && <span className="private-media-state" role="status">{t('loadingAttachment')}</span>}
    {url && <img src={url} alt={name || t('imageAttachment')} loading="lazy" />}
  </button>;
}

function PrivateAudio({ roomId, mediaUrl, messageId, duration }: { roomId: string; mediaUrl: string; messageId: string; duration: number | null }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const loadAudio = async () => {
    if (url || loading) return;
    const mediaId = mediaIdFromUrl(mediaUrl);
    if (!mediaId) { setError(true); return; }
    setLoading(true);
    setError(false);
    try {
      const blob = await getSkillSyncRoomMedia(roomId, mediaId);
      const objectUrl = URL.createObjectURL(blob);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  return <div className="chat-audio" data-testid={`voice-player-${messageId}`}>
    {url ? <audio controls preload="none" src={url} aria-label={t('voiceNote')} data-testid={`audio-message-${messageId}`} /> :
      <button type="button" className="message-chip private-audio-load" onClick={() => void loadAudio()} disabled={loading} aria-label={t('playVoiceNote')} data-testid={`button-load-audio-${messageId}`}>
        {loading ? <LoaderCircle size={13} className="spin" /> : <Mic size={13} />}{loading ? t('loadingAttachment') : t('playVoiceNote')}
      </button>}
    {duration != null && <small>{formatDuration(duration)}</small>}
    {error && <span className="private-media-error" role="alert">{t('mediaLoadError')}</span>}
  </div>;
}

function MessageBubble({ message, roomId, own, onReply, canReply = true, onVerify, onOpenActivity, onQuoteClick, onLightbox, onTranscribe, highlighted, transcribing }: {
  message: ChatMessage; roomId: string; own: boolean; onReply: (message: ChatMessage) => void; canReply?: boolean; onVerify?: () => void;
  onOpenActivity: (id: string) => void; onQuoteClick: (id: string) => void; onLightbox: (url: string) => void;
  onTranscribe?: (message: ChatMessage) => void; highlighted?: boolean; transcribing?: boolean;
}) {
  const { t, locale } = useI18n();
  const isAi = message.senderType === 'assistant';
  const isMod = message.senderType === 'moderator';
  const summary = callSummary(message.content);
  const name = isAi ? t('aiName') : isMod ? t('guide') : message.senderName;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (canReply && Math.abs(deltaX) > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) onReply(message);
  };
  const isAudio = message.mediaType === 'audio' && !!message.mediaUrl;
  const isImage = message.mediaType === 'image' && !!message.mediaUrl;
  return <div id={`message-${message.id}`} className={`chat-message ${own ? 'own-message' : ''} ${isAi ? 'ai-message' : ''} ${isMod ? 'moderator-message' : ''} ${highlighted ? 'message-highlighted' : ''}`} data-testid={`message-${message.id}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <span className="message-avatar">{isAi ? <Sparkles size={13} /> : isMod ? <ShieldCheck size={13} /> : initials(message.senderName)}</span>
    <div className="message-content">
      <div className="message-meta"><b>{name}</b><time dateTime={message.createdAt}>{formatTime(message.createdAt, locale)}</time></div>
      {message.replyTo && <button type="button" className="message-quote" onClick={() => onQuoteClick(message.replyTo!.id)} data-testid={`button-quote-${message.id}`} aria-label={t('jumpToOriginal')}>
        <Quote size={12} /><span><b>{t('repliedTo', { name: message.replyTo.senderName })}</b><span dir="auto">{message.replyTo.mediaType === 'image' ? t('imageAttachment') : message.replyTo.mediaType === 'audio' ? t('voiceNote') : message.replyTo.contentSnippet}</span></span>
      </button>}
      {summary ? <section className="call-summary-card">
        <h3><Sparkles size={14} />{t('callSummaryTitle')}</h3>
        {([
          [t('summaryTakeaways'), summary.takeaways],
          [t('summaryTerms'), summary.terms],
          [t('summaryCorrections'), summary.corrections],
          [t('summaryNextSteps'), summary.nextSteps],
        ] as const).filter(([, items]) => items.length > 0).map(([title, items]) => <div key={title}><b>{title}</b><ul>{items.map((item, index) => <li key={index} dir="auto">{item}</li>)}</ul></div>)}
      </section> : message.content && <p dir="auto">{message.content}</p>}
      {isImage && <PrivateImage roomId={roomId} mediaUrl={message.mediaUrl as string} name={message.mediaName} onOpen={onLightbox} messageId={message.id} />}
      {isAudio && <PrivateAudio roomId={roomId} mediaUrl={message.mediaUrl as string} messageId={message.id} duration={message.mediaDurationSeconds} />}
      {isAudio && (message.transcript !== null && message.transcript !== undefined
        ? <div className="voice-transcript" dir="auto" data-testid={`transcript-${message.id}`}><b>{t('transcriptLabel')}</b><span>{message.transcript.trim() || t('transcriptEmpty')}</span></div>
        : <button type="button" className="message-chip" disabled={!onTranscribe || transcribing} onClick={() => onTranscribe?.(message)} data-testid={`button-transcribe-${message.id}`}>{transcribing ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}{transcribing ? t('transcribing') : t('transcribeVoice')}</button>)}
      <div className="message-actions">
        {message.activityId && <button className="message-chip chip-strong" onClick={() => onOpenActivity(message.activityId as string)} data-testid={`button-open-activity-${message.id}`}><SquareArrowOutUpRight size={12} /> {t('openActivity')}</button>}
        {canReply && <button className="message-chip" type="button" onClick={() => onReply(message)} aria-label={t('replyToMessage')} data-testid={`button-reply-${message.id}`}><Quote size={12} />{t('replyAction')}</button>}
        {onVerify && message.senderType === 'student' && !own && <button className="message-chip" onClick={onVerify} data-testid={`button-verify-${message.id}`}><AtSign size={12} /> {t('verifyWithAi')}</button>}
      </div>
    </div>
  </div>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function Feed({ messages, roomId, isOwn, onReply, canReply = true, onVerify, onOpenActivity, onLightbox, onQuoteClick, onTranscribe, highlightId, transcribingId, empty }: {
  messages: ChatMessage[]; roomId: string; isOwn: (m: ChatMessage) => boolean; onReply: (m: ChatMessage) => void; canReply?: boolean;
  onVerify?: (m: ChatMessage) => void; onOpenActivity: (id: string) => void; onLightbox: (url: string) => void;
  onQuoteClick: (id: string) => void; onTranscribe?: (message: ChatMessage) => void; highlightId?: string | null; transcribingId?: string | null; empty: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [lastId]);
  if (!messages.length) return <div className="message-feed" aria-live="polite">{empty}</div>;
  return <div className="message-feed" ref={ref} aria-label="Partner conversation">{messages.map((message) => <MessageBubble
    key={message.id} message={message} roomId={roomId} own={isOwn(message)} onReply={onReply} canReply={canReply}
    onVerify={onVerify && message.senderType === 'student' && !isOwn(message) ? () => onVerify(message) : undefined}
    onOpenActivity={onOpenActivity} onLightbox={onLightbox} onQuoteClick={onQuoteClick}
    onTranscribe={onTranscribe} highlighted={highlightId === message.id} transcribing={transcribingId === message.id}
  />)}</div>;
}

function ownFn(room: LearningRoom, actingUserId: string | null, viewerId: string | null) {
  return (m: ChatMessage) => {
    if (m.senderType !== 'student') return false;
    if (actingUserId) return m.senderId === actingUserId;
    if (viewerId) return m.senderId === viewerId;
    return m.senderId !== room.partnerUserId;
  };
}

async function compressImage(file: File): Promise<File> {
  const localUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = localUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image-load'));
    });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas-unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('image-compress')), 'image/jpeg', 0.82));
    const safeName = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg`;
    return new File([blob], safeName, { type: 'image/jpeg', lastModified: Date.now() });
  } finally { URL.revokeObjectURL(localUrl); }
}

function bestRecorderType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

function typeForUpload(type: string): RoomMediaUploadInputContentType {
  const normalized = type.split(';')[0].trim().toLowerCase();
  if (normalized === 'audio/mp4' || normalized === 'audio/aac' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a' || normalized === 'audio/webm' || normalized === 'audio/ogg' || normalized === 'audio/mpeg' || normalized === 'audio/wav' || normalized === 'audio/x-wav' || normalized === 'image/png' || normalized === 'image/webp' || normalized === 'image/gif' || normalized === 'image/avif') return normalized;
  return 'image/jpeg';
}

export function PartnerChat({ room, actingUserId, viewerId, onOpenActivity }: ChatProps) {
  const { t, locale } = useI18n();
  const send = useSendSkillSyncMessage();
  const refresh = useSendHelpers(room.roomId);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<TaggedRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(0);
  const messages = useMemo(() => room.messages.filter((message) => message.channel === 'partner'), [room.messages]);
  const mentionsAi = AI_MENTION.test(text);
  const partnerName = room.participants?.find((participant) => participant.userId !== (actingUserId || viewerId))?.displayName || room.partnerName;
  const isReadOnly = room.status === 'unmatched';
  const attachmentsEnabled = !room.isDemo && !isReadOnly;
  const own = useMemo(() => ownFn(room, actingUserId, viewerId), [room, actingUserId, viewerId]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.__cancelled = true;
      recorderRef.current.stop();
    }
  }, []);
  useEffect(() => {
    const url = imageDraft?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [imageDraft?.url]);
  useEffect(() => {
    const url = audioDraft?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [audioDraft?.url]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - recordingStartedRef.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (!lightboxUrl) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [lightboxUrl]);
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightId]);
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`message-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, messages]);

  const clearImageDraft = () => {
    setImageDraft((current) => { if (current) URL.revokeObjectURL(current.url); return null; });
  };
  const clearAudioDraft = () => {
    setAudioDraft((current) => { if (current) URL.revokeObjectURL(current.url); return null; });
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = text.trim();
    if ((!content && !imageDraft && !audioDraft) || send.isPending || mediaBusy || isReadOnly) return;
    if (!imageDraft && !audioDraft) {
      send.mutate({ roomId: room.roomId, data: { content, replyToMessageId: replyTo?.id ?? null, simulatedUserId: actingUserId } }, { onSuccess: () => { setText(''); setReplyTo(null); refresh(); } });
      return;
    }
    const draft = imageDraft ? { file: imageDraft.file, name: imageDraft.file.name, type: imageDraft.file.type, duration: null as number | null } : {
      file: new File([audioDraft!.blob], audioDraft!.name, { type: audioDraft!.contentType }),
      name: audioDraft!.name, type: audioDraft!.contentType, duration: audioDraft!.duration,
    };
    if (draft.file.size > 25_000_000) { setMediaError(t('mediaTooLarge')); return; }
    setMediaBusy(true);
    setMediaError('');
    let mediaId: string | null = null;
    try {
      const contentType = typeForUpload(draft.type);
      const upload = await requestSkillSyncRoomMediaUpload(room.roomId, { fileName: draft.name, size: draft.file.size, contentType });
      mediaId = upload.mediaObjectPath;
      const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: draft.file });
      if (!response.ok) throw new Error('upload-failed');
      await send.mutateAsync({ roomId: room.roomId, data: {
        content, replyToMessageId: replyTo?.id ?? null, simulatedUserId: actingUserId,
        mediaObjectPath: upload.mediaObjectPath, mediaName: draft.name,
        mediaDurationSeconds: draft.duration,
      } });
      setText('');
      setReplyTo(null);
      clearImageDraft();
      clearAudioDraft();
      refresh();
    } catch {
      if (mediaId) {
        try { await deletePendingSkillSyncRoomMedia(room.roomId, mediaId); } catch { /* best-effort cleanup */ }
      }
      setMediaError(t('mediaSendError'));
    } finally { setMediaBusy(false); }
  };
  const quickAi = () => { setText((value) => (AI_MENTION.test(value) ? value : `@AI ${value}`)); inputRef.current?.focus(); };
  const verify = (message: ChatMessage) => { setReplyTo(message); setText(t('verifyPrefix')); inputRef.current?.focus(); };
  const handleImagePick = async (file?: File) => {
    if (!file) return;
    setMediaError('');
    clearAudioDraft();
    try {
      if (!file.type.startsWith('image/')) throw new Error('unsupported-image');
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setImageDraft((old) => { if (old) URL.revokeObjectURL(old.url); return { file: compressed, url }; });
    } catch { setMediaError(t('imageProcessError')); }
  };
  const startRecording = async () => {
    setMediaError('');
    clearImageDraft();
    clearAudioDraft();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError(t('voiceUnsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = bestRecorderType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined) as TaggedRecorder;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedRef.current = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/mp4';
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size && !recorderRef.current?.__cancelled) {
          const duration = Math.max(1, Math.round((Date.now() - recordingStartedRef.current) / 1000));
          const extension = type.includes('webm') ? 'webm' : type.includes('ogg') ? 'ogg' : type.includes('aac') ? 'aac' : 'm4a';
          if (blob.size > 25_000_000) setMediaError(t('voiceTooLarge'));
          else setAudioDraft({ blob, url: URL.createObjectURL(blob), duration, name: `voice-note.${extension}`, contentType: type.split(';')[0] });
        }
        if (recorderRef.current) delete recorderRef.current.__cancelled;
      };
      recorder.start(250);
      setRecordSeconds(0);
      setRecording(true);
    } catch { setMediaError(t('microphonePermissionError')); }
  };
  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setRecording(false);
    recorder.stop();
  };
  const cancelRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.__cancelled = true;
      setRecording(false);
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecordSeconds(0);
  };
  const transcribe = async (message: ChatMessage) => {
    if (transcribingId) return;
    setTranscribingId(message.id);
    setMediaError('');
    try {
      const result = await transcribeSkillSyncVoiceNote(room.roomId, message.id, { headers: { 'Accept-Language': locale } });
      queryClient.setQueryData<LearningRoom>(getGetSkillSyncRoomQueryKey(room.roomId), (cached) => cached ? {
        ...cached,
        messages: cached.messages.map((entry) => entry.id === message.id ? { ...entry, transcript: result.transcript } : entry),
      } : cached);
      queryClient.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(room.roomId) });
    } catch { setMediaError(t('transcriptionError')); }
    finally { setTranscribingId(null); }
  };
  const onQuoteClick = (id: string) => setHighlightId(id);

  return <div className="chat-pane partner-chat-pane">
    <div className="conversation-intro"><span className="room-partner-avatar">{initials(partnerName)}</span><div><b>{t('partnerIntro', { name: partnerName })}</b><span>{t('partnerIntroDetail')}</span></div><span className="polling-indicator"><i /> {t('live')}</span></div>
    {room.isDemo && <div className="demo-media-note" role="note" data-testid="note-demo-attachments"><ShieldCheck size={14} /><span>{t('demoAttachmentNote')}</span></div>}
    <Feed messages={messages} roomId={room.roomId} isOwn={own} onReply={setReplyTo} onVerify={verify} onOpenActivity={onOpenActivity} onLightbox={setLightboxUrl} onQuoteClick={onQuoteClick} onTranscribe={transcribe} highlightId={highlightId} transcribingId={transcribingId} empty={<div className="chat-empty"><span className="empty-chat-icon"><MessageCircle size={20} /></span><b>{t('partnerEmptyTitle')}</b><p>{t('partnerEmptyDetail')}</p></div>} />
    {replyTo && <div className="reply-banner" data-testid="reply-preview"><Quote size={14} /><div><b>{t('replyingToMessage', { name: replyTo.senderName })}</b><span dir="auto">{replyTo.mediaType === 'image' ? t('imageAttachment') : replyTo.mediaType === 'audio' ? t('voiceNote') : replyTo.content}</span></div><button type="button" onClick={() => setReplyTo(null)} aria-label={t('removeQuote')} data-testid="button-remove-quote"><X size={14} /></button></div>}
    {imageDraft && <div className="media-draft image-draft" data-testid="image-preview"><img src={imageDraft.url} alt={t('imagePreview')} /><span>{imageDraft.file.name}</span><button type="button" onClick={clearImageDraft} aria-label={t('removeAttachment')} data-testid="button-remove-image"><Trash2 size={14} /></button></div>}
    {recording && <div className="recording-status" role="status" aria-live="polite"><span className="recording-dot" /><b>{t('recordingVoice')}</b><time>{formatDuration(recordSeconds)}</time><button type="button" onClick={cancelRecording} aria-label={t('cancelRecording')} data-testid="button-cancel-recording"><X size={15} />{t('cancel')}</button><button type="button" onClick={stopRecording} data-testid="button-finish-recording"><Pause size={14} />{t('reviewVoice')}</button></div>}
    {audioDraft && <div className="media-draft audio-draft" data-testid="audio-preview"><div><b>{t('voiceNoteReview')}</b><span>{formatDuration(audioDraft.duration)}</span></div><audio controls src={audioDraft.url} aria-label={t('voiceNoteReview')} /><button type="button" onClick={clearAudioDraft} aria-label={t('removeAttachment')} data-testid="button-remove-audio"><Trash2 size={14} /></button></div>}
    {mentionsAi && <div className="ai-hint"><Sparkles size={13} /> {t('aiWillRespond')}</div>}
    <form className="message-composer big-composer partner-composer" onSubmit={submit}>
      <button type="button" className={`ai-quick ${mentionsAi ? 'ai-quick-on' : ''}`} onClick={quickAi} title={t('quickAiLabel')} aria-label={t('quickAiLabel')} data-testid="button-quick-ai"><AtSign size={14} /><span>AI</span></button>
      <textarea ref={inputRef} rows={1} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder={t('partnerPh')} maxLength={2000} dir="auto" disabled={isReadOnly} data-testid="input-partner-message" />
      <div className="attachment-controls">
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { void handleImagePick(event.target.files?.[0]); event.currentTarget.value = ''; }} data-testid="input-image-file" />
        <button type="button" className="attachment-button" disabled={!attachmentsEnabled || mediaBusy || recording} onClick={() => imageInputRef.current?.click()} aria-label={t('attachImage')} title={t('attachImage')} data-testid="button-attach-image"><ImagePlus size={17} /></button>
        <button type="button" className={`attachment-button ${recording ? 'recording-on' : ''}`} disabled={!attachmentsEnabled || mediaBusy || !!audioDraft || recording} onClick={() => void startRecording()} aria-label={t('recordVoice')} title={t('recordVoice')} data-testid="button-record-voice"><Mic size={17} /></button>
      </div>
      <button className="send-button" disabled={(!text.trim() && !imageDraft && !audioDraft) || send.isPending || mediaBusy || recording || isReadOnly} aria-label={t('sendMessage')} data-testid="button-send-partner">{send.isPending || mediaBusy ? <LoaderCircle size={16} className="spin" /> : <Send size={16} className="flip-rtl" />}</button>
    </form>
    {isReadOnly && <p className="chat-readonly-note" role="status" data-testid="status-chat-readonly">{t('roomReadOnly')}</p>}
    {(mediaError || send.isError) && <p className="inline-error composer-error" role="alert" data-testid="status-chat-error">{mediaError || aiErrorMessage(send.error, t('messageError'))}</p>}
    {lightboxUrl && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={t('imageViewer')} onClick={() => setLightboxUrl(null)} data-testid="dialog-image-lightbox"><button type="button" className="lightbox-close" aria-label={t('close')} onClick={() => setLightboxUrl(null)} data-testid="button-close-lightbox"><X size={20} /></button><img src={lightboxUrl} alt={t('imageViewer')} onClick={(event) => event.stopPropagation()} /></div>}
  </div>;
}

export function AiChat({ room, actingUserId, viewerId, onOpenActivity }: ChatProps) {
  const { t } = useI18n();
  const send = useSendSkillSyncAiMessage();
  const refresh = useSendHelpers(room.roomId);
  const [text, setText] = useState('');
  const messages = room.messages.filter((message) => message.channel === 'ai');
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const content = text.trim();
    if (!content || send.isPending) return;
    send.mutate({ roomId: room.roomId, data: { content, simulatedUserId: actingUserId } }, { onSuccess: () => { setText(''); refresh(); } });
  };
  return <div className="chat-pane ai-pane">
    <div className="conversation-intro"><span className="room-partner-avatar ai-avatar"><Bot size={16} /></span><div><b>{t('aiIntroTitle')}</b><span>{t('aiIntroDetail')}</span></div><span className="polling-indicator"><i /> {t('live')}</span></div>
    <Feed messages={messages} roomId={room.roomId} isOwn={ownFn(room, actingUserId, viewerId)} onReply={() => undefined} canReply={false} onOpenActivity={onOpenActivity} onLightbox={() => undefined} onQuoteClick={() => undefined} empty={<div className="chat-empty"><span className="empty-chat-icon"><Sparkles size={20} /></span><b>{t('aiEmptyTitle')}</b><p>{t('aiEmptyDetail')}</p></div>} />
    {send.isPending && <div className="ai-hint thinking"><LoaderCircle size={13} className="spin" /> {t('aiThinking')}</div>}
    <form className="message-composer big-composer" onSubmit={submit}>
      <span className="ai-quick ai-quick-on static"><Sparkles size={14} /></span>
      <textarea rows={1} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={t('aiPh')} maxLength={2000} dir="auto" data-testid="input-ai-message" />
      <button className="send-button" disabled={!text.trim() || send.isPending} aria-label={t('sendMessage')} data-testid="button-send-ai">{send.isPending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} className="flip-rtl" />}</button>
    </form>
    {send.isError && <p className="inline-error composer-error">{aiErrorMessage(send.error, t('messageError'))}</p>}
  </div>;
}
