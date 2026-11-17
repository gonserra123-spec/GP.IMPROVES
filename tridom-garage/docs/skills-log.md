# Registro del proyecto — Tridom Garage

**Fecha:** 2026-11-14 y 2026-11-15 · **Cliente:** Tridom (producto propio, nombre provisional) · **Prompt Maestro:** v6.4
**Estilo:** «plano técnico de taller» (dado; Fases -1 y 1 omitidas) · **Arquitectura:** B) React + Vite, con React Three Fiber + drei y Zustand · **Movimiento:** nivel 3 en la landing, BASE en panel y consulta.

## Skills de la Fase 0

| Skill | Cómo se usó | Resultado |
|---|---|---|
| `impeccable` | Setup, registro *product* para panel y consulta, reglas generales y detector (`detect.mjs --json src`) | 0 hallazgos del detector |
| `review-animations` | Lectura de `SKILL.md` y pasada manual por las diez normas (la skill no es invocable desde la herramienta de skills en esta sesión) | Ver tabla Before/After; veredicto final: aprobado |
| `security-audit` | Modo guía: pasada por las clases de ataque aplicables | Ver tabla de hallazgos |
| `redesign-existing-projects` | No aplica (no hay web previa) | — |

Refero Styles: consultado por web (shadcn/ui, Vercel, Brex; ver `DESIGN.md`). Supahero: no disponible en esta máquina.

## Cómo se cumple cada regla

| Regla | Cumplimiento |
|---|---|
| 1 Animación de firma | Recorrido de cámara por el taller ligado al scroll en el hero (`src/pages/Landing.jsx`, `TOUR`): siete fotogramas clave, muelle sobre el progreso e inercia en la cámara. Con movimiento reducido, fotograma estático y capítulos como lista |
| 2 Longitud | 12.805 px de alto a 1440×900: 119 pasos de rueda de 100 px |
| 3 Formularios | Contacto: nombre, taller, correo, mensaje (mínimo 10) y consentimiento obligatorios; teléfono opcional. Panel: matrícula, teléfono y PIN por formato; notas y pieza con mínimo 10 si se rellenan. Mismo validador en cliente y servidor (`shared/validate.js`) |
| 4 Bilingüe | ES/EN en las tres superficies y en privacidad; ES por defecto; `lang` del documento sincronizado; los rótulos de la escena también cambian |
| 5 Logo adaptativo | Wordmark de texto «Tridom Garage». Lee el tono de la sección bajo la cabecera (`data-tone`: claro, papel, oscuro, marca) y cambia de color; lleva plaqueta del color base de la sección para no mezclarse con el contenido que pasa por debajo |
| 6 Verificación | Playwright MCP: capturas a 1440, 390 y 1024×768; scroll al 25/50/75/100 %; formulario solo con datos inválidos; consola; enlaces; `<head>`; selector de idioma. Detalle abajo |
| 7 Movimiento | Ticker único (`src/lib/ticker.js`) y muelles (`src/lib/spring.js`); ningún `@keyframes`; revelado de titulares por línea; botones con flood interrumpible y `scale(0.97)`; hovers solo con puntero fino; `prefers-reduced-motion` con fotograma estático |
| 8 Ciberseguridad | Ver checklist |
| 8b security-audit | Modo guía; ver tabla |

### Piezas de movimiento de la landing (anti-repetición)

La definición del MENÚ (M1–M22) no está en el repositorio, así que se anotan por técnica; la correspondencia con sus códigos queda **por confirmar**:

1. Hero WebGL con recorrido de cámara ligado al scroll (firma; probable M1).
2. Raíl de capítulos fijado: cinco tramos con texto que entra y sale y barra que se rellena (probable M17).
3. Capas a distinta velocidad en el hero: texto, capítulos y escena (probable M19).
4. Tarjeta del cliente fijada que recorre los siete estados con el scroll.
5. Perfil del coche que se dibuja con el scroll (trazo por `stroke-dashoffset`).
6. Cinta de rótulos que acelera con la velocidad de scroll.
7. Revelado de titulares por línea (BASE; probable M15).

Combinación distinta de las anteriores del registro general (láser, pasillo horizontal, piezas flotantes, contador).

## Verificación (Fase 6)

