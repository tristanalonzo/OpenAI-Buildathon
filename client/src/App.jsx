import { useState } from 'react';

const initialForm = { budget: '150', minutes: '20', zone: '', craving: '' };

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPlan(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not create a plan.');
      setPlan(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Campus food compass</p>
        <h1 id="page-title">U<span>Crave</span></h1>
        <p className="lede">Tell us the clock, your pocket, and the craving. We’ll point you toward a good bite.</p>
        <div className="orange-slice" aria-hidden="true" />
      </section>

      <section className="planner" aria-labelledby="planner-title">
        <div className="section-heading">
          <p className="eyebrow">Start here</p>
          <h2 id="planner-title">What are we hunting for?</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Budget <span>(₱)</span>
            <input name="budget" type="number" min="1" required value={form.budget} onChange={updateField} />
          </label>
          <label>
            Minutes to spare
            <input name="minutes" type="number" min="1" required value={form.minutes} onChange={updateField} />
          </label>
          <label>
            Campus zone
            <select name="zone" required value={form.zone} onChange={updateField}>
              <option value="" disabled>Choose a zone</option>
              <option value="Cubao">Cubao / Araneta</option>
              <option value="NU - MOA">NU – Mall of Asia</option>
              <option value="U-Belt / Sampaloc">U-Belt / Sampaloc</option>
              <option value="UP Diliman">UP Diliman</option>
            </select>
          </label>
          <label className="wide">
            What are you craving?
            <input name="craving" type="text" placeholder="e.g. hot noodles, coffee, something sweet" required value={form.craving} onChange={updateField} />
          </label>
          <button type="submit" disabled={isLoading}>{isLoading ? 'Finding bites…' : 'Make my plan →'}</button>
        </form>
      </section>

      <section className="result" aria-live="polite">
        {!plan && !error && <p className="empty-state">Your route to a better next meal starts here.</p>}
        {error && <p className="error">{error}</p>}
        {plan && (
          <article className="plan-card">
            <p className="eyebrow">Plan preview</p>
            <h2>{plan.plan.title}</h2>
            <p>{plan.message}</p>
            <dl>
              <div><dt>Budget</dt><dd>₱{plan.request.budget}</dd></div>
              <div><dt>Time</dt><dd>{plan.request.minutes} min</dd></div>
              <div><dt>Dataset</dt><dd>{plan.dataset.spotsLoaded} spots</dd></div>
            </dl>
            <small>{plan.plan.note}</small>
          </article>
        )}
      </section>
    </main>
  );
}
