"use strict";

const baseUrl = String(process.env.RADAR_INGEST_URL || "").replace(/\/+$/, "");
const token = String(process.env.RADAR_INGEST_TOKEN || "");

if (!baseUrl || !token) {
  console.error("Configurá RADAR_INGEST_URL y RADAR_INGEST_TOKEN antes de ejecutar npm run test:spawn.");
  process.exit(1);
}

async function main() {
  const response = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ pets: ["Royal SkyWhale", "Oni Tiger"] })
  });
  const result = await response.json().catch(() => ({}));
  console.log(`HTTP ${response.status}`, result);
  if (!response.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error("No se pudo enviar el evento de prueba:", error.message);
  process.exitCode = 1;
});