| Comprobación | Resultado |
|---|---|
| Consola | 0 errores en landing, panel, consulta y privacidad con el build de producción. Único aviso: `THREE.Clock` obsoleto, emitido por React Three Fiber |
| CSP | Sin violaciones con la política completa |
| Enlaces | `/`, `/panel`, `/consulta/DEMO01`, `/privacidad`, iconos, manifest, robots y service worker en 200; fichero inexistente en 404; ninguna ancla rota |
| `<head>` | Título y descripción (148 caracteres); favicon, apple-touch-icon y manifest; JSON-LD `SoftwareApplication` solo con nombre, categoría y Tridom en Valencia; **sin canonical** porque falta el dominio |
| ES/EN | Cambia todo el texto y el `lang`; sin restos en español en la versión inglesa |
| Contacto | Solo datos inválidos: 5 errores en vacío; correo, teléfono y mensaje corto detectados; el servidor responde 422 con los mismos códigos. Ningún envío real |
| Scroll 25/50/75/100 % | Capítulos y cámara en su tramo a 1440 y a 390; al 100 % vuelve a la vista general |
| Movimiento reducido | Hero sin fijar, capítulos visibles, titulares sin transformar, coches colocados sin animación, sin botón de simulación |
| Objetivos táctiles | Mínimo medido en el panel: 56 px |
| C1 Continuidad | 42 parejas de estados (82.350 fotogramas) y 660 cambios en ráfaga (60.813 fotogramas): salto máximo de coche 0,059 m, giro 0,022 rad, mecánico 0,024 m y 0,092 rad, elevador 0,013 m por fotograma; distancia mínima entre coches 2,8 m; 0 estados imposibles; todo llega a reposo |
| C2 Rendimiento | 60 fps, 16,67 ms (p95 16,8 ms) a 1440, 390 y 1024×768; también con CPU frenada ×4 a 390. 5.520–6.144 triángulos; 122–134 llamadas de dibujo. Medido en un PC con RTX 3060 Ti: **no se ha medido en un móvil de gama media real** |
| C3 Privacidad | (a) mismo mensaje y mismo cuerpo `{"ok":false}`; diferencia de tiempo < 150 ms. (b) 429 al séptimo intento por matrícula. (c) ninguna matrícula, teléfono, nota ni coste ajeno en las respuestas. (d) 12 clics en la escena: 0 peticiones. (e) coste solo tras verificar |
| C4 Flujo | Alta, estados, elevador, pieza, notas y coste, consulta, entrega, retención (1 borrado), tiempo real entre dos dispositivos, aviso de conflicto, cola sin conexión y exportación |
| Pruebas automáticas | `npm test`: 14 de 14 |
| Dependencias | `npm audit`: 0 vulnerabilidades |

## Before / After (review-animations e impeccable)

| Before | After | Why |
|---|---|---|
| Flood del botón en 500 ms | 340 ms con `cubic-bezier(0.22, 1, 0.36, 1)` | Una respuesta de interfaz por encima de 300 ms se nota lenta |
| Giro del mecánico de hasta 0,47 rad por fotograma | Velocidad angular máxima de 5,5 rad/s (0,092 rad por fotograma) | Un volantazo al cambiar de tramo se lee como salto |
| Casco invertido azul para resaltar el coche | Aristas azules, cristal más saturado y anillo en el suelo | El casco escalado desde el suelo quedaba descolocado |
| Soportes de plano decorativos en el hero | Eliminados | Decoración sin función |
| Tarjeta de móvil con radio de 24 px | 16 px | Sobrerredondeo |
| Logo sin fondo sobre secciones claras | Plaqueta del color base de la sección en todos los tonos | El contenido que pasaba por debajo chocaba con el logo |
| El coche consultado entraba conduciendo desde fuera | Aparece ya en su plaza y la cámara se desliza hasta ella | Al cargar se muestra el estado actual, no el pasado |
| El perfil del catálogo terminaba de dibujarse al 42 % del recorrido | Al 26 % | En posición de lectura quedaba a medias |
| `401` al preguntar si hay sesión | `200` con `ok: false` | Era un error de consola en cada visita al panel |
| 152 llamadas de dibujo | 122–134 | Aristas de carrocería y de rueda fusionadas |
| El motor 3D se descargaba también en privacidad | Solo en las páginas con escena | Peso innecesario |
| Botón de simulación sobre el segundo CTA en móvil | Recolocado al borde de la escena | Solapamiento |

