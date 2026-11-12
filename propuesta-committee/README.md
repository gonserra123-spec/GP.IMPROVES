# Propuesta Committee Club Valencia

Presentación y demo de reservados VIP (mesa en el plano + botellas y refrescos) con campañas de cumpleaños y reactivación.

## Contenido

| Archivo | Qué es |
|---|---|
| `Propuesta-Committee-Reservados-VIP.pptx` | Presentación de 19 diapositivas |
| `data.mjs` | Datos públicos de la sala: zonas, mesas, reglas y carta de botellas |
| `model.mjs` | Modelo económico (escenarios conservador, base y optimista) |
| `build-deck.mjs` | Genera el PowerPoint con los números del modelo |
| `app.mjs` · `server.mjs` | API de la demo y servidor (sin dependencias) |
| `public/` | Web de la demo: cliente, sala, campañas, simulador y API |
| `test/` | Pruebas del modelo y de la API |

## Cómo usarlo

```bash
cd propuesta-committee
npm install          # solo para generar el PowerPoint (pptxgenjs)
npm run demo         # http://localhost:4180
npm test             # 15 pruebas
npm run deck         # regenera el .pptx
```

La demo no necesita instalar nada para funcionar: solo Node 22 o superior.
Para aplicar el tema de colores al regenerar el PowerPoint hay que pasar la variable `APPLY_THEME_JS`
con la ruta del script `apply_theme.js` de la habilidad de PowerPoint; sin ella el archivo se genera igualmente.

## Qué es real y qué es simulado

- **Datos públicos** (noviembre de 2026): dirección, horarios, edades, zonas, precios de mesa, reglas 5+2 con +20 %, señal del 50 % y carta de botellas. Las fuentes discrepan en algunos precios; ver el anexo de la presentación.
- **Estimaciones**: número de mesas por zona (una sola fuente), precios intermedios de Ghost, el plano de la sala y la lista de refrescos.
- **Supuestos del modelo** (ocupación de partida, conversiones, márgenes, cuotas): ilustrativos. Hay que sustituirlos por datos de caja del grupo antes de presentar cifras como compromiso.
- **Simulado en la demo**: cobro de la señal, envío de WhatsApp y Telegram, y todos los clientes (sintéticos). Los datos viven en memoria y se reinician al arrancar.
