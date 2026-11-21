# Puesta en marcha (producción)

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NODE_ENV=production` | sí | Cookies `Secure`, sin claves de desarrollo. |
| `SESSION_SECRET` | sí | 32+ caracteres. Firma sesiones **y resume las claves de acceso**: si cambia, todas las claves dejan de valer. Guárdalo en un gestor de secretos. |
| `ADMIN_KEY` | sí | Clave de `/admin`. Larga y única. |
| `PUBLIC_URL` | sí | Dirección pública (`https://taller.tridom.es`). Va en los enlaces de baja. |
| `CITAS_URL` | para citas | Dirección donde está publicada la app `tridom-citas` (`https://citas.tridom.es`). Con ella se muestra a cada taller su enlace y su código de formulario en Ajustes. |
| `DATA_DIR` | sí | Carpeta **persistente** con las bases. Hay que copiarla (ver «Copias»). |
| `RESEND_API_KEY` | sí, para enviar | Sin ella el modo es «pruebas». |
| `MAIL_FROM` | sí, con Resend | Dirección verificada (único remitente). Los nombres de cada taller van en «De». |
| `RESEND_WEBHOOK_SECRET` | recomendable | Firma `whsec_…` del webhook de rebotes. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` o `_FILE` | para la hoja | Credenciales de la cuenta de servicio. |
| `TRUST_PROXY=1` | detrás de proxy | Usa `X-Forwarded-*` (IP real y HTTPS). |
| `UNDO_SECONDS` | no | Margen de deshacer (10). |
| `PORT` | no | 8090. |

## Correo (Resend)

1. Cuenta en Resend y **dominio de Tridom verificado** (SPF, DKIM y DMARC).
2. `RESEND_API_KEY` y `MAIL_FROM` (por ejemplo `avisos@tridom.es`).
3. Webhook a `https://…/api/webhooks/resend` con los eventos `email.bounced`, `email.complained` y `email.failed`. Copia su secreto en `RESEND_WEBHOOK_SECRET`. Así el panel avisa al mecánico cuando un correo no llegó.
4. Un único remitente: el cliente ve «Nombre del taller <avisos@tridom.es>» y las respuestas van al correo que el taller pone en Ajustes.

## Google Sheets

1. En Google Cloud: proyecto → activar **Google Sheets API** → cuenta de servicio → clave JSON.
2. Pon el JSON en `GOOGLE_SERVICE_ACCOUNT_JSON` (o su ruta en `_FILE`).
3. Por cada taller: crea la hoja, **compártela como editor con el correo de la cuenta de servicio** (aparece en Ajustes del dueño) y pega su identificador (lo que hay entre `/d/` y `/edit`).
4. Cada cambio sincroniza en ~3 s. Se reescribe entera: si alguien borra filas, vuelven.

## Alta de un taller nuevo

1. Entra en `/admin` → «Nuevo taller» → nombre (y, si quieres, correo del dueño y hoja).
2. Se muestran **una sola vez** la clave del mecánico y la del dueño. Pásalas al taller.
3. Si se pierde una clave o se va un mecánico: «Cambiar clave». La anterior y sus sesiones dejan de valer al momento.
4. Impago: «Pausar». Nadie del taller puede entrar hasta «Reactivar».

## Copias de seguridad

Todo el estado está en `DATA_DIR` (`master.db`, `w/<taller>/data.db` y `w/<taller>/photos/`). Copia esa carpeta cada día (volumen con snapshots o `sqlite3 .backup`). Sin copia, un fallo del disco pierde los datos.

## Alojamiento

Necesita **un proceso Node ≥ 22.13 con disco persistente** (VPS, Fly.io con volumen, Railway con volumen…). No sirve un alojamiento sin disco ni uno "serverless". Un solo proceso: el envío de correos y el resumen diario corren dentro.

## Antes de usarlo con clientes reales

- Firmar el **contrato de encargado del tratamiento** con cada taller (`contrato-encargado-tratamiento.md`).
- Completar la política de privacidad (`/privacidad`): responsable, plazos y contacto.
- Decidir el **plazo de conservación** de coches finalizados y fotos (hoy no hay borrado automático).
- Probar el envío real con un correo propio y un rebote forzado.
