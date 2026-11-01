import { useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Send } from 'lucide-react';
import { useSubmitSkillSyncReport } from '@workspace/api-client-react';
import type { ReportInputCategory } from '@workspace/api-client-react';
import { Modal } from '@/components/shell';
import { useI18n, type DictKey } from '@/lib/i18n';

const categories: { value: ReportInputCategory; label: DictKey }[] = [
  { value: 'inactive_partner', label: 'catInactive' },
  { value: 'inappropriate_behavior', label: 'catBehavior' },
  { value: 'technical_issue', label: 'catTechnical' },
  { value: 'other', label: 'catOther' },
];

export function ReportDialog({ roomId, reportedUserId, onClose }: { roomId?: string; reportedUserId?: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const submit = useSubmitSkillSyncReport();
  const [category, setCategory] = useState<ReportInputCategory>('inactive_partner');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const valid = summary.trim().length >= 4 && details.trim().length >= 10;
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    submit.mutate({ data: { category, summary: summary.trim(), details: details.trim(), roomId: roomId ?? null, reportedUserId: reportedUserId ?? null } });
  };
  return <Modal title={t('reportTitle')} detail={t('reportDetail')} onClose={onClose}>
    {submit.isSuccess ? <div className="modal-success"><span className="state-symbol"><Check size={20} /></span><p>{t('reportSent')}</p><button className="button" onClick={onClose} data-testid="button-report-done">{t('close')}</button></div> :
    <form onSubmit={send} className="modal-form">
      <label className="field"><span>{t('category')}</span><select value={category} onChange={(e) => setCategory(e.target.value as ReportInputCategory)} data-testid="select-report-category">{categories.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}</select></label>
      <label className="field"><span>{t('summary')}</span><input maxLength={120} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t('summaryPh')} dir="auto" data-testid="input-report-summary" /></label>
      <label className="field"><span>{t('details')}</span><textarea rows={5} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t('detailsPh')} dir="auto" data-testid="input-report-details" /><small className="field-count">{details.length}/2000</small></label>
      {submit.isError && <p className="inline-error">{t('reportError')}</p>}
      <div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>{t('cancel')}</button><button className="button" disabled={!valid || submit.isPending} data-testid="button-send-report">{submit.isPending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} className="flip-rtl" />}{submit.isPending ? t('sending') : t('sendReport')}</button></div>
    </form>}
  </Modal>;
}
