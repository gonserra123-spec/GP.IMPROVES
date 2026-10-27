# 2con2estudio

Web de 2con2estudio (Bea Pérez y Gonzalo Pau, Valencia). React + Vite + Motion, con una función serverless para el formulario «Cuéntanos tu reforma».

Dirección de diseño (v3): monografía suiza sobre papel masilla, con mucho movimiento ligado al scroll. Las versiones anteriores (Showroom brutalista y galería blanca tipo Niva) están descritas en `docs/skills-log.md`.

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:test   # http://localhost:5174, modo test: usa el baremo DEMO y permite ?result=1
npm run build
npm test           # tests del baremo y de la función serverless
npm run assets     # regenera imágenes AVIF/WebP, favicons, OG y manifest desde assets-cliente/
```

## Variables de entorno (servidor)

Configúralas en el panel de Vercel (o Netlify). **Nunca** en el cliente ni en el repositorio. Hay una plantilla en `.env.example`.

| Variable | Obligatoria | Uso |
|---|---|---|
| `RESEND_API_KEY` | Sí | Clave de la API de [Resend](https://resend.com). |
| `CONTACT_TO_EMAIL` | Sí | Destino de las solicitudes. No aparece en el código ni en el repositorio. |
| `CONTACT_FROM_EMAIL` | Recomendada | Remitente, p. ej. `2con2estudio <solicitudes@tu-dominio>`. Debe ser un dominio verificado en Resend. Sin ella usa `onboarding@resend.dev` (solo pruebas). |
| `ALLOWED_ORIGIN` | Opcional | Origen permitido, p. ej. `https://tu-dominio`. Si se define, se rechazan otros orígenes. |
| `VITE_SITE_URL` | Sí al construir | URL pública del sitio para canonical, OG y JSON-LD. [FALTA: dominio definitivo] |

## Cómo funciona el envío

`POST /api/solicitud` (`api/solicitud.js`):

1. Honeypot (`website`): si viene relleno responde 200 y no envía nada.
2. Límite de frecuencia: 5 solicitudes por hora y por IP, en memoria de la instancia. Es una defensa básica; si hay abuso, sustituirla por Upstash Ratelimit o similar.
3. Validación con las mismas reglas que el cliente (`shared/schema.js`): textos libres de al menos 10 caracteres, 1 a 8 fotos, solo JPG/PNG/WebP/HEIC comprobados por sus bytes (no por la extensión), 1,5 MB por foto y 3,1 MB en total.
4. Envío por Resend al destinatario `CONTACT_TO_EMAIL`, con todos los datos, el baremo si procede y las fotos adjuntas.
5. No se guarda nada: ni base de datos ni logs con datos personales.

**Límite de tamaño:** Vercel admite 4,5 MB por petición y las fotos viajan en base64 (+33 %). Por eso el navegador reduce cada foto a ≈1,5 MB como máximo y, si el conjunto supera 3,1 MB, las vuelve a comprimir. Las fotos HEIC que el navegador no sabe descodificar solo se aceptan si ya pesan menos del límite.

## Baremo y estimación

`src/data/pricing.js` contiene la tabla €/m² por tipo de reforma y acabados con todos los valores en `null`, y `SHOW_ESTIMATE = false`. Mientras esté así, la web no muestra ninguna cifra y tras enviar dice: «Hemos recibido tu solicitud. Te enviaremos una valoración orientativa.»

Para activarlo: rellena `min` y `max` (€/m²) de cada celda y pon `SHOW_ESTIMATE = true`. Aparecerá la horquilla con el texto legal «Estimación orientativa no vinculante, sujeta a visita y presupuesto definitivo.», y el email incluirá el cálculo. Reforma integral calcula sobre los m² de la vivienda; el resto, sobre la suma de las estancias.

Los valores DEMO (`src/data/pricing.demo.js`) solo se cargan con `vite --mode test` y en los tests; no entran en el build de producción.

## Datos pendientes del cliente

Se muestran como etiquetas `[FALTA: …]` mientras `SHOW_PLACEHOLDERS = true` en `src/data/business.js`. Ponlo a `false` al publicar.

- Fotos originales en alta resolución (las actuales son ampliaciones de capturas).
- Confirmar si son proyecto propio la cocina roble/grafito y la cocina blanca compacta.
- Traducción al inglés del eslogan (ahora provisional).
- Logo vectorial y si el marco debe ser un cuadrado cerrado (en la imagen aportada está abierto por abajo).
- Roles, bio y foto de Bea y Gonzalo; nombre, ubicación y año de cada proyecto.
- Lista de servicios y proceso de trabajo; zona de trabajo.
- Dirección postal, horarios, NIF y datos del responsable para la política de privacidad.
- Dominio definitivo y baremo.
- Verificar un dominio en Resend para el remitente.

## Estructura

- `src/` interfaz; `src/i18n/` textos ES/EN; `src/data/` datos del negocio, baremo e imágenes.
- `api/` función serverless; `shared/` validación común.
- `assets-cliente/` originales del cliente (no se publican); `public/img/` versiones optimizadas.
- `legacy/` proyectos anteriores archivados.

## Reseñas de Google

Edita `src/data/reviews.js`: añade cada reseña **real** (texto literal, nombre, valoración y fecha) y, si quieres, el enlace de tu ficha de Google y la media y el número reales. La sección se muestra sola cuando hay reseñas. No añadas reseñas de ejemplo ni cambies valoraciones: es engañoso para los clientes y ilegal en la UE.
