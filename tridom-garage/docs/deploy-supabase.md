# Conexión a Supabase

> Estado: preparado y sin probar. No hay credenciales, así que ni la migración ni las Edge Functions se han ejecutado contra un proyecto real. Antes de usarlo con un taller hay que desplegarlo en un proyecto de pruebas y repetir las comprobaciones del Anexo C.

## Cómo queda montado

- **Tablas** (`supabase/migrations/0001_init.sql`): `workshops`, `vehicles`, `parts`, `history`, `panel_sessions`, `rate_limits`. RLS activado en todas y **sin políticas** para `anon` ni `authenticated`: con la clave pública no se lee ni se escribe nada.
- **Edge Function `panel`**: acceso por PIN (PBKDF2), sesión en cookie httpOnly y todas las operaciones del taller, filtrando por el taller de la sesión.
- **Edge Function `consulta`**: consulta pública por matrícula con el DTO mínimo, límite de intentos y suelo de tiempo.
- **Tiempo real**: canal privado de Broadcast `workshop:<id>`. La función `panel` emite un aviso sin datos tras cada cambio y el panel vuelve a pedir la lista. El navegador escucha con un JWT de una hora que solo vale para el canal de su taller (política sobre `realtime.messages`).
- **Retención**: función SQL `run_retention()`; programarla cada hora con `pg_cron` (línea comentada al final de la migración).

## Pasos

1. Crear el proyecto en Supabase en una región de la UE. Activar 2FA en la cuenta.
2. Aplicar la migración:

   ```bash
   supabase db push
   ```

3. Activar `pg_cron` y programar la retención (sentencia al final de `0001_init.sql`).
4. Copiar el código compartido dentro de las funciones (hay que repetirlo cada vez que cambie `shared/`):

   ```bash
   npm run supabase:shared
   ```

5. Configurar los secretos de las funciones. Nunca en el repositorio ni en variables `VITE_`:

   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.example VIEW_TOKEN_SECRET=<32 bytes aleatorios> JWT_SECRET=<JWT secret del proyecto> COOKIE_SAMESITE=None
   ```

6. Desplegar las funciones. Van sin verificación de JWT porque validan su propia sesión y su propio CORS:

   ```bash
   supabase functions deploy panel --no-verify-jwt
   ```

   ```bash
   supabase functions deploy consulta --no-verify-jwt
   ```

7. Dar de alta el taller. Generar el hash del PIN en local (no queda en el historial) y pegar el resultado en el editor SQL:

   ```bash
   npm run hash-pin
   ```

   ```sql
   insert into public.workshops (name, code, pin_hash) values ('Nombre del taller', 'ABCD12', '<hash>');
   ```

8. Variables de la app (`.env`, ver `.env.example`): `VITE_DATA_ADAPTER=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la clave pública; no tiene permisos sobre las tablas).
9. Añadir el dominio de Supabase a `connect-src` de la CSP (`server/security.js` y `public/_headers`): `https://<ref>.supabase.co wss://<ref>.supabase.co`.

## Cosas a decidir antes de producción

- **Cookie entre dominios.** La función vive en `*.supabase.co` y la app en otro dominio, así que la cookie va con `SameSite=None; Secure` y depende de que el navegador acepte cookies de terceros (Safari las bloquea). Lo recomendable es servir las funciones bajo el mismo dominio que la app (proxy `/api` en Cloudflare) y poner `COOKIE_SAMESITE=Strict`.
- **Carreras al asignar plaza.** La función calcula la plaza libre y escribe después; si dos dispositivos eligen la misma a la vez, el índice único `vehicles_slot` rechaza la segunda escritura y el panel recibe «ubicación ocupada». Es correcto pero no reintenta solo.
- **Versiones de dependencias.** Las funciones importan `npm:@supabase/supabase-js@2` y `npm:jose@5`. Fijar versiones exactas al desplegar.
- **Claves.** La `service_role` solo existe dentro de las funciones. Rotar cualquier clave que se haya compartido por chat, correo o captura.
- **Copias de seguridad.** Activar las copias automáticas del proyecto (el código ya está en GitHub).
- **Formulario de contacto.** El adaptador de Supabase no lo implementa (`not_configured`): falta decidir el destino.

## Plan mínimo de incidente

1. Revocar y rotar credenciales (`service_role`, `JWT_SECRET`, `VIEW_TOKEN_SECRET`; cambiar el PIN del taller y vaciar `panel_sessions`).
2. Si es tráfico anómalo, activar «Under Attack» en Cloudflare.
3. Revisar los registros de las funciones y de Cloudflare.
4. Si hay datos afectados, avisar al taller (responsable del tratamiento) para que valore la notificación a la AEPD en 72 horas.
- Mejoras del panel: aplicar también `supabase/migrations/0002_panel_mejoras.sql` y volver a desplegar `panel` y `consulta` (código corto por coche, etiquetas y aviso de coches parados).

## Pendiente: clientes y citas

El adaptador ya llama a estas acciones, pero las Edge Functions `panel` y `consulta` aún no las implementan: `customers_summary`, `customers_import`, `appt_list`, `appt_arrive`, `appt_cancel` (panel) y `customer_check`, `book` (consulta). Hacen falta las tablas `customers` y `appointments` con RLS por taller, límite de 2000 filas por importación y las mismas reglas que `shared/customers.js` (se copian con `npm run supabase:shared`). Un cliente que reserva no debe poder sobrescribir el correo ni el teléfono ya guardados.
