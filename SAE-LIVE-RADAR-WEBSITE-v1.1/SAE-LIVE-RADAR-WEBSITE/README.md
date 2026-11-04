# SAE LIVE RADAR WEBSITE v1.3.0

Sitio comercial SAE RADAR con cuentas, derecho de compra/actualizaciones, Mercado Pago Checkout Pro vía Orders API y persistencia PostgreSQL (Neon).

## Render
- Root Directory: carpeta del sitio web.
- Build: `npm install`
- Start: `npm start`
- Requerido en producción: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_TOKEN`, `SITE_URL`, `MP_ACCESS_TOKEN`, `MP_PRICE_UYU`, `MP_WEBHOOK_SECRET`.
- `RADAR_DOWNLOAD_FILE`: ruta absoluta al instalador privado fuera de `public/`.

## Neon
Crear un proyecto PostgreSQL en Neon y configurar la cadena de conexión pooled en `DATABASE_URL`. En el primer inicio el servidor crea `sae_radar_state` y sus claves iniciales. Usuarios, órdenes y consultas se almacenan como JSONB por colección. En producción el servidor no inicia si falta `DATABASE_URL`.

## Mercado Pago Checkout Pro — Orders API
1. La cuenta del tutor crea la aplicación y obtiene su Access Token de producción. Nunca publicar ni compartir el token.
2. Configurar `MP_ACCESS_TOKEN` en Render.
3. Configurar `MP_PRICE_UYU` con el importe final fijo en pesos uruguayos (ejemplo de formato `199.00`; elegir el importe comercial real según el precio publicado). La página mantiene US$4.99 como referencia visual, pero el cobro es en UYU; no hay conversión automática.
4. Configurar `SITE_URL` con la URL HTTPS real del sitio.
5. En Mercado Pago > Configuración de Webhooks, seleccionar Producción, evento Order, y usar `https://TU-SITIO/api/mercadopago/webhook`. Copiar la firma secreta generada a `MP_WEBHOOK_SECRET`.
6. El servidor valida la firma HMAC, consulta la order en Mercado Pago y solo otorga acceso si la order está `processed` / `accredited`, `total_paid_amount` coincide con `MP_PRICE_UYU`, la moneda es UYU y la referencia externa corresponde a una orden de esa cuenta.

El botón no concede acceso por el simple retorno del checkout. La compra se verifica contra la API oficial. Las credenciales solo se configuran por el adulto titular de la cuenta del comercio.

## Seguridad y operación
- Nunca pedir ni almacenar datos de tarjetas. Checkout ocurre en Mercado Pago.
- No compartir `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `DATABASE_URL`, `SESSION_SECRET` ni `ADMIN_TOKEN`.
- No habilitar ventas reales hasta que el tutor complete la verificación del comercio, configure el webhook de producción, pruebe una compra y configure el instalador privado.
- El producto se muestra como US$4.99, pero el importe real se fija en UYU. Revisar y mostrar claramente el precio final en UYU antes de publicar.
