// Envío de formularios al servidor propio (server/api.js). El servidor vuelve a validar todo.
// Devuelve { ok, status, errors, mock }: `mock` es true mientras no haya webhook configurado.
export async function postForm(kind, payload) {
  try {
    const res = await fetch(`/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok === true, status: res.status, errors: data.errors || {}, mock: data.mock === true };
  } catch {
    return { ok: false, status: 0, errors: {}, mock: false };
  }
}
