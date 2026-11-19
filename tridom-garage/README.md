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

Abre `http://localhost:5200`. La landing incluye un tablero «en directo» con el móvil del cliente sincronizado y una calculadora de llamadas; `http://localhost:5200/tv` es la pantalla para la sala de espera (todo con datos ficticios). Panel: código `DEMO01`, PIN `2468`. Consulta: `http://localhost:5200/consulta/DEMO01` con, por ejemplo, la matrícula `1234 BCD` (el coste se ve con las cifras `0101`).

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

## Modo demo y entrega a un taller real

- `DEMO_MODE=1` (por defecto): «Taller Demo» con datos ficticios, PIN visible en el acceso y etiqueta DEMO en el panel.
- `DEMO_MODE=0`: sin demo. No existe «Taller Demo», no hay datos ficticios y no hay ningún PIN conocido. El servidor crea un único taller vacío con estas variables:

| Variable | Qué es |
|---|---|
| `WORKSHOP_CODE` | Código del taller (4 a 12 letras o cifras) |
| `WORKSHOP_PIN` | PIN del taller (4 a 8 cifras) |
| `WORKSHOP_NAME` | Nombre que se pinta en la nave |
| `WORKSHOP_LIFTS`, `WORKSHOP_PIT` | Elevadores (por defecto 2) y foso (`0` para quitarlo) |
| `WORKSHOP_COLOR` | Color de marca, por ejemplo `#2F6FED` |

Si falta el código o el PIN, el servidor avisa por consola y no crea ningún taller. Los datos del servidor de `server/` viven en memoria: para un taller real usa el adaptador de Supabase (`docs/deploy-supabase.md`).

## Novedades del panel

- **Recordar quién eres:** el dispositivo guarda el código del taller y el operador (Oficina, Mecánico 1 o 2). Solo se pregunta la primera vez; queda un enlace «Cambiar».
- **Historial:** los coches entregados salen de la lista y se consultan en Ajustes, con buscador por matrícula, mientras dure la retención.
- **Pista de una sola vez:** «Toca un coche…» se enseña una vez por dispositivo.
- **Entrega estimada:** bloque propio en la ficha, con Hoy, Mañana, +2 días y +1 semana. Si el coche está en reparación o esperando y no tiene fecha, el panel la pide. En la lista, «Retrasado» marca las fechas pasadas. El cliente ve la fecha o «el taller aún no ha indicado una fecha».
- **Etiquetas rápidas:** un toque en lugar de escribir (3 a 40 letras, hasta 8 por coche). Las del taller se editan en Ajustes (hasta 12) y se pueden restaurar.
- **Resumen del día (Oficina):** entradas de hoy, entregados de hoy y coches con más de N días (5 por defecto, editable). Cada número filtra la lista.
- **Albarán con QR:** en la ficha del coche, «Imprimir albarán». Cada coche tiene un código corto de 6 caracteres (sin I, O, 0 ni 1) y el QR abre `/consulta/<CÓDIGO_TALLER>?c=<CÓDIGO_COCHE>` directamente. El código no se puede adivinar (unos mil millones de combinaciones, con límite de intentos por IP), la respuesta es la misma si no existe y el coste sigue pidiendo las 4 últimas cifras del teléfono.
- **Landing:** la cabecera tiene tres enlaces (Cómo funciona, Probar demo, Contacto); el resto está en el pie.

Con Supabase: aplicar `supabase/migrations/0002_panel_mejoras.sql` y volver a desplegar las funciones `panel` y `consulta`. Está escrito pero no se ha probado contra un proyecto real.

## Citas y clientes habituales

- **Cita del cliente** (`/cita/CODIGO`, en la demo `/cita/DEMO01`): matrícula, correo, día, franja y motivo. Si la matrícula ya es de un cliente del taller, se reconoce y no se pide el coche. La reserva no pisa los datos de contacto que el taller ya tenía.
- **Panel → Citas**: aparecen arriba; «Ha llegado» da de alta el coche con un toque.
- **Panel → Clientes**: importa un CSV exportado de su programa de gestión (`;`, `,` o tabulador; columnas matrícula, marca, modelo o vehículo, teléfono y correo). Hay plantilla descargable, vista previa y rechazo fila a fila.
- **Pendiente**: envío real de correos de confirmación y las acciones equivalentes en las Edge Functions de Supabase (`customers_summary`, `customers_import`, `appt_list`, `appt_arrive`, `appt_cancel`, `customer_check`, `book`), con sus tablas y RLS. Antes de importar datos reales hace falta el contrato de encargado del tratamiento con cada taller.
