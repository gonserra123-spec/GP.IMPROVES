# Tridom Garage (nombre provisional)

Seguimiento de vehículos para talleres mecánicos, con una escena 3D del taller. Producto de Tridom (Valencia).

- **`/`** — landing comercial con la escena en modo simulación.
- **`/panel`** — panel del taller (iPad, móvil y ordenador). PWA instalable.
- **`/consulta/:codigoTaller`** — consulta del cliente por matrícula.
- **`/privacidad`** — política de privacidad (borrador con datos marcados como FALTA).

Todo lo que se ve en la demo son **datos ficticios** («Taller Demo», matrículas y teléfonos inventados).

## Arranque en modo demo

Requiere Node 20 o superior.

```bash
npm install
```

```bash
npm run dev
```

Abre `http://localhost:5200`. Panel: código `DEMO01`, PIN `2468`. Consulta: `http://localhost:5200/consulta/DEMO01` con, por ejemplo, la matrícula `1234 BCD` (el coste se ve con las cifras `0101`).

La API de demo (`server/`) se monta dentro de Vite, así que no hay que arrancar nada más. Los datos viven en memoria y vuelven a los fixtures al reiniciar.

Para probar el build con las cabeceras de producción (CSP, HSTS) y el service worker:

```bash
npm run build
```

```bash
npm run preview
```

Servidor propio (sirve `dist/` y la API, sin Vite):

```bash
npm start
```

Otros comandos: `npm test` (pruebas de `shared/` y del servidor), `npm run audit` (dependencias).

## Estructura

| Ruta | Qué hay |
|---|---|
| `shared/` | Reglas comunes a cliente y servidor: estados y plazas (`domain.js`), matrículas (`plates.js`), validación (`validate.js`), catálogo (`models.json`) y plantilla del taller (`template.json`) |
| `server/` | API de demo sin dependencias: PIN con hash, sesión en cookie httpOnly, consulta pública, tiempo real (SSE), retención |
| `src/data/` | `DataAdapter` con dos implementaciones (`mockAdapter.js`, `supabaseAdapter.js`) y el estado del panel con cola offline (`panelStore.js`) |
| `src/scene/` | Escena 3D: rutas (`paths.js`), coches paramétricos (`carProfile.js`, `carGeometry.js`), nave (`world.js`), mecánico, motor (`engine.js`), cámara, simulación |
| `src/pages/` | Landing, panel, consulta y privacidad |
| `supabase/` | Migración SQL con RLS y Edge Functions `panel` y `consulta` |
| `docs/` | Despliegue en Supabase, licencias de assets y registro del proyecto |

## Capa de datos

Toda la app habla con la interfaz `DataAdapter` (`src/data/adapter.js`).

- **MockAdapter** (por defecto): llama a la API local de `server/`. Los fixtures están en `server/store.js`. La cola de cambios sin conexión y la última copia del panel se guardan en `localStorage` del dispositivo del taller y se borran al salir.
- **SupabaseAdapter**: se activa con `VITE_DATA_ADAPTER=supabase`. Ver [docs/deploy-supabase.md](docs/deploy-supabase.md). Está escrito y documentado pero **no se ha probado contra un proyecto real** (no hay credenciales).

La consulta del cliente pasa siempre por servidor (API de demo o Edge Function). El navegador nunca recibe más que el DTO de ese coche y, de los demás, la plaza que ocupan.

## Escena 3D

- Plantilla del taller en `shared/template.json` (n.º de elevadores, foso sí/no, posiciones). El color de marca y el nombre del taller se pintan en la nave.
- Los coches se generan por código: un perfil lateral por arquetipo (10) escalado al largo, ancho y alto del modelo. Es un parecido por categoría con proporciones reales, **no una réplica** de cada modelo. Para añadir un GLB exacto más adelante basta con que `carParts()` (`src/scene/carGeometry.js`) devuelva su geometría para ese `modelId`.
- Cada coche tiene un único objetivo vigente (la plaza y el estado que dicen los datos). Al terminar el tramo en curso se replanifica, así que las órdenes intermedias se comprimen y no hay saltos.
- Al cargar, la escena se coloca ya en su estado actual; solo se animan los cambios posteriores.
- Si WebGL no está disponible o los fotogramas caen de forma sostenida, se pasa a una vista en lista con los mismos estados. `?gl=1` en la URL desactiva esa caída (para medir).

### Gancho de depuración

En cualquier página con escena, `window.__garage` expone:

- `frame()` — posición y orientación de cada coche, mecánico y elevador en ese fotograma.
- `engine.startRecording()` / `engine.stopRecording()` — salto máximo por fotograma de coches, mecánico y elevadores, giro máximo, distancia mínima entre coches y estados imposibles.
- `engine.advance(segundos)` — avanza la simulación a pasos fijos de 1/60 s sin esperar al reloj (los navegadores automatizados frenan el `requestAnimationFrame`).
- `stats()` — fps y tiempo de fotograma medidos, triángulos y llamadas de dibujo.
- `sim` — en la landing, el almacén de la simulación (`sim.setState(id, estado)`).

## Seguridad

- Validación en cliente y en servidor con el mismo código (`shared/validate.js`).
- Cabeceras: CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy` (`server/security.js` y `public/_headers`; mantener ambas iguales).
- PIN con scrypt, 5 fallos por IP cada 5 min y 20 por taller cada 15 min; sesión en cookie `HttpOnly; SameSite=Strict` (`Secure` bajo HTTPS).
- Peticiones que cambian algo: mismo origen y cabecera propia `X-Requested-With`.
- Consulta pública: honeypot, límite por IP y por matrícula, respuesta idéntica y con el mismo suelo de tiempo para «no existe» y «dato incorrecto»; el coste exige las 4 últimas cifras del teléfono (5 intentos cada 15 min y 15 al día por coche).
- Ninguna clave en el frontend; los secretos van por variables de entorno (`.env.example`).

Pendiente de infraestructura (fuera del código, a cargo de Tridom): Cloudflare con WAF, SSL «Full (strict)», «Always Use HTTPS» y 2FA en Cloudflare, GitHub y Supabase.

## Datos que faltan (FALTA)

Dominio definitivo (canonical y `og:url`), precios, contacto y redes de Tridom, logo, destino del formulario de contacto, datos del responsable y del encargado en la política de privacidad, y proveedor de alojamiento.
