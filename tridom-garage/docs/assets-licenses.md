# Licencias y procedencia de assets

## Modelos 3D

**No hay ningún modelo 3D externo.** Todo lo que aparece en la escena se genera por código en este repositorio y es obra propia del proyecto:

| Elemento | Dónde se genera | Procedencia | Licencia |
|---|---|---|---|
| Coches (10 arquetipos: utilitario, compacto, berlina, familiar, SUV pequeño, SUV grande, coupé, monovolumen, furgoneta, pick-up) | `src/scene/carProfile.js`, `src/scene/carGeometry.js` | Perfiles paramétricos propios, extruidos con three.js | Propia (Tridom) |
| Nave, elevadores, foso, escalera, mostrador, sillas, carro, compresor, banco | `src/scene/world.js` | Cajas y cilindros generados por código | Propia (Tridom) |
| Mecánico y sus animaciones (de pie, caminar, inspeccionar, trabajar bajo el coche y en el capó, escalera del foso, entrega de llaves) | `src/scene/mechanic.js` | Esqueleto de cajas animado por código; sin clips externos | Propia (Tridom) |
| Iconos flotantes, rótulos y sombra de contacto | `src/scene/engine.js`, `src/scene/world.js` | Dibujados en `<canvas>` en tiempo de ejecución | Propia (Tridom) |

No se usan modelos de fabricantes, ni extraídos de videojuegos, ni logotipos de marcas. Los coches son siluetas genéricas por categoría: no reproducen el diseño de ningún modelo concreto.

Si más adelante se añaden GLB (Kenney, Quaternius, Poly Pizza, Sketchfab), solo con licencia CC0 o CC-BY, y hay que anotar aquí autor, URL, licencia y texto de atribución de cada uno.

## Catálogo de modelos (`shared/models.json`)

- Nombres de marca y modelo: se citan únicamente para identificar el vehículo (uso descriptivo). No se usa ningún logotipo.
- Medidas (largo, ancho, alto): valores aproximados de las fichas públicas de cada fabricante para la generación indicada en `from`. **Se escribieron de memoria y no se han contrastado una a una**: hay que verificarlas contra la ficha oficial antes de presentarlas como dato.

## Tipografías

| Familia | Paquete | Licencia |
|---|---|---|
| Figtree Variable | `@fontsource-variable/figtree` | SIL Open Font License 1.1 |
| Saira Condensed | `@fontsource/saira-condensed` | SIL Open Font License 1.1 |

## Librerías

| Paquete | Licencia |
|---|---|
| react, react-dom | MIT |
| three | MIT |
| @react-three/fiber, @react-three/drei | MIT |
| zustand | MIT |
| lenis | MIT |
| qrcode-generator | MIT |
| @supabase/supabase-js | MIT |
| vite, @vitejs/plugin-react (desarrollo) | MIT |

## Iconos e imágenes

Los iconos de la interfaz y el favicon son SVG propios dibujados para este proyecto. No hay fotografías.
