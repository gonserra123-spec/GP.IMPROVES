// Copia shared/ dentro de supabase/functions/_shared para que las Edge Functions usen las mismas
// reglas (plazas, matrículas, validación) que la app. Ejecutar antes de `supabase functions deploy`.
import { copyFileSync, readdirSync } from 'node:fs';

const from = new URL('../shared/', import.meta.url);
const to = new URL('../supabase/functions/_shared/', import.meta.url);
for (const f of readdirSync(from)) { copyFileSync(new URL(f, from), new URL(f, to)); console.log('copiado', f); }
