import React, { useState } from 'react';
import { agentRequest } from '../agentApi';

function DraftCard({ action, onResolve, disabled }) {
  const [payload, setPayload] = useState(action.payload);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const labels = { title: 'Intention', date: 'Date', original_text: 'Your reflection', meal_type: 'Meal (optional)', mood_label: 'Feeling, in your words (optional)', context_text: 'Context (optional)', status: 'Intention status' };
  async function decide(decision) {
    setError(''); setBusy(true);
    try { await onResolve(action, decision, payload); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="Review draft" className="border border-base-300 rounded-xl p-4 grid gap-3">
    <h3 className="font-medium">Review before saving</h3>
    <p className="text-sm opacity-70">These are draft fields. Edit anything that doesn’t fit, or cancel.</p>
    {Object.entries(payload).filter(([key]) => key !== 'goal_id').map(([key, value]) => <label className="form-control" key={key}>
      <span className="label-text">{labels[key] || key}</span>
      {key === 'meal_type' || key === 'status' ? <select className="select select-bordered" value={value || ''} disabled={busy || disabled} onChange={e => setPayload({ ...payload, [key]: e.target.value || null })}>
        {(key === 'meal_type' ? ['', 'breakfast', 'lunch', 'dinner', 'snack'] : ['active', 'completed', 'paused', 'archived']).map(v => <option key={v} value={v}>{v || 'Not specified'}</option>)}
      </select> : <input className="input input-bordered" type={key === 'date' ? 'date' : 'text'} value={value || ''} maxLength={key === 'title' ? 200 : key === 'mood_label' ? 80 : key === 'original_text' ? 1000 : 500} disabled={busy || disabled} onChange={e => setPayload({ ...payload, [key]: e.target.value || (['mood_label', 'context_text'].includes(key) ? null : '') })} />}
    </label>)}
    {error && <p role="alert" className="text-error">{error}</p>}
    <div className="flex gap-2"><button className="btn btn-sm btn-primary" disabled={busy || disabled} onClick={() => decide('confirm')}>Save this version</button><button className="btn btn-sm btn-ghost" disabled={busy || disabled} onClick={() => decide('cancel')}>Cancel</button></div>
  </section>;
}

export default function ReflectionPanel() {
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState(false);
  const [notes, setNotes] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState('observing');
  const [goals, setGoals] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  async function start() {
    setBusy(true); setError('');
    try {
      const data = await agentRequest('/sessions', { method: 'POST', body: { history, notes: history && notes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      setSession(data.id); setMessages([]); setState(data.state);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function send(text = input, event) {
    if (!text.trim()) return;
    setBusy(true); setError('');
    try {
      const reply = await agentRequest(`/sessions/${session}/messages`, { method: 'POST', body: { message: text, ...(event ? { event } : {}) } });
      setMessages(prev => [...prev, { role: 'user', message: text }, { role: 'assistant', ...reply }]);
      setState(reply.state); setInput('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function resolve(action, decision, payload) {
    const receipt = await agentRequest(`/sessions/${session}/actions/${action.id}`, { method: 'POST', body: { decision, payload, payload_hash: action.payload_hash } });
    setMessages(prev => [...prev.map(m => ({ ...m, actions: m.actions?.filter(a => a.id !== action.id) })), { role: 'receipt', message: receipt.saved ? 'Saved the version you confirmed.' : 'Draft cancelled. Nothing was saved.' }]);
    setGoals(null);
  }
  async function end() {
    setBusy(true); setError('');
    try {
      await agentRequest(`/sessions/${session}`, { method: 'DELETE' });
      setSession(null); setMessages([]); setState('observing');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function showGoals() {
    setBusy(true); setError('');
    try { const data = await agentRequest('/goals'); setGoals(data.goals); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function deleteData() {
    setBusy(true); setError('');
    try {
      await agentRequest('/data', { method: 'DELETE' });
      setSession(null); setMessages([]); setGoals([]); setDeletePrompt(false);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl mx-auto grid gap-5">
    <header><h2 className="text-2xl font-medium">Reflect, at your pace</h2><p className="mt-2 opacity-80">Notice something, check whether it fits, and choose what comes next. You can leave it there at any time.</p></header>
    <aside className="bg-base-200 rounded-xl p-4 text-sm">
      <strong>Local demo · fictional meal history</strong>
      <p className="mt-1">The agent uses a separate sample dataset, not your existing meal diary. Messages and any sample records you choose to share go to the configured model provider (Google Gemini by default). Please use fictional information here.</p>
      <p className="mt-1">This is reflection support, not clinical care or an emergency service. Source cards are checked against their linked pages, but have not received clinical review.</p>
    </aside>
    {!session ? <section className="grid gap-3" aria-label="Reflection permissions">
      <label className="flex gap-3 items-start"><input className="checkbox checkbox-sm" type="checkbox" checked={history} onChange={e => { setHistory(e.target.checked); if (!e.target.checked) setNotes(false); }} /><span>Allow recent fictional meals and check-ins (up to 30 days)</span></label>
      <label className="flex gap-3 items-start"><input className="checkbox checkbox-sm" type="checkbox" disabled={!history} checked={notes} onChange={e => setNotes(e.target.checked)} /><span>Also include their notes and my confirmed demo reflections</span></label>
      <p className="text-sm opacity-70">You can start without sharing history. Conversations expire after 24 hours and are removed on the next request. Saved intentions stay until you delete them.</p>
      <button className="btn btn-primary justify-self-start" disabled={busy} onClick={start}>Start a reflection</button>
    </section> : <>
      <div className="flex flex-wrap gap-2 items-center text-sm"><span>{history ? `Fictional history allowed${notes ? ', including notes' : '; notes excluded'}` : 'Conversation only'}</span><button className="btn btn-xs btn-ghost" disabled={busy} onClick={end}>End & delete conversation</button></div>
      <div role="log" aria-live="polite" aria-label="Reflection conversation" className="grid gap-5">
        {messages.map((m, i) => <article key={i} className={m.role === 'user' ? 'pl-6 border-l-2 border-base-300' : 'grid gap-3'}>
          <p className="text-xs opacity-60">{m.role === 'user' ? 'You' : m.role === 'receipt' ? 'NourishSteps' : 'Reflection companion'}</p>
          <p className="whitespace-pre-wrap">{m.message}</p>
          {m.evidence?.length > 0 && <details><summary className="text-sm cursor-pointer">Records behind this observation</summary><ul className="text-sm grid gap-2 mt-2">{m.evidence.map(e => <li key={e.ref}>{e.date} · {e.meal_type || 'check-in'} · {e.status || e.meal_status || 'reflection'}{e.note ? ` — ${e.note}` : ''}{e.context_text ? ` — ${e.context_text}` : ''}</li>)}</ul></details>}
          {m.sources?.map(source => <section key={source.id} className="border border-base-300 rounded-xl p-4"><h3 className="font-medium">{source.title}</h3><p className="mt-2 text-sm">{source.excerpt}</p><a className="link text-sm" href={source.source_url} target="_blank" rel="noreferrer">{source.publisher} · Read source</a><p className="text-xs opacity-60 mt-1">Source checked {source.reviewed_at}; not clinically reviewed</p></section>)}
          {m.actions?.map(action => <DraftCard key={action.id} action={action} onResolve={resolve} disabled={busy} />)}
        </article>)}
      </div>
      {state === 'awaiting_verification' && <div className="flex flex-wrap gap-2" aria-label="Check this interpretation"><button className="btn btn-sm" disabled={busy} onClick={() => send('That connection fits my experience.', 'verify')}>That fits</button><button className="btn btn-sm" disabled={busy} onClick={() => send(input || 'That connection does not fit my experience.', 'correct')}>That doesn’t fit</button></div>}
      {state !== 'closed' && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); send(); }}>
        <label className="form-control"><span className="label-text">What would you like to reflect on?</span><textarea className="textarea textarea-bordered" rows={3} maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="For example: could we look for a pattern in the sample lunches?" /></label>
        <div className="flex gap-2"><button className="btn btn-primary" disabled={busy || !input.trim()}>{busy ? 'Working…' : 'Send'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => send('Leave it here')}>Leave it here</button></div>
      </form>}
    </>}
    {error && <p role="alert" className="text-error text-sm">{error}</p>}
    <section className="border-t border-base-300 pt-4 grid gap-3"><button className="btn btn-sm justify-self-start" disabled={busy} onClick={showGoals}>View my demo intentions</button>
      {goals && <ul className="grid gap-2">{!goals.length && <li className="text-sm opacity-70">No saved intentions. There’s no need to create one.</li>}{goals.map(goal => <li key={goal.id} className="text-sm">{goal.title} · {goal.status}{session && <button className="btn btn-xs btn-ghost ml-2" disabled={busy} onClick={() => send(`I'd like to revisit my intention: ${goal.title}`)}>Reflect on this</button>}</li>)}</ul>}
      <button className="btn btn-xs btn-ghost justify-self-start" disabled={busy} onClick={() => setDeletePrompt(true)}>Delete my demo reflection data</button>
      {deletePrompt && <div role="alert" className="text-sm">Delete your demo conversations, confirmed reflections and intentions? The fictional sample meals and your existing diary are unaffected.<div className="flex gap-2 mt-2"><button className="btn btn-sm btn-error" disabled={busy} onClick={deleteData}>Delete demo data</button><button className="btn btn-sm" disabled={busy} onClick={() => setDeletePrompt(false)}>Keep it</button></div></div>}
    </section>
  </div>;
}
