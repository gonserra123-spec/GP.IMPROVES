# Tridom Citas

Formulario de cita para **el cliente del taller**. Es una app aparte de la del mecánico (`tridom-taller`): se publica en su propio sitio y se mete en la web del taller. No tiene login ni guarda nada: manda la solicitud a la API de `tridom-taller`, que la guarda en la base de datos de ese taller y la muestra al mecánico como «cita pendiente».

El cliente escribe: **nombre, matrícula, correo, móvil (opcional) y el motivo** (ITV, revisión, «no me va el aire acondicionado»…). Recibe un correo de confirmación y el taller se pone en contacto con él para acordar día y hora.

## Probarlo en local

```powershell
# 1) La app del mecánico (recibe las citas)
cd ..\tridom-taller; npm run dev          # http://localhost:5300
# 2) Este formulario
cd ..\tridom-citas; npm install; npm run dev   # http://localhost:5400/?taller=<identificador>
```

El identificador de cada taller y el código para pegar en su web salen en la app del dueño: **Ajustes → Citas desde tu web**.

## Cómo ponerlo en la web del taller

Tres formas, de más fácil a más a medida (el dueño las tiene ya escritas, con botón de copiar):

1. **Un botón o enlace** a `https://citas.tudominio.es/?taller=ID`. Sirve también para Google Maps, Instagram y WhatsApp.
2. **Una línea de código** donde quiera que salga el formulario:
   `<script src="https://citas.tudominio.es/embed.js" data-taller="ID"></script>`
   Crea un iframe y lo ajusta solo a la altura del formulario.
3. **Un iframe** a mano: `<iframe src="https://citas.tudominio.es/?taller=ID" style="width:100%;height:760px;border:0"></iframe>`

## Publicarlo

```powershell
$env:VITE_API_URL = "https://app.tudominio.es/api"   # la API de tridom-taller
npm run build                                          # genera dist/
```

`dist/` es estático: sirve cualquier alojamiento (Cloudflare Pages, Netlify, el propio servidor…). Dos condiciones:

- **Debe poder mostrarse dentro de un iframe**: no pongas `X-Frame-Options: DENY`; si usas CSP, `frame-ancestors *` o la lista de webs de tus talleres.
- En `tridom-taller`, define `CITAS_URL` con la dirección donde lo publiques.

## Seguridad y antiabuso

- Pública a propósito (sin cookies ni claves), por eso la API de citas admite cualquier origen y **solo esas rutas** (`/api/public/booking/*`).
- Límite de 5 solicitudes cada 10 minutos por conexión y 3 al día por correo; casilla trampa para programas y descarte de formularios enviados en menos de 1,5 segundos.
- Todo se valida otra vez en el servidor; el correo del cliente no se muestra completo al mecánico.
- Aviso de privacidad y casilla de aceptación en el formulario. Pendiente de revisar con la política y el contrato de encargado del tratamiento de cada taller.

## Pendiente

- Elegir día y hora de la cita (ahora el taller las acuerda con el cliente por teléfono o correo).
- Avisar al mecánico o al dueño por correo cuando llega una cita.
