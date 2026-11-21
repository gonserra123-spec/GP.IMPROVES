import { useState } from 'react';
import { Btn, Field, Wordmark } from '../components.jsx';
import { errText } from '../lib/api.js';
import { login } from '../lib/store.js';

// Una sola clave: ella decide el taller y si entra el mecánico o el dueño.
export default function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    if (key.replace(/[^A-Za-z0-9]/g, '').length < 12) { setError('La clave tiene 12 letras y cifras (XXXX-XXXX-XXXX).'); return; }
    setBusy(true);
    try {
      const r = await login(key);
      if (!r.ok) setError(r.error === 'locked' ? `Demasiados intentos. Espera ${Math.max(1, Math.ceil((r.retryAfter || 60) / 60))} min.` : errText(r.error));
    } catch { setError('Sin conexión. Inténtalo en un momento.'); }
    setBusy(false);
  };
  const fmt = (v) => { const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); return [c.slice(0, 4), c.slice(4, 8), c.slice(8)].filter(Boolean).join('-'); };
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <Wordmark />
        <h1>Entrar al taller</h1>
        <Field label="Clave de acceso" error={error} hint="La clave que te ha dado Tridom. Con ella entras directamente a tu taller.">
          {(a) => <input className="input input--big" autoComplete="off" autoCapitalize="characters" spellCheck="false" inputMode="text" maxLength={14} value={key} onChange={(e) => setKey(fmt(e.target.value))} placeholder="XXXX-XXXX-XXXX" {...a} />}
        </Field>
        <Btn variant="block" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Btn>
        <p className="hint"><a href="/privacidad">Privacidad</a></p>
      </form>
    </main>
  );
}
