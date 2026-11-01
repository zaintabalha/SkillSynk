import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AtSign, Bot, LoaderCircle, MessageCircle, Quote, Send, ShieldCheck, Sparkles, SquareArrowOutUpRight, X } from 'lucide-react';
import { getGetSkillSyncRoomQueryKey, getListSkillSyncActivitiesQueryKey, useSendSkillSyncAiMessage, useSendSkillSyncMessage } from '@workspace/api-client-react';
import type { ChatMessage, LearningRoom } from '@workspace/api-client-react';
import { initials } from '@/components/shell';
import { formatTime, useI18n } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/ai-error';

export const AI_MENTION = /(^|\s)@(ai|skillsync)\b/i;

type ChatProps = { room: LearningRoom; actingUserId: string | null; viewerId: string | null; onOpenActivity: (id: string) => void };

function useSendHelpers(roomId: string) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: getGetSkillSyncRoomQueryKey(roomId) });
    client.invalidateQueries({ queryKey: getListSkillSyncActivitiesQueryKey(roomId) });
  };
}

function MessageBubble({ message, own, quoted, onVerify, onOpenActivity }: { message: ChatMessage; own: boolean; quoted?: ChatMessage; onVerify?: () => void; onOpenActivity: (id: string) => void }) {
  const { t, locale } = useI18n();
  const isAi = message.senderType === 'assistant';
  const isMod = message.senderType === 'moderator';
  const name = isAi ? t('aiName') : isMod ? t('guide') : message.senderName;
  return <div className={`chat-message ${own ? 'own-message' : ''} ${isAi ? 'ai-message' : ''} ${isMod ? 'moderator-message' : ''}`} data-testid={`message-${message.id}`}>
    <span className="message-avatar">{isAi ? <Sparkles size={13} /> : isMod ? <ShieldCheck size={13} /> : initials(message.senderName)}</span>
    <div className="message-content">
      <div className="message-meta"><b>{name}</b><time>{formatTime(message.createdAt, locale)}</time></div>
      {quoted && <div className="message-quote"><Quote size={11} /><span><b>{t('repliedTo', { name: quoted.senderType === 'assistant' ? t('aiName') : quoted.senderName })}</b><span dir="auto">{quoted.content}</span></span></div>}
      <p dir="auto">{message.content}</p>
      <div className="message-actions">
        {message.activityId && <button className="message-chip chip-strong" onClick={() => onOpenActivity(message.activityId as string)} data-testid={`button-open-activity-${message.id}`}><SquareArrowOutUpRight size={12} /> {t('openActivity')}</button>}
        {onVerify && <button className="message-chip" onClick={onVerify} data-testid={`button-verify-${message.id}`}><AtSign size={12} /> {t('verifyWithAi')}</button>}
      </div>
    </div>
  </div>;
}

function Feed({ messages, all, isOwn, onVerify, onOpenActivity, empty }: { messages: ChatMessage[]; all: ChatMessage[]; isOwn: (m: ChatMessage) => boolean; onVerify?: (m: ChatMessage) => void; onOpenActivity: (id: string) => void; empty: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [lastId]);
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  if (!messages.length) return <div className="message-feed">{empty}</div>;
  return <div className="message-feed" ref={ref}>{messages.map((m) => <MessageBubble key={m.id} message={m} own={isOwn(m)} quoted={m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined} onVerify={onVerify && m.senderType === 'student' && !isOwn(m) ? () => onVerify(m) : undefined} onOpenActivity={onOpenActivity} />)}</div>;
}

function ownFn(room: LearningRoom, actingUserId: string | null, viewerId: string | null) {
  return (m: ChatMessage) => {
    if (m.senderType !== 'student') return false;
    if (actingUserId) return m.senderId === actingUserId;
    if (viewerId) return m.senderId === viewerId;
    return m.senderId !== room.partnerUserId;
  };
}

