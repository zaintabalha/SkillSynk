import './_group.css';
import { useState } from 'react';
import { Check, Code2, Languages } from 'lucide-react';

const simulator = {
  mode: 'coding' as const,
  scenario: 'You are preparing a small helper for a study partner who needs to clean up a list of skill tags.',
  prompt: 'Write a JavaScript function that trims each tag and removes empty entries.',
  starter: 'function cleanTags(tags) {\n  // Write your solution here\n}',
  expected: 'function cleanTags(tags) {\n  return tags.map((tag) => tag.trim()).filter(Boolean);\n}',
  hint: 'Use map to trim each tag, then filter out empty strings.',
};

export function Current() {
  const [value, setValue] = useState(simulator.starter);
  const [hint, setHint] = useState(false);
  const [compare, setCompare] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <main className="current-sim-page">
      <section className="current-sim-frame">
        <header className="current-sim-head">
          <span>Shared activity / Simulator</span>
          <h1>Clean up a list of skill tags</h1>
          <p>Practice a small coding task together, then compare your approach.</p>
        </header>
        <div className="sim-mode"><Code2 size={14} /> Coding simulator</div>
        <div className="sim-brief">
          <div><small>Scenario</small><p>{simulator.scenario}</p></div>
          <div><small>Task</small><p>{simulator.prompt}</p></div>
        </div>
        <label className="sim-editor">
          <span>Your response</span>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={10} spellCheck={false} dir="ltr" className="code" />
        </label>
        <p className="sim-honest">Practice check only: attempts are compared with the reference answer as normalized exact text. Code is not executed and meaning is not graded.</p>
        <div className="sim-tools">
          <button className="quiet-button" onClick={() => setHint((visible) => !visible)}>Show a hint</button>
          <button className="quiet-button" onClick={() => setCompare((visible) => !visible)}>Compare with reference</button>
        </div>
        {hint && <div className="sim-note">{simulator.hint}</div>}
        {compare && <div className="sim-note sim-expected"><small>Reference answer</small><pre dir="ltr">{simulator.expected}</pre></div>}
        <div className="current-submit"><button onClick={() => setSaved(true)}><Check size={15} /> Submit attempt</button></div>
        {saved && <p className="current-feedback">Attempt saved.</p>}
      </section>
    </main>
  );
}