Aceptado sin cambio: el flood parte de `scale(0)` (es el mecanismo del relleno, no un elemento que aparece) y la cámara se desliza al seleccionar un coche (unos 0,5 s, interrumpible).

## Checklist de ciberseguridad (Regla 8)

| Punto | Estado |
|---|---|
| Validación en servidor además de cliente | Hecho |
| CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy | Hecho (`server/security.js`, `public/_headers`) |
| Honeypot y límite de intentos | Hecho en contacto, acceso y consulta. No hay chat |
| Ninguna clave en el frontend | Hecho. El PIN de la demo se muestra a propósito y solo con `DEMO_MODE` |
| Secretos fuera del código | Hecho (`.env.example`; `.env` ignorado por git) |
| CORS y validación de payload | Demo: solo mismo origen, cabecera propia, JSON de 16 KB como máximo. Supabase: lista de orígenes |
| Auditoría de dependencias | 0 vulnerabilidades |
| Privacidad de datos de terceros | Política redactada con los datos del responsable como FALTA. Sin servicios de terceros en la demo |
| Always Use HTTPS, WAF, SSL «Full (strict)», Under Attack, 2FA | **Pendiente**: es configuración de Cloudflare, GitHub y Supabase, fuera del código |
| Copias de seguridad y plan de incidente | Documentado en `docs/deploy-supabase.md`; pendiente de activar |

## Hallazgos de security-audit (modo guía)

Pruebas solo contra código y fixtures locales.

| Clase | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| Control de acceso | El reinicio de la demo se fiaba de «petición local»; detrás de un proxy todas lo son | Media | Corregido: desactivado con `TRUST_PROXY=1` |
| Recursos | Sesiones sin tope: con el PIN público de la demo se podían crear sin límite | Media | Corregido: 300 como máximo |
| Recursos | Coches entregados sin tope por taller | Baja | Corregido: 300 |
| Recursos | Conexiones de tiempo real sin tope | Baja | Corregido: 40 por taller |
| Lógica | 4 cifras del teléfono con 5 intentos cada 15 min: unas 480 pruebas al día por coche | Media | Corregido: además, 15 al día por coche |
| Web | Error no controlado al decodificar una ruta en la vista previa | Baja | Corregido |
| Inyección | Sin SQL en la demo; sin `innerHTML`; el QR se dibuja como trazado | — | Sin hallazgos |
| Cadena de suministro | Edge Functions con versiones mayores (`@2`, `@5`) sin fijar | Baja | Abierto: fijar al desplegar |
| Datos | Copia del panel y cola offline en `localStorage` (matrículas, últimas cifras y, en un alta sin conexión, el teléfono) | Baja | Aceptado: se borra al salir; documentado |
| Lógica | 20 fallos de PIN bloquean el taller 15 min: un tercero puede provocarlo | Baja | Aceptado: es el coste del bloqueo |
| IA / LLM | No hay | — | No aplica |

## Revisión con Codex

Codex no pudo leer el repositorio (su sandbox bloqueó el acceso a ficheros en los dos intentos) y revisó diez ficheros pegados en el prompt. Sin revisar: `Panel.jsx`, `Consulta.jsx`, `mockAdapter.js`, `paths.js`, `shared/domain.js`, `shared/plates.js`, `server/index.js`.

**Veredicto de Codex:** no desplegar la parte de Supabase con datos reales hasta resolver idempotencia, concurrencia de plazas y control de revisión; el modo demo aísla los talleres de forma consistente.

