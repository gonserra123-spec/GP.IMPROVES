# La Jarana · web de la peña (Rubielos de Mora)

React + Vite + Motion + three + MapLibre. `npm run dev` (5210) · `npm run build` · `npm run preview` (4210, con CSP).
Build con `SITE_URL=https://tu-dominio npm run build` para emitir canonical, og:url y `url` del JSON-LD.

## Assets (la-jarana-assets.zip)
- Vaso 3D: `src/lib/vaso3d.js` = módulo entregado (con `setFill`). Cambios mínimos: bucle en el ticker de Motion, cursor de la web, dispose completo.
- Textura: `public/img/vaso-textura.webp` · Merch: `public/img/merch/` · Pajar: `public/img/pajar/` · Logo color: `public/img/logo-color.webp`.
- Tipografía: `src/assets/fonts/MenckenStd-HeadNarrow.otf`. **Revisa la licencia**: si es de Adobe Fonts, servirla desde tu web puede no estar permitido.

## Generador de comunicados (Cloudflare Worker + Gemini)
La web funciona sin nada de esto: si no hay Worker, usa las plantillas locales (`src/content/plantillas.js`).
Para activar la IA, desde `worker/` en tu terminal:
1. `npx wrangler login`
2. `npx wrangler secret put GEMINI_API_KEY` ← la clave la escribes tú ahí; no va en ningún archivo.
3. Edita `ALLOWED_ORIGINS` en `worker/wrangler.toml` con tu dominio real.
4. (Opcional, límite de 30/día) `npx wrangler kv namespace create RL_KV` y descomenta el bloque en `wrangler.toml`.
5. `npx wrangler deploy` → te da `https://la-jarana-comunicados.<tu-cuenta>.workers.dev`.
6. Build de la web con `VITE_COMUNICADO_API=<esa URL> npm run build`.
Modelo por defecto `gemini-2.5-flash` (cámbialo con la variable `GEMINI_MODEL` si Google lo retira).

## Mapa (modo GTA)
MapLibre + OpenFreeMap "liberty" (sin clave) + relieve terrarium de AWS Open Data. Pajar: 40.187750, -0.654778.
Los avisos de consola sobre iconos que faltan ("swimming_pool", "gate"…) vienen del estilo de OpenFreeMap, no de la web.

## Pendiente (no inventado)
- Escudo de Rubielos de Mora → hueco `[FALTA ESCUDO RUBIELOS]` en `src/components/Nosotros.jsx`.
- Mockups de sudadera y peto → `img` en `src/content/site.js` (MERCH).
- Fotos de ambiente → `src/assets/galeria/<tardeos|fiestas|pajar|merch>/` (se detectan solas).
- Comunicados reales en `src/content/comunicados.js` (los actuales son de ejemplo).
- Imagen estática del mapa para el fallback sin WebGL (ahora muestra la foto del interior del pajar).
- Año de fundación y dominio.
