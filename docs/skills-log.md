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

## Revisión v3 (2con2estudio · monografía suiza)
El cliente pidió adaptar la web a la referencia Yllw y añadir «todo tipo de movimiento». Se rehace el sistema visual conservando contenido, formulario, bilingüe, SEO y datos.
- **Tipografía**: Archivo Variable (ejes de peso y anchura, 68-72 % en titulares) como única familia, en mayúsculas a 0.88 de interlineado. Sustituye a la grotesca comercial de la referencia.
- **Color**: papel masilla `#cac7b4`, tinta `#000`, blanco, carbón `#191919` y amarillo `#ffdd00` solo en la barra superior y los puntos de la cinta. Se aparta de la regla «solo blanco y negro» del logo porque la referencia lo pide; se quita quitando la barra.
- **Barra amarilla**: sin ofertas ni urgencias, solo el servicio y la ciudad. El selector ES/EN va en la cabecera fija (no en la barra) para que esté siempre visible.
- **Movimiento** (todo con alternativa estática en prefers-reduced-motion): titular con máscara palabra a palabra y fotos que se abren entre las palabras; barra de progreso; cinta infinita que acelera y cambia de sentido con el scroll; filas de servicios que se rellenan de negro al pasar el cursor; botones con texto que rueda y efecto imán; «Vano de obra» (clip-path por scroll, firma); proyectos en pasillo horizontal fijado con paralaje; proceso en tarjetas apiladas que se encogen; menú a pantalla completa con revelado; nombre del estudio gigante en el pie con letras que suben.
- **Logo**: ahora se muestrea en cinco puntos; si el fondo cambia dentro del logo o hay una foto, usa placa. Con el fondo carbón aparece la versión blanca.
- **Enlaces de navegación**: usan mix-blend-mode difference para leerse sobre cualquier fondo; el logo nunca se mezcla ni se recolorea.
- **Radios**: 2px en botones y 6px en tarjetas, como la referencia; trazos de 1px en lugar de sombras.

### Ajustes v3 (cliente)
- Se quitan las dos fotos del titular; el titular queda en dos líneas.
- La cinta de texto bajo el titular va más lenta (0,9 %/s en lugar de 2,4 %/s) y reacciona menos al scroll.
- Instagram oficial (@2con2estudio): botón en la cabecera fija, enlace en el menú y fila en Contacto, todos hacia https://www.instagram.com/2con2estudio/.
- **Tipografía de titulares**: Archivo a anchura 68-78 % dibujaba mal los acentos de Ñ y Ó, así que los titulares pasan a Barlow Condensed (condensada, como el logo); Archivo queda para texto y formulario.
- **Error corregido**: la clase `.row` del titular chocaba con la de las filas desplegables (overflow hidden), y recortaba los acentos; el titular usa ahora `.hl`.

### Casa interactiva y reseñas (cliente)
- **Todo tipo de reformas**: el listado de texto se sustituye por una casa en corte dibujada en SVG (trazos que se dibujan al entrar, humo de la chimenea, tejado que se levanta). Cocina y baño abren su texto; «Reforma integral» se elige pulsando el tejado y enciende toda la casa; salón-comedor y dormitorio abren «Otras reformas». Los textos son los mismos de antes. Para teclado y lector de pantalla hay pestañas (tablist) con los cuatro tipos.
- **Reseñas de Google**: sección preparada (`src/data/reviews.js`) pero SIN reseñas inventadas. Se pidió escribir reseñas de 5 estrellas con nombres cambiables «para que sean verdaderas»; no se hace porque presentar reseñas falsas como reales engaña a los clientes y está prohibido (Directiva (UE) 2019/2161, normativa de consumo). Mientras no haya reseñas reales la sección solo aparece en beta como huecos marcados [FALTA]; con `SHOW_PLACEHOLDERS = false` desaparece. Cuando se añadan reseñas reales (texto literal, nombre y valoración que puso el cliente) se muestran con sus estrellas; la media y el recuento solo salen si se rellenan con los datos reales de la ficha. No se añade `aggregateRating` al JSON-LD.

### Nueva animación de firma: «Nivel láser» (cliente, libertad creativa)
Sustituye a «Vano de obra». Con el scroll, un láser de nivel amarillo (la herramienta real de una obra) sube por un plano (rejilla, muros, cotas «largo» y «alto» y marcas de registro) y, a su paso, el plano se convierte en la estancia construida: la foto se revela de abajo arriba mientras se encoge de 1,16 a 1. Una etiqueta «Avance de obra 0-100 %» acompaña al láser y el título «Abrimos el espacio» pasa de contorno a relleno de izquierda a derecha al mismo ritmo.
- No es un antes/después de un mismo proyecto: el plano es un dibujo genérico de cotas, sin medidas ni datos del proyecto, y por eso las cotas solo llevan palabras.
- La rejilla del plano es una superficie de plano real, no un fondo decorativo (el detector la señala como aviso, aceptado).
- Con prefers-reduced-motion: título completo y foto estática, sin plano ni láser.