export function PartnerChat({ room, actingUserId, viewerId, onOpenActivity }: ChatProps) {
  const { t } = useI18n();
  const send = useSendSkillSyncMessage();
  const refresh = useSendHelpers(room.roomId);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messages = room.messages.filter((m) => m.channel === 'partner');
  const mentionsAi = AI_MENTION.test(text);
  const partnerName = room.participants?.find((p) => p.userId !== (actingUserId || viewerId))?.displayName || room.partnerName;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || send.isPending) return;
    send.mutate({ roomId: room.roomId, data: { content, replyToMessageId: replyTo?.id ?? null, simulatedUserId: actingUserId } }, { onSuccess: () => { setText(''); setReplyTo(null); refresh(); } });
  };
  const quickAi = () => { setText((v) => (AI_MENTION.test(v) ? v : `@AI ${v}`)); inputRef.current?.focus(); };
  const verify = (m: ChatMessage) => { setReplyTo(m); setText(t('verifyPrefix')); inputRef.current?.focus(); };

  return <div className="chat-pane">
    <div className="conversation-intro"><span className="room-partner-avatar">{initials(partnerName)}</span><div><b>{t('partnerIntro', { name: partnerName })}</b><span>{t('partnerIntroDetail')}</span></div><span className="polling-indicator"><i /> {t('live')}</span></div>
    <Feed messages={messages} all={room.messages} isOwn={ownFn(room, actingUserId, viewerId)} onVerify={verify} onOpenActivity={onOpenActivity} empty={<div className="chat-empty"><span className="empty-chat-icon"><MessageCircle size={20} /></span><b>{t('partnerEmptyTitle')}</b><p>{t('partnerEmptyDetail')}</p></div>} />
    {replyTo && <div className="reply-banner"><Quote size={14} /><div><b>{t('replyingTo')}</b><span dir="auto">{replyTo.senderName}: {replyTo.content}</span></div><button onClick={() => setReplyTo(null)} aria-label={t('removeQuote')} data-testid="button-remove-quote"><X size={14} /></button></div>}
    {mentionsAi && <div className="ai-hint"><Sparkles size={13} /> {t('aiWillRespond')}</div>}
    <form className="message-composer big-composer" onSubmit={submit}>
      <button type="button" className={`ai-quick ${mentionsAi ? 'ai-quick-on' : ''}`} onClick={quickAi} title={t('quickAiLabel')} aria-label={t('quickAiLabel')} data-testid="button-quick-ai"><AtSign size={14} /><span>AI</span></button>
      <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder={t('partnerPh')} maxLength={2000} dir="auto" data-testid="input-partner-message" />
      <button className="send-button" disabled={!text.trim() || send.isPending} aria-label={t('sendMessage')} data-testid="button-send-partner">{send.isPending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} className="flip-rtl" />}</button>
    </form>
    {send.isError && <p className="inline-error composer-error">{aiErrorMessage(send.error, t('messageError'))}</p>}
  </div>;
}

export function AiChat({ room, actingUserId, viewerId, onOpenActivity }: ChatProps) {
  const { t } = useI18n();
  const send = useSendSkillSyncAiMessage();
  const refresh = useSendHelpers(room.roomId);
  const [text, setText] = useState('');
  const messages = room.messages.filter((m) => m.channel === 'ai');
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || send.isPending) return;
    send.mutate({ roomId: room.roomId, data: { content, simulatedUserId: actingUserId } }, { onSuccess: () => { setText(''); refresh(); } });
  };
  return <div className="chat-pane ai-pane">
    <div className="conversation-intro"><span className="room-partner-avatar ai-avatar"><Bot size={16} /></span><div><b>{t('aiIntroTitle')}</b><span>{t('aiIntroDetail')}</span></div><span className="polling-indicator"><i /> {t('live')}</span></div>
    <Feed messages={messages} all={room.messages} isOwn={ownFn(room, actingUserId, viewerId)} onOpenActivity={onOpenActivity} empty={<div className="chat-empty"><span className="empty-chat-icon"><Sparkles size={20} /></span><b>{t('aiEmptyTitle')}</b><p>{t('aiEmptyDetail')}</p></div>} />
    {send.isPending && <div className="ai-hint thinking"><LoaderCircle size={13} className="spin" /> {t('aiThinking')}</div>}
    <form className="message-composer big-composer" onSubmit={submit}>
      <span className="ai-quick ai-quick-on static"><Sparkles size={14} /></span>
      <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder={t('aiPh')} maxLength={2000} dir="auto" data-testid="input-ai-message" />
      <button className="send-button" disabled={!text.trim() || send.isPending} aria-label={t('sendMessage')} data-testid="button-send-ai">{send.isPending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} className="flip-rtl" />}</button>
    </form>
    {send.isError && <p className="inline-error composer-error">{aiErrorMessage(send.error, t('messageError'))}</p>}
  </div>;
}
