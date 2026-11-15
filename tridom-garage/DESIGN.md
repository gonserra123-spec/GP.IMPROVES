# DESIGN — Tridom Garage · «plano técnico de taller»

Serio, limpio y profesional: papel blanco, trazo fino azul oscuro y un único azul de marca. Nunca infantil ni caricaturesco. Los tokens viven en `src/styles/app.css` (`:root`) y los colores de la escena en `src/scene/world.js` (`COLORS`); son los mismos valores.

## Escena física
Un taller con luz de fluorescente, un iPad apoyado en el carro de herramientas y manos con guantes. Por eso el tema es claro (se lee con reflejos y suciedad en la pantalla), los objetivos son grandes y el contraste alto. La consulta del cliente se abre en el móvil, de pie en recepción: una sola columna, un campo.

## Referencias (Refero Styles, consultadas el 2026-11-14)
Se copia la técnica, no la marca.
1. **shadcn/ui** — lienzo blanco, bordes finos de 1 px en lugar de sombras, un solo color cromático reservado a estados. De aquí sale «borde en vez de sombra» y el color semántico usado solo para estado.
2. **Vercel** — «terminal tipografiado sobre papel blanco»: mucha superficie blanca, jerarquía por tipografía y línea. De aquí sale la densidad baja de la landing y los separadores de trazo.
3. **Brex** — «hormigón blanco con un único acento»: un acento para la interacción y nada más. De aquí sale la regla del azul 500 solo para lo que se puede tocar.

Supahero no está disponible en esta máquina; no se ha usado.

## Color
Estrategia *restrained*: neutros fríos con un acento ≤ 10 % de la superficie. El ámbar y el verde son semánticos, nunca decoración.

| Token | Valor | Uso |
|---|---|---|
| `--white` | `#FFFFFF` | Fondo base, tarjetas, relleno de coches y mobiliario 3D |
| `--paper` | `#F4F7FC` | Fondo de secciones alternas, suelo de la nave, fondo del panel |
| `--grid` | `#D9E2F2` | Rejilla del suelo, separadores suaves, pasos inactivos |
| `--blue-100` | `#E6EEFC` | Hover, superficies informativas, cristales de los coches |
| `--blue-500` | `#2F6FED` | Marca y acento de interacción: botón primario, selección, foco, pintura de seguridad, coche resaltado |
| `--blue-700` | `#1F4FB8` | Enlaces y rótulos secundarios (7,3:1 sobre blanco) |
| `--blue-900` | `#0B2A5B` | Trazo, títulos, bordes de controles, fondo de secciones oscuras |
| `--ink` | `#0E1B2E` | Texto |
| `--mute` | `#44567A` | Texto secundario (7,4:1 sobre blanco; nunca más claro) |
| `--amber` | `#F5A524` | Esperando pieza / aprobación, aviso sin conexión, etiqueta DEMO. Siempre como fondo con texto `--ink` |
| `--green` | `#1FA971` | Listo para recoger, conectado. Como borde o punto; el texto encima va en `--ink` |
| `--red` / `--red-700` | `#D64545` / `#A92A2A` | Borde de error / texto de error (el 700 da 6,6:1) |

Contraste: texto normal ≥ 4,5:1 (AA). Blanco sobre `--blue-500` da 4,6:1 y solo se usa en botones con texto de 17 px en peso 650. El ámbar y el verde nunca llevan texto blanco.

## Tipografía
- **Figtree Variable** (sans geométrica): interfaz, párrafos, botones, datos. Pesos 400, 600 y 650.
- **Saira Condensed** 600/700 (condensada industrial): títulos, rótulos, matrículas, cifras grandes y los textos pintados en la escena (ENTRADA, SALIDA, números de elevador). Siempre en mayúsculas en títulos.
- Landing: `clamp()` fluido (`.h-display` 2,75–5,5 rem; `.h-section` 2–3,25 rem). Panel y consulta: escala fija en rem; Saira solo en matrículas y títulos de bloque, nunca en botones ni etiquetas.
- `text-wrap: balance` en títulos y `pretty` en párrafos; línea máxima 56–70 caracteres.

