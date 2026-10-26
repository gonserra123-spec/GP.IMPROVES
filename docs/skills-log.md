# Registro de skills y decisiones

| Proyecto | Fingerprint (estilo) | Skills | Tipografía | Paradigma de hero | Tono de color | Layout | Detalle de firma | Conflictos resueltos |
|---|---|---|---|---|---|---|---|---|
| Marjal · clínica estética València (beta, datos DEMO) | **Dimension** (dado por el cliente; Fases -1 y 1 omitidas) | review-animations e impeccable (criterios aplicados como checklist manual; la skill `review-animations` no figura entre las instaladas en esta sesión). `redesign-existing-projects` no aplica. | DM Sans 500 (display `clamp(44px, 6vw, 72px)`, -0.035em) + Geist 500 en encabezados | Panel "Hero Horizon" ámbar→coral→cobalto, texto a la izquierda, marco de imagen 40px/40px/0/0 a la derecha con parallax de capas | Casi acromático; violeta `#6b62f2` solo en la franja Dusk Violet (degradado) | Columna de 1200px, secciones 64-80px, alterna lienzo y cristal | Nav flotante en píldora + banner píldora + sección Proceso sticky con degradado que se desplaza y texto enmascarado | Ver abajo |
| 2con2estudio · reformas y interiorismo, Valencia (beta, fotos provisionales) | **1. Showroom brutalista** (menú de 5; referencia «brutalist editorial showroom on warm gray» aportada por el cliente, sin menta ni amarillo) | impeccable; `review-animations` no instalada (criterios aplicados como checklist manual); `redesign-existing-projects` no aplica | Anton (display 130px, 0.9, -0.03em) + Inter Variable 450/500 + JetBrains Mono 12px solo para medidas y etiquetas | Titular partido en 4 líneas a la izquierda + tarjeta de foto con arco superior de 64px a la derecha (nunca a pantalla completa) | Gris cálido `#e5e5e5` + blanco + negro; sin acentos (el color lo ponen las fotos) | Columna de 1200px, tarjetas blancas de 32px y bloques negros a sangre, sin sombras | Arco superior de 64px como «vano» del logo abierto por abajo + animación «Vano de obra» (clip-path por scroll) | Ver abajo |

## Conflictos resueltos (Prompt Maestro v6.1 > Dimension)
- **Nav**: el md pide radio asimétrico de 19px; el encargo pide píldora → 9999px.
- **Hairline #e5e5e5**: se usa pleno en controles (píldoras, inputs: contraste 3:1) y `rgba(229,229,229,.16)` (`--hairline-soft`) en divisores decorativos y tarjetas de cristal.
- **Hero Horizon**: ámbar y coral oscurecidos (`#a3470a`, `#a83a2e`) y cobalto `#1f46c4` para que el texto blanco cumpla AA, incluso sobre el cristal del Proceso.
- **Errores de formulario**: color `#ffb4a8` (tinte del coral del degradado) + icono; no es un color de marca nuevo.
- **Geist**: el md lo limita a ≥24px en cuerpo, pero su "Section Header" usa Geist 18px/500 para el párrafo de apertura; se respeta esto último.
- **Titulares ≤500**: se evita el 600 de Geist en todos los h1-h3.
- **`#686868` (Slate)**: no se usa para texto (3.5:1 sobre #0a0a0a). El número atenuado de las filas usa Ash al 68% (≥4.5:1).
- **Sombras**: ninguna. El md lista una sombra de elevación para la nav, pero también prohíbe box-shadow para elevar; gana la prohibición.
- **Acordeón**: la altura animada usa `grid-template-rows` (CSS). La altura `auto` con Motion dejaba la visibilidad bloqueada.
- **Archivos**: `docs/design/dimension.md` no existía; se creó con el texto entregado. El `index.html` anterior (Mundo Pato) se movió a `legacy/mundo-pato.html`.

## Conflictos resueltos (2con2estudio · Showroom brutalista)
- **Registro**: Dimension, DM Sans + Geist, hero degradado ámbar→cobalto, fondo `#0a0a0a`, nav de cristal y proceso sticky enmascarado estaban prohibidos por defecto; ninguna de las 5 direcciones los usó.
- **Estilo**: el prompt decía «sin estilo decidido» pero el cliente pegó la referencia Dayos; se incluyó como dirección 1 del menú y la eligió el cliente. Se quitaron la menta `#d1ffca` y el amarillo `#fff100` (identidad blanco y negro).
- **Anton vs Suisse**: Suisse es comercial; se usa Anton (libre, condensada y de peso alto como el logo).
- **Display 130px**: el suelo de craft limita el display a 6rem; gana el brief (130px, 0.9, -0.03em).
- **Radios**: la referencia pide 24-64px; el suelo recomienda 12-16px; gana el brief.
- **Sin eyebrows ni números decorativos**: solo se numera el proceso porque la secuencia importa.
- **Nav blanca sobre secciones blancas**: se añade un aro de 1px (`--ash`) a la píldora y al selector de idioma; la referencia no usa bordes, pero sin él la píldora desaparecía.
- **Campos de 10 caracteres**: se aplica a textos libres (mensaje y descripciones «Otro»). Nombre, email y teléfono se validan por formato; exigir 10 caracteres a un nombre sería inviable.
- **Color de error**: `#a4161a` sobre blanco, único color fuera de la paleta, funcional.
- **Fotos**: no hay antes/después porque ninguna foto tiene su pareja del mismo proyecto; la animación de firma revela un solo proyecto.
- **Escritura de `src/`**: el proyecto Marjal se archivó en `legacy/marjal/`.

## Revisión v2 (2con2estudio · modelo Niva)
El cliente pidió cambiar el modelo de página a niva-studio.com. Se sustituye la dirección 1 por una galería blanca: logo centrado fijo con menú de hamburguesa a la izquierda e Instagram + ES/EN a la derecha, titular en serif versal, carrusel horizontal de proyectos con encaje (scroll-snap), bloques centrados con texto mono, columnas de servicios con línea inferior, formulario plano con bordes de 1px y pie oscuro.
- **Tipografía**: Instrument Serif (titulares y frases) + IBM Plex Mono (texto). Anton, Inter y JetBrains Mono salen del proyecto.
- **Color**: blanco `#fff`, tinta `#262626`, gris suave `#f4f4f2` en la zona de presupuesto; sin acentos. Error `#a4161a`.
- **Layout**: columnas centradas de 760px (estrecha) o 1180px; radios de 3px; sin sombras (el logo con placa usa un halo del color de la sección).
- **Animación de firma**: se mantiene «Vano de obra» (clip-path por scroll) sobre el fondo blanco.
- **Logo**: sigue cambiando blanco/negro y con placa; la versión blanca solo aparece si hay un fondo oscuro bajo el logo (el pie queda por debajo del logo fijo).
- **Proyectos**: pasan de cuadrícula a carrusel; la sección «Proyectos» es el carrusel.
- **Referencia**: se copia la estructura, no los textos, imágenes ni marca de niva-studio.com.
