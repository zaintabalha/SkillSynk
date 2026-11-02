import './_group.css';
import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  CornerDownLeft,
  Eraser,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Terminal,
} from 'lucide-react';

const activity = {
  scenario: 'You are preparing a small helper for a study partner who needs to clean up a list of skill tags.',
  prompt: 'Write a JavaScript function that trims each tag and removes empty entries.',
  starter: 'function cleanTags(tags) {\n  // Write your solution here\n}',
  hint: 'Use map to trim each tag, then filter out empty strings.',
};

export function Playground() {
  const [value, setValue] = useState(activity.starter);
  const [showHint, setShowHint] = useState(false);
  const [checked, setChecked] = useState(false);

  const clearResponse = () => {
    setValue('function cleanTags(tags) {\n  \n}');
    setChecked(false);
  };

  const resetResponse = () => {
    setValue(activity.starter);
    setChecked(false);
    setShowHint(false);
  };

  return (
    <main className="ss-playground">
      <style>{`
        .ss-playground {
          --ss-forest: #244b3b;
          --ss-forest-deep: #19392e;
          --ss-leaf: #557c5f;
          --ss-moss: #e6ecdf;
          --ss-cream: #f5f2e8;
          --ss-paper: #fffdf7;
          --ss-ink: #263e33;
          --ss-muted: #78877b;
          --ss-line: #e4e4d8;
          min-height: 100vh;
          padding: clamp(18px, 3.6vw, 48px);
          color: var(--ss-ink);
          background:
            radial-gradient(ellipse at 92% 7%, rgba(208, 220, 194, .35), transparent 29rem),
            var(--ss-cream);
          font-family: var(--app-font-sans);
        }
        .ss-shell { max-width: 1240px; margin: 0 auto; }
        .ss-topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 18px; padding-bottom: 24px; border-bottom: 1px solid #dedfd2;
        }
        .ss-brand { display: flex; align-items: center; gap: 11px; }
        .ss-brand-mark {
          display: grid; place-items: center; width: 38px; height: 38px;
          border-radius: 13px 6px 13px 6px; color: #f7f4e8; background: var(--ss-forest);
        }
        .ss-brand-name { font: 800 17px/1 var(--app-font-serif); letter-spacing: -.045em; color: var(--ss-forest-deep); }
        .ss-brand-sub { margin-top: 5px; font: 600 9px/1 var(--app-font-mono); letter-spacing: .12em; color: #8a9588; text-transform: uppercase; }
        .ss-top-meta { display: flex; align-items: center; gap: 20px; color: #7b887c; font-size: 11px; }
        .ss-top-meta span { display: inline-flex; align-items: center; gap: 7px; }
        .ss-progress-dot { width: 7px; height: 7px; border-radius: 50%; background: #8ca476; box-shadow: 0 0 0 4px #e4eadb; }
        .ss-workspace { padding-top: clamp(24px, 4vw, 48px); }
        .ss-crumb { display: flex; align-items: center; gap: 9px; color: #839084; font-size: 11px; }
        .ss-crumb strong { color: #4c6855; font-weight: 700; }
        .ss-title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin: 20px 0 25px; }
        .ss-title-copy { max-width: 720px; }
        .ss-kicker { display: flex; align-items: center; gap: 8px; color: #66836a; font: 700 10px var(--app-font-mono); letter-spacing: .09em; text-transform: uppercase; }
        .ss-title-copy h1 { margin: 11px 0 8px; color: var(--ss-forest-deep); font: 700 clamp(29px, 4vw, 43px)/1.1 var(--app-font-serif); letter-spacing: -.055em; }
        .ss-title-copy > p { margin: 0; color: #7a887b; font-size: 13px; line-height: 1.65; }
        .ss-session-chip { display: flex; flex: 0 0 auto; align-items: center; gap: 9px; padding: 10px 13px; border: 1px solid #dfe4d7; border-radius: 12px; color: #58735d; background: rgba(255,253,247,.66); font-size: 11px; }
        .ss-session-chip svg { color: #83966c; }
        .ss-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
        .ss-main-column { min-width: 0; }
        .ss-brief {
          display: grid; grid-template-columns: .92fr 1.08fr; gap: 1px; overflow: hidden;
          margin-bottom: 15px; border: 1px solid #e2e3d8; border-radius: 17px 7px 17px 7px;
          background: #e2e3d8; box-shadow: 0 7px 20px rgba(40, 65, 48, .035);
        }
        .ss-brief-block { padding: 19px 21px 20px; background: var(--ss-paper); }
        .ss-brief-label { display: flex; align-items: center; gap: 8px; color: #829080; font: 700 9px var(--app-font-mono); letter-spacing: .12em; text-transform: uppercase; }
        .ss-brief-label i { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 7px; color: #54775c; background: #edf1e6; font-style: normal; }
        .ss-brief-block p { margin: 12px 0 0; color: #526457; font-size: 13px; line-height: 1.65; }
        .ss-brief-block.task { background: #f9f8f1; }
        .ss-editor-card {
          overflow: hidden; border: 1px solid #dce0d5; border-radius: 18px 7px 18px 7px;
          background: var(--ss-paper); box-shadow: 0 12px 34px rgba(41, 66, 49, .065);
        }
        .ss-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 19px; border-bottom: 1px solid #e8e8de; }
        .ss-editor-title { display: flex; align-items: center; gap: 10px; }
        .ss-editor-icon { display: grid; place-items: center; width: 29px; height: 29px; border-radius: 9px; color: #557961; background: #edf1e6; }
        .ss-editor-title strong { display: block; color: #3f5747; font-size: 12px; }
        .ss-editor-title small { display: block; margin-top: 3px; color: #98a094; font-size: 10px; }
        .ss-editor-controls { display: flex; align-items: center; gap: 6px; }
        .ss-control {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 32px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px;
          color: #738175; background: transparent; font-size: 10px; font-weight: 700; cursor: pointer;
          transition: background .18s ease, color .18s ease, border-color .18s ease;
        }
        .ss-control:hover { color: #3e684c; border-color: #e1e7dc; background: #f6f7f0; }
        .ss-editor-bar { display: flex; align-items: center; justify-content: space-between; padding: 9px 16px; background: #f4f4ec; }
        .ss-file-tab { display: inline-flex; align-items: center; gap: 7px; color: #647467; font: 11px var(--app-font-mono); }
        .ss-file-tab svg { color: #79926d; }
        .ss-lang { display: flex; align-items: center; gap: 6px; color: #869084; font-size: 10px; }
        .ss-editor-body { display: grid; grid-template-columns: 43px minmax(0,1fr); min-height: 290px; background: var(--ss-forest-deep); }
        .ss-line-numbers { padding: 19px 11px 18px 0; text-align: right; color: #6e8b78; font: 12px/1.8 var(--app-font-mono); user-select: none; }
        .ss-editor-body textarea {
          width: 100%; min-height: 290px; padding: 17px 20px 18px 0; border: 0; outline: 0;
          resize: vertical; color: #e7eddb; caret-color: #cfdb9e; background: transparent;
          font: 12px/1.8 var(--app-font-mono); tab-size: 2; white-space: pre; overflow: auto;
        }
        .ss-editor-body textarea::selection { color: #20392d; background: #cad7a9; }
        .ss-editor-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 17px; border-top: 1px solid rgba(255,255,255,.08); background: var(--ss-forest-deep); color: #91a395; font-size: 10px; }
        .ss-foot-left { display: flex; align-items: center; gap: 7px; }
        .ss-foot-left svg { color: #b6ca86; }
        .ss-submit-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 15px; }
        .ss-hint-button { display: inline-flex; align-items: center; gap: 8px; padding: 9px 1px; border: 0; color: #658168; background: transparent; font-size: 11px; font-weight: 700; cursor: pointer; }
        .ss-hint-button:hover { color: #355d43; }
        .ss-actions { display: flex; align-items: center; gap: 10px; }
        .ss-reset { display: inline-flex; align-items: center; gap: 7px; padding: 10px 12px; border: 1px solid #dce2d7; border-radius: 9px; color: #6b7e6d; background: #faf9f3; font-size: 11px; font-weight: 700; cursor: pointer; }
        .ss-reset:hover { background: #f0f2e9; }
        .ss-check {
          display: inline-flex; align-items: center; gap: 9px; padding: 11px 16px; border: 0;
          border-radius: 10px 4px 10px 4px; color: #fbf8ed; background: #356349;
          box-shadow: 0 5px 12px rgba(44, 86, 60, .15); font-size: 11px; font-weight: 700; cursor: pointer;
          transition: transform .18s ease, background .18s ease;
        }
        .ss-check:hover { transform: translateY(-1px); background: #284f3b; }
        .ss-check kbd { display: inline-flex; align-items: center; gap: 4px; padding-left: 8px; border-left: 1px solid rgba(255,255,255,.23); color: #d5e0ce; font: 9px var(--app-font-mono); }
        .ss-hint {
          display: flex; gap: 10px; margin-top: 14px; padding: 13px 15px; border: 1px solid #e4ddc8;
          border-radius: 11px; color: #76694e; background: #f8f1df; font-size: 12px; line-height: 1.55;
        }
        .ss-hint svg { flex: 0 0 auto; margin-top: 1px; color: #b38b4b; }
        .ss-side { display: flex; flex-direction: column; gap: 14px; }
        .ss-side-card { padding: 19px; border: 1px solid #e1e3d8; border-radius: 15px 6px 15px 6px; background: rgba(255,253,247,.8); }
        .ss-side-eyebrow { display: flex; align-items: center; justify-content: space-between; color: #889285; font: 700 9px var(--app-font-mono); letter-spacing: .11em; text-transform: uppercase; }
        .ss-side-heading { margin: 13px 0 6px; color: #375341; font: 700 18px/1.25 var(--app-font-serif); letter-spacing: -.03em; }
        .ss-side-copy { margin: 0; color: #839084; font-size: 11px; line-height: 1.6; }
        .ss-steps { display: flex; flex-direction: column; gap: 15px; margin: 19px 0 0; padding: 0; list-style: none; }
        .ss-steps li { display: flex; align-items: flex-start; gap: 10px; color: #6e7d70; font-size: 11px; line-height: 1.5; }
        .ss-step-num { display: grid; place-items: center; flex: 0 0 21px; height: 21px; border: 1px solid #dce4d5; border-radius: 50%; color: #6e8c70; background: #f6f7ef; font: 10px var(--app-font-mono); }
        .ss-side-divider { height: 1px; margin: 17px 0 13px; background: #e8e8dd; }
        .ss-notice { display: flex; gap: 9px; color: #8b866f; font-size: 10px; line-height: 1.55; }
        .ss-notice svg { flex: 0 0 auto; color: #9b9b7b; }
        .ss-result { border-color: #d5e2d2; background: #f5f8ef; animation: ss-rise .24s ease-out both; }
        .ss-result .ss-side-eyebrow { color: #69826a; }
        .ss-result-title { display: flex; align-items: center; gap: 9px; margin-top: 14px; color: #355c40; font: 700 17px var(--app-font-serif); }
        .ss-result-title svg { color: #5c8b62; }
        .ss-result p { margin: 8px 0 14px; color: #718271; font-size: 11px; line-height: 1.6; }
        .ss-result-list { display: flex; flex-direction: column; gap: 9px; padding-top: 12px; border-top: 1px solid #e1e9dc; }
        .ss-result-list span { display: flex; align-items: center; gap: 8px; color: #617664; font-size: 10px; }
        .ss-result-list svg { color: #6f9b71; }
        .ss-result-list .ss-review svg { color: #c18a4e; }
        .ss-empty-result { display: grid; place-items: center; min-height: 166px; text-align: center; }
        .ss-empty-icon { display: grid; place-items: center; width: 37px; height: 37px; border-radius: 12px 5px 12px 5px; color: #81957d; background: #edf1e7; }
        .ss-empty-result strong { display: block; margin-top: 11px; color: #5a705e; font: 700 14px var(--app-font-serif); }
        .ss-empty-result p { max-width: 205px; margin: 6px 0 0; color: #899388; font-size: 10px; line-height: 1.55; }
        .ss-next-link { display: flex; align-items: center; justify-content: space-between; margin-top: 13px; padding-top: 13px; border-top: 1px solid #e9e9df; color: #638068; font-size: 10px; }
        .ss-next-link strong { font-weight: 700; }
        @keyframes ss-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 820px) {
          .ss-layout { grid-template-columns: minmax(0,1fr) 250px; gap: 14px; }
          .ss-side-card { padding: 16px; }
          .ss-session-chip { display: none; }
        }
        @media (max-width: 680px) {
          .ss-playground { padding: 17px 13px 28px; }
          .ss-topbar { padding-bottom: 17px; }
          .ss-top-meta { gap: 10px; font-size: 10px; }
          .ss-top-meta span:last-child { display: none; }
          .ss-workspace { padding-top: 22px; }
          .ss-title-row { margin: 17px 0 20px; }
          .ss-title-copy h1 { font-size: 32px; }
          .ss-layout { grid-template-columns: 1fr; }
          .ss-brief { grid-template-columns: 1fr; }
          .ss-brief-block { padding: 16px 17px; }
          .ss-side { display: grid; grid-template-columns: 1fr; }
          .ss-side-card:not(.ss-result) { order: 2; }
          .ss-result { order: 1; }
          .ss-editor-head { padding: 12px 13px; }
          .ss-editor-controls .ss-control { width: 32px; padding: 0; font-size: 0; }
          .ss-editor-controls .ss-control svg { width: 15px; height: 15px; }
          .ss-editor-body, .ss-editor-body textarea { min-height: 260px; }
          .ss-editor-body textarea { padding-right: 12px; font-size: 11px; }
          .ss-line-numbers { padding-left: 4px; font-size: 11px; }
          .ss-editor-foot { align-items: flex-start; flex-direction: column; gap: 5px; }
          .ss-submit-row { align-items: flex-start; flex-direction: column; }
          .ss-actions { width: 100%; }
          .ss-check { flex: 1; justify-content: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ss-playground *, .ss-playground *::before, .ss-playground *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>
      <div className="ss-shell">
        <header className="ss-topbar">
          <div className="ss-brand" aria-label="SkillSync">
            <span className="ss-brand-mark"><Code2 size={18} strokeWidth={1.8} /></span>
            <div><div className="ss-brand-name">SkillSync</div><div className="ss-brand-sub">Teach one. Learn one.</div></div>
          </div>
          <div className="ss-top-meta">
            <span><i className="ss-progress-dot" /> Workshop session</span>
            <span>Activity 02 <ChevronDown size={13} /></span>
          </div>
        </header>

        <section className="ss-workspace">
          <div className="ss-crumb"><span>Shared activity</span><span>/</span><strong>Simulator</strong></div>
          <div className="ss-title-row">
            <div className="ss-title-copy">
              <div className="ss-kicker"><Sparkles size={13} /> Coding simulator <span>·</span> 8 min practice</div>
              <h1>Clean up a list of skill tags</h1>
              <p>Try a small solution, then use the feedback to decide what to refine next.</p>
            </div>
            <div className="ss-session-chip"><span className="ss-progress-dot" /> Learning together <ArrowUpRight size={14} /></div>
          </div>

          <div className="ss-layout">
            <div className="ss-main-column">
              <div className="ss-brief">
                <div className="ss-brief-block">
                  <div className="ss-brief-label"><i><CircleHelp size={13} /></i> The situation</div>
                  <p>{activity.scenario}</p>
                </div>
                <div className="ss-brief-block task">
                  <div className="ss-brief-label"><i><CheckCircle2 size={13} /></i> Your task</div>
                  <p>{activity.prompt}</p>
                </div>
              </div>

              <section className="ss-editor-card" aria-label="Response editor">
                <div className="ss-editor-head">
                  <div className="ss-editor-title">
                    <span className="ss-editor-icon"><Code2 size={15} /></span>
                    <div><strong>Your response</strong><small>A first draft is a good place to start</small></div>
                  </div>
                  <div className="ss-editor-controls">
                    <button className="ss-control" type="button" onClick={clearResponse} aria-label="Clear response"><Eraser size={14} /> Clear</button>
                    <button className="ss-control" type="button" onClick={resetResponse} aria-label="Reset starter code"><RotateCcw size={14} /> Reset</button>
                  </div>
                </div>
                <div className="ss-editor-bar">
                  <span className="ss-file-tab"><Code2 size={13} /> solution.js</span>
                  <span className="ss-lang">JavaScript <ChevronDown size={12} /></span>
                </div>
                <div className="ss-editor-body">
                  <div className="ss-line-numbers" aria-hidden="true">{Array.from({ length: Math.max(10, value.split('\n').length) }, (_, index) => <div key={index}>{index + 1}</div>)}</div>
                  <textarea
                    aria-label="Write your JavaScript response"
                    dir="ltr"
                    spellCheck={false}
                    value={value}
                    onChange={(event) => { setValue(event.target.value); setChecked(false); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Tab') {
                        event.preventDefault();
                        const start = event.currentTarget.selectionStart;
                        const end = event.currentTarget.selectionEnd;
                        const target = event.currentTarget;
                        const next = `${value.slice(0, start)}  ${value.slice(end)}`;
                        setValue(next);
                        requestAnimationFrame(() => {
                          target.selectionStart = start + 2;
                          target.selectionEnd = start + 2;
                        });
                      }
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') setChecked(true);
                    }}
                  />
                </div>
                <div className="ss-editor-foot">
                  <span className="ss-foot-left"><Terminal size={13} /> Your code stays in this practice space</span>
                  <span>JavaScript · UTF-8</span>
                </div>
              </section>

              <div className="ss-submit-row">
                <button className="ss-hint-button" type="button" onClick={() => setShowHint((visible) => !visible)} aria-expanded={showHint}>
                  <Lightbulb size={15} /> {showHint ? 'Hide hint' : 'Need a nudge? Show a hint'}
                </button>
                <div className="ss-actions">
                  <button className="ss-reset" type="button" onClick={resetResponse}><RotateCcw size={13} /> Start over</button>
                  <button className="ss-check" type="button" onClick={() => setChecked(true)}>
                    <Check size={15} /> Check my approach <kbd><CornerDownLeft size={10} /> Enter</kbd>
                  </button>
                </div>
              </div>
              {showHint && <div className="ss-hint"><Lightbulb size={15} /><span>{activity.hint}</span></div>}
            </div>

            <aside className="ss-side">
              {checked ? (
                <section className="ss-side-card ss-result" aria-live="polite">
                  <div className="ss-side-eyebrow"><span>Practice check</span><CheckCircle2 size={14} /></div>
                  <div className="ss-result-title"><Sparkles size={17} /> A useful first pass</div>
                  <p>Your attempt is saved for this preview. Consider how each step handles a tag before moving on.</p>
                  <div className="ss-result-list">
                    <span><CheckCircle2 size={14} /> Trimming whitespace</span>
                    <span><CheckCircle2 size={14} /> Returning a cleaned list</span>
                    <span className="ss-review"><CircleHelp size={14} /> Filtering empty entries</span>
                  </div>
                </section>
              ) : (
                <section className="ss-side-card">
                  <div className="ss-side-eyebrow"><span>After you check</span><Sparkles size={14} /></div>
                  <div className="ss-empty-result">
                    <div>
                      <span className="ss-empty-icon"><Code2 size={17} /></span>
                      <strong>Your feedback will land here</strong>
                      <p>Submit an attempt to see a small, friendly review of the approach.</p>
                    </div>
                  </div>
                </section>
              )}

              <section className="ss-side-card">
                <div className="ss-side-eyebrow"><span>A gentle way through</span><CircleHelp size={14} /></div>
                <div className="ss-side-heading">Try, then tune.</div>
                <p className="ss-side-copy">There is no single perfect first draft. Use this short loop to make your thinking visible.</p>
                <ol className="ss-steps">
                  <li><span className="ss-step-num">1</span><span>Read the situation and name the small problem.</span></li>
                  <li><span className="ss-step-num">2</span><span>Write the simplest version you can explain.</span></li>
                  <li><span className="ss-step-num">3</span><span>Check the feedback, then refine one thing.</span></li>
                </ol>
                <div className="ss-side-divider" />
                <div className="ss-notice"><CircleHelp size={13} /><span>Practice feedback is a demo, not an execution of your code.</span></div>
                <div className="ss-next-link"><strong>Keep your curiosity close</strong><ArrowUpRight size={13} /></div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