## Espacio, forma y trazo
- Rejilla de 8 px (4 px para ajustes internos). Secciones de la landing: `clamp(72px, 10vw, 136px)`.
- Radios pequeños: `--r-s` 6 px (chips), `--r-m` 8 px (botones, campos), `--r-l` 10 px (tarjetas). Máximo 16 px (tarjeta de móvil de la landing).
- Trazo `--stroke` 1,5 px en `--blue-900`. Sin sombras: la elevación se expresa con borde. La única «sombra» es la de contacto falsa bajo los coches en la escena.
- Sin degradados (salvo esa sombra de contacto). Sin vidrio esmerilado.
- Iconografía de línea, 1,8 px, extremos redondeados.

## Componentes
- **Botón** (`.btn`): 56 px de alto (44 px en `--sm` para acciones secundarias), relleno azul 500 o contorno azul 900. *Flood* interrumpible que nace donde entra el puntero (solo con `hover: hover` y `pointer: fine`) y `scale(0.97)` al pulsar.
- **Elección** (`.choice`): botones de estado y ubicación del panel. 56 px mínimo, un toque, estado activo relleno, ocupado en gris con la palabra «Ocupado».
- **Campo** (`.input`): 56 px, borde azul 900, error con borde rojo, fondo tintado, icono y texto. La matrícula y el PIN usan Saira a 28 px con el teclado adecuado (`inputmode`, `autocapitalize`).
- **Chip de estado** (`.chip`): punto + texto; ámbar para esperas, verde para listo, azul para trabajo en curso. El color nunca es el único indicador: siempre hay texto.
- **Aviso** (`.notice`) y **toast**: borde semántico + texto; `aria-live`.
- **Foco**: contorno de 3 px azul 500 con separación de 2 px (blanco sobre fondos oscuros).
- Escala de capas: `--z-sticky` 20, `--z-header` 40, `--z-sheet` 60, `--z-toast` 80.

## Sector: taller mecánico
- Rótulos tipo señalización: placas con borde (`.sign-plate`), números de elevador en Saira 700, flechas de entrada y salida pintadas en el suelo.
- Cuadrícula de suelo de 1 m en la escena (es una superficie de plano real, no un fondo decorativo).
- Líneas de seguridad discontinuas a los lados del pasillo, alrededor del foso y en el carril exterior.
- Cinta de rótulos entre secciones con los nombres de las ubicaciones.

## Escena 3D
- Cámara ortográfica isométrica (azimut 45° ± 34°, elevación 35,5°).
- Todo en blanco con aristas `--blue-900`; cristales en `--blue-100`; pintura de suelo e interacción en `--blue-500`; coches ajenos de la consulta en gris azulado (`#8FA3C4`).
- Materiales sin iluminación ni sombras reales; sombra de contacto por textura.
- Coche seleccionado o consultado: aristas azul 500, cristal más saturado y anillo en el suelo.
- Iconos flotantes: portapapeles y caja en ámbar, check en azul.

## Movimiento
- BASE en las tres superficies: un único ticker (`src/lib/ticker.js`), muelles (`src/lib/spring.js`) para todo lo que se mueve, sin `@keyframes`, hovers solo con puntero fino, `prefers-reduced-motion` con fotograma estático.
- Landing (nivel 3): hero WebGL con recorrido de cámara ligado al scroll (firma), capas a distinta velocidad, raíl de capítulos, tarjeta del cliente que cambia de estado con el scroll, perfil del coche que se dibuja con el scroll, cinta de rótulos que acelera con la velocidad de scroll, revelado de titulares por línea.
- Panel y consulta: solo feedback de estado (150–250 ms) y la animación de la escena.

## Accesibilidad
- Todo lo que muestra la escena existe también como texto: lista de coches del panel, tarjeta de la consulta y vista en lista si WebGL falla.
- Teclado: la escena admite flechas, `+`, `-` y `0`; los controles son botones con nombre.
- Objetivos táctiles de 56 px en el panel (44 px mínimo en acciones secundarias).
- Selector ES/EN en las tres superficies; `lang` del documento sincronizado.
