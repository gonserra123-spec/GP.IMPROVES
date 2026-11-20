# Tridom Automotive · Taller

La parte que usa el mecánico. Mismo diseño y tipografía que la demo comercial (`tridom-garage`), pero hecha para perder el mínimo tiempo: **dos botones grandes por coche** («En curso» y «Finalizado») y un correo automático al cliente en cada paso.

La consulta del cliente (por matrícula o correo) es otra aplicación aparte.

## Arrancar

```bash
npm install
npm run seed:demo   # crea «Taller Demo» e imprime las dos claves
npm run dev         # http://localhost:5300
npm test            # 16 pruebas del servidor
```

- `/` — el taller entra con **una sola clave** (`XXXX-XXXX-XXXX`): la clave decide el taller y el rol.
- `/admin` — administración de Tridom (clave `ADMIN_KEY`; en local, `admin-dev-local`).
- `/baja/…` — enlace de baja que lleva cada correo.

## Qué hace

| Pieza | Cómo funciona |
|---|---|
| Alta | Un solo campo: matrícula **o** correo. Si el cliente ya vino se rellena todo; si no, pide solo lo que falta. Foto y entrega prevista opcionales. |
| Botones | Alta → «En el taller»; «En curso»; «Finalizado». Solo hacia delante. Cada paso es un correo. |
| Deshacer | 10 s (`UNDO_SECONDS`). El correo no sale hasta pasado ese margen, así que deshacer lo cancela. Si ya salió, no se puede. |
| Sin conexión | Los toques se guardan en el dispositivo y se envían al volver la red. La misma operación repetida no se duplica (`opId`). |
| Correos | Plantillas editables por taller, teléfono y horario, un único remitente (`MAIL_FROM`), enlace de baja, anti-duplicados (10 min) y registro de envíos con aviso de rebotes. |
| Hoja de Google | Una por taller. Se reescribe entera desde la base: **la base manda, la hoja es una copia**. Pestañas «Coches» y «Tiempos». |
| Excel | Botón «Descargar Excel» (mismas dos pestañas). |
| Tiempos | Media desde la entrada hasta «Finalizado» y desde «En curso» hasta «Finalizado», por día. |
| Resumen diario | Un correo al dueño a la hora elegida: entradas, finalizados y pendientes. |
| Claves y roles | **Mecánico**: lista y dos botones (y ve si un correo rebotó). **Dueño**: además envíos, tiempos, Excel y ajustes. Cada taller tiene su propia base de datos. |
| Administración | Alta de talleres, pausa y cambio de claves sin tocar código. Una clave cambiada o un taller pausado cierran las sesiones al instante. |

## Seguridad

- Cada taller vive en su propio archivo SQLite (`data/w/<id>/data.db`); ninguna consulta cruza talleres.
- Las claves (60 bits) no se guardan: solo su resumen HMAC. Bloqueo de IP tras 5 fallos seguidos.
- Cookie `HttpOnly; SameSite=Strict`, comprobación de origen y cabecera propia en todo lo que cambia datos.
- El mecánico ve el correo del cliente enmascarado (`a***@gmail.com`).
- Fotos: solo JPEG real y de menos de 900 KB.

## Pendiente de conectar (necesita cuentas de Tridom)

1. **Servicio de correo** (Resend): sin `RESEND_API_KEY` el modo es «pruebas» y los correos solo se guardan en `data/outbox-dev/`.
2. **Google Sheets**: cuenta de servicio y `GOOGLE_SERVICE_ACCOUNT_JSON`. Sin ella la hoja no se sincroniza (el Excel descargable sí funciona).
3. **Alojamiento con disco persistente** para `DATA_DIR`.
4. **Contrato de encargado del tratamiento** con cada taller (borrador en `docs/`).

Todo en `docs/despliegue.md`.
