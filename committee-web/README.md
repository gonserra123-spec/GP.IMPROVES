# Web de Committee Club Valencia (maqueta de propuesta)

Web completa de la discoteca en azul violáceo y negro: entradas, mesas VIP con plano y botellas, lista de cumpleaños e información práctica. Es una maqueta de GP.IMPROVES, no la web oficial; lleva `noindex` y un aviso en el pie.

## Cómo verla

```bash
cd committee-web
npm install
npm run dev      # http://localhost:5190
npm run build
```

## Qué es real y qué falta

- **Real (fuentes públicas, noviembre de 2026)**: dirección, noches, horarios, edades, entrada 22 / 27 / 32 € con consumición, zonas, precios de mesa, reglas 5+2 con +20 %, señal del 50 % y carta de botellas. Están en `src/content/data.js`.
- **Estimado**: el plano de la sala y los precios intermedios de la zona Ghost.
- **[FALTA]**: logo oficial, fotos y vídeo de la sala, dominio (canonical y Open Graph), y a qué plataforma se envían la venta y las reservas. Hoy los tres formularios validan y muestran un aviso de maqueta; no envían ni cobran nada.
- **Propuesto, sin aprobar por el club**: la lista con enlace exclusivo de cumpleaños.

## Iteración 2026-11-13: pendientes y seguridad

- **[FALTA] URL de entradas**: la web ya no vende. Todos los botones «Entradas» salen a `TICKETS_URL` (`src/content/data.js`, vacía) y quedan inertes hasta que Gonzalo confirme el enlace de Comité en Grupo Salamandra.
- **[FALTA] Fotos**: zonas Principal, Ghost y Petit Comité y cumpleaños se rellenan en `PHOTOS` (`data.js`) con una ruta bajo `public/`. Solo con licencia o generadas (declararlo en `note`). Mientras tanto: hueco con luces en cumpleaños, nada en las zonas.
- **Mapa**: Leaflet + OpenStreetMap, teñido de azul por CSS; sin clave de API. Las teselas públicas de OSM valen para la maqueta; en producción conviene un proveedor propio.
- **Seguridad**: `server/` sirve `dist/` con CSP, HSTS, X-Frame-Options y nosniff, valida de nuevo los formularios en el servidor y limita el ritmo por IP (8 por 10 min). `npm run build && npm start`. En estático, las mismas cabeceras están en `public/_headers`. Secretos solo por entorno (`.env.example`). `npm audit`: 0 vulnerabilidades.

## Registro del Prompt Maestro (Fase 7) · 2026-11-12

Va aquí y no en `docs/skills-log.md` porque ese archivo está en mitad de una fusión con conflictos.

- **Estilo**: «Cartel de club», elegido en el menú de 5 direcciones. Referencias: [UNVRS], Hï Ibiza, fabric y Berghain. Paleta: azul violáceo y negro, los colores originales de Committee (antes rojo y negro).
- **Arquitectura**: React + Vite, con el ticker único y los muelles del kit (`src/lib`). Una sola familia, Archivo variable, con el eje de anchura.
- **Firma (regla 1)**: la palabra COMMITTEE es una ventana a la sala; con el scroll la «I» crece hasta llenar la pantalla.
- **Movimiento, nivel 3**: M1 (sala de luces por shader, rastro del cursor), M3 (zonas apiladas), M12 (cambio de noche), M14 (cursor de doble anillo), M18 (palabras fantasma). Combinación distinta de 2con2estudio y Hercas.
- **Skills**: impeccable (detector sin hallazgos). No se pasó la revisión de animaciones.
- **Verificado con Playwright** a 1440 y 390: capturas por sección, la firma a lo largo del scroll, los tres formularios solo con datos inválidos, ES/EN, consola sin errores ni avisos, enlaces internos, y que el WebGL no dibuja cuando el hero está tapado. Ticker: 0,23 ms por fotograma.
- **Sin verificar**: `prefers-reduced-motion` y navegación completa con teclado.

## Registro v6.4 · Regla 8 ampliada, security-audit (guía) y Codex · 2026-11-14

Va aquí porque `docs/skills-log.md` es del proyecto de reformas, no de Committee.

- **Regla 8 aplicada**: honeypot (`website`) en reserva y lista, con respuesta «ok» silenciosa en el servidor; validación server-side, rate limiting (8 por 10 min), CSP, HSTS, X-Frame-Options, nosniff y Referrer-Policy; sin claves en el cliente; secretos por entorno; `npm audit` sin vulnerabilidades.
- **security-audit, modo guía** (sin informe aparte; probado solo contra el servidor local):

| Clase | Hallazgo | Estado |
|---|---|---|
| Web / servidor | Cabeceras de IP reenviada falsificables con `TRUST_PROXY=1` (Codex, medio) | Corregido: solo se aceptan desde `TRUSTED_PROXIES`. Probado: 10 envíos con IP falsa → 429 al noveno |
| Web / servidor | Redirección HTTPS construida con `Host` sin validar | Corregido: se valida el formato y solo actúa tras un proxy de confianza |
| Cliente / DOM | Sin `innerHTML` con datos de usuario; enlaces externos con `noopener` | Sin hallazgos |
| Cadena de suministro | `npm audit` 0; `package-lock.json` presente | Sin hallazgos |
| Cliente / CSP | `style-src 'unsafe-inline'` (React y Leaflet fijan estilos en línea) | Riesgo aceptado, sin scripts en línea |
| Privacidad | No hay política de privacidad y los formularios envían datos personales a un webhook; el mapa envía la IP del visitante a OpenStreetMap | **[FALTA]** texto legal del cliente: no inventado |
| Automatización | El contenido libre del formulario llega tal cual a n8n | n8n debe tratarlo como dato, nunca como instrucción |
| IA / LLM | No hay chatbot ni endpoints de IA | No aplica |
| Infraestructura | WAF, SSL «Full (strict)» y 2FA en Cloudflare/GitHub; repo privado | No verificable desde el código: lo comprueba el cliente |

- **Codex**: la tarea de revisión libre no pudo leer el repositorio (el entorno de Codex bloqueó la lectura) y no revisó nada. Se repitió como revisión adversarial del working tree: 1 hallazgo medio (IP reenviada), corregido.
- **Sin verificar**: el sitio desplegado, la navegación con teclado y `prefers-reduced-motion`.
