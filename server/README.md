# SAE LIVE RADAR — servidor central

Este servicio es el punto común entre SAE PREDICTOR y todas las instalaciones de SAE LIVE RADAR.

- `POST /api/events`: recibe las mascotas detectadas. Requiere `Authorization: Bearer <RADAR_INGEST_TOKEN>`.
- `GET /api/events/stream`: stream SSE público de solo lectura. Las apps de escritorio no necesitan Discord ni token.
- `GET /health`: estado del servicio.

## Despliegue de prueba en Render

1. Subí la carpeta `server/` a un repositorio de GitHub.
2. En Render creá un **Web Service** conectado a ese repositorio.
3. Configurá `Root Directory` como `server`, `Build Command` como `npm install` y `Start Command` como `npm start`.
4. Agregá la variable secreta `RADAR_INGEST_TOKEN`. Generá un secreto largo con:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Cuando termine el despliegue, comprobá `https://TU-SERVICIO/health`.
6. Copiá la URL HTTPS del servicio a `electron/radar-config.cjs` en el proyecto de escritorio. Después recompilá el instalador.
7. En las variables de entorno del hosting de SAE PREDICTOR agregá:
   - `RADAR_INGEST_URL` = URL raíz HTTPS del servidor, sin `/api/events` al final.
   - `RADAR_INGEST_TOKEN` = exactamente el mismo secreto configurado en el servidor.

El archivo `render.yaml` contiene una plantilla de servicio de prueba. Render documenta que sus instancias gratuitas pueden apagarse tras 15 minutos sin tráfico entrante y reiniciarse; por eso el módulo de integración incluye un ping periódico desde SAE PREDICTOR. Esto reduce el apagado por inactividad, pero no evita reinicios ni convierte un plan gratuito en un servicio con garantía de disponibilidad. Para una distribución pública confiable usá un servicio siempre encendido y monitoreá su estado.

## Prueba privada del relay

Con el backend desplegado, configurá en PowerShell, desde esta carpeta `server`:

```powershell
$env:RADAR_INGEST_URL = "https://TU-SERVICIO"
$env:RADAR_INGEST_TOKEN = "TU_SECRETO"
npm run test:spawn
```

Eso manda `Royal SkyWhale` y `Oni Tiger` directamente al backend. **No publica ni modifica ningún mensaje de Discord**, pero sí aparecerá como una detección de prueba en todas las apps conectadas a ese backend. Para no confundir a usuarios reales, hacelo antes de compartir el servicio o avisales que es una prueba.

## Estado y límites de esta primera versión

- El backend mantiene las detecciones del ciclo actual en memoria y las reinicia al empezar el siguiente bloque de 5 minutos.
- Si el proceso del servidor se reinicia, pierde las detecciones activas de ese ciclo. La app vuelve a conectarse automáticamente, pero esta primera versión todavía no usa base de datos persistente.
- Ejecutá una sola instancia del relay: el estado y la difusión SSE de esta versión viven en memoria dentro del proceso.
- El stream de lectura no requiere cuenta ni token. El único secreto está en SAE PREDICTOR y en la configuración privada del backend.