| # | Gravedad | Problema | Qué se hizo |
|---|---|---|---|
| 1 | Alta | La Edge Function no registraba el `opId` | Corregido: tabla `panel_ops` y comprobación en la función. No es atómico con la escritura |
| 3 | Alta | Carrera al asignar plaza, sin reintento ni control de revisión | Corregido: hasta 3 reintentos en el alta y `WHERE rev = …`; el cliente reintenta una vez un conflicto |
| 2 | Media | `part_remove` y `delete` sin `opId`; la cola descarta operaciones fallidas | Parcial: un borrado repetido devuelve 404 y se tolera; una operación rechazada se descarta con aviso al operario |
| 4 | Media | La consulta devuelve las plazas ocupadas por otros coches | Sin cambio: lo exige el encargo (siluetas anónimas) |
| 5 | Media | La matrícula basta para consultar y un tercero puede agotar su límite | Sin cambio: lo exige el encargo. **Decisión pendiente de Tridom** |
| 6 | Media | Límites del PIN en memoria en la demo | Aceptado para la demo; en Supabase van en base de datos |
| 7 | Media | Cookie sin `Secure` si el proxy no está declarado | Documentado (`TRUST_PROXY`) |
| 8 | Media | Se aceptaban peticiones sin `Origin` | Corregido: obligatorio y con prueba automática |
| 9 | Media | La IP del límite en Supabase depende de cabeceras reenviadas | Abierto: comprobar en el despliegue real |
| 11 | Media | El desvío anti-bloqueo podría dejar un coche parado | No reproducido en 660 + 150 cambios aleatorios; queda anotado |
| 10 | Baja | Tokens de consulta inválidos tras reiniciar | Documentado (`SESSION_SECRET`) |
| 12 | Baja | Plantilla sin validar frente a los elevadores | Abierto |
| 13 | Baja | Un hash de PIN mal formado daba error 500 | Corregido |
| 14 | Baja | Política de Realtime por comprobar en un proyecto real | Abierto |

## Lo que no está verificado

- **Supabase:** la migración y las dos Edge Functions no se han ejecutado nunca (no hay credenciales). Los arreglos de Codex en esa parte tampoco.
- **Móvil real:** el rendimiento se midió en un PC.
- **Medidas del catálogo:** escritas de memoria; hay que contrastarlas.
- **Instalación como PWA y uso sin red tras recargar:** el service worker se registra y la cola offline funciona con la página abierta; no se probó instalar la app ni abrirla sin conexión desde cero.

## Desviaciones del encargo

- El modo demo usa una API local (`server/`) en lugar de solo fixtures + localStorage, para que el PIN, la cookie y la consulta pasen por servidor. Panel y consulta no funcionan en un hosting puramente estático.
- No se instaló la librería Motion: el movimiento va con el ticker único y los muelles de la Regla 7.
- drei solo aporta la cámara ortográfica; el resto de la escena es three directo dentro del lienzo de React Three Fiber.
- Un mecánico, no dos.
- Sin sección de precios (FALTA) y sin testimonios ni cifras.

## Mejoras de limpieza y uso del panel (2026-11)
Pedidas por Gonzalo/Pablo tras revisar la demo: nueve cambios. Decisiones:
- **Demo por variable:** `DEMO_MODE=0` ya existía para ocultar el banner, pero el servidor seguía creando «Taller Demo» con el PIN conocido. Ahora no se crea nada y el taller sale de `WORKSHOP_*`. Test en `tests/api.test.mjs`.
- **Entregados al historial:** sin pestañas; el historial vive en Ajustes y respeta la retención.
- **Operador recordado:** solo el operador y el código del taller, en `localStorage` (`tg_login_v1`). El PIN sigue siendo del taller; si hace falta saber quién hizo cada cambio con garantías, haría falta un PIN por persona (no se ha hecho).
- **Pista de una vez:** `tg_hint_select_v1` en `localStorage`; desaparece al tocar un coche o a los 9 s.
- **Entrega estimada:** ya existía el campo (`etaAt`, solo fecha) pero estaba dentro de «Notas · Coste». Pasa a su propio bloque con atajos y aviso cuando falta. No se añade hora: exigiría cambiar el modelo y no aporta al taller.
- **Etiquetas rápidas:** campo nuevo `tags` por coche (no entra en las notas, que siguen pidiendo 10 caracteres) y `noteTags` por taller.
- **Resumen del día:** se calcula en el cliente con los datos que ya llegan; solo la ve la Oficina. «Entregados hoy» solo cuenta lo que no se haya borrado por retención.
- **QR por coche:** código aleatorio de 6 caracteres, no la matrícula (la matrícula es fácil de adivinar). Entrada por `?c=`; el coste sigue exigiendo el teléfono. Con el QR no se aplica el límite por matrícula, solo el de IP.
- **Landing:** cabecera con 3 enlaces; Panel, Cliente, Escena y Privacidad pasan al pie.
- **Corregido de paso:** al salir del panel quedaba seleccionado el último coche en la escena.
- **Supabase:** migración 0002 y cambios en las funciones `panel` y `consulta`, sin probar contra un proyecto real.
