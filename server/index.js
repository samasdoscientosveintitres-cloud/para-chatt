"use strict";

const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 10000);
const INGEST_TOKEN = String(process.env.RADAR_INGEST_TOKEN || "");
const MAX_BODY_BYTES = 16 * 1024;
const CYCLE_MS = 5 * 60 * 1000;

const ALLOWED_PETS = new Map([
  ["oni tiger", "Oni Tiger"],
  ["gorilla king", "Gorilla King"],
  ["skeleton horse", "Skeleton Horse"],
  ["pegasus", "Pegasus"],
  ["celestial sunlion", "Celestial Sunlion"],
  ["unicorn", "Unicorn"],
  ["unicornio", "Unicorn"],
  ["kitsune", "Kitsune"],
  ["nightflame", "NightFlame"],
  ["night flame", "NightFlame"],
  ["world burner", "World Burner"],
  ["worldburner", "World Burner"],
  ["archangel", "ArchAngel"],
  ["royal skywhale", "Royal SkyWhale"],
  ["royal sky whale", "Royal SkyWhale"],
  ["skywhale", "Royal SkyWhale"]
]);

if (INGEST_TOKEN.length < 32) {
  console.error("ERROR: configurá RADAR_INGEST_TOKEN con al menos 32 caracteres aleatorios.");
  process.exit(1);
}

const clients = new Set();
let activeCycleId = getCycleId();
let activePets = [];

function getCycleId() {
  return Math.floor(Date.now() / CYCLE_MS);
}

function refreshCycle() {
  const nextCycleId = getCycleId();
  if (nextCycleId !== activeCycleId) {
    activeCycleId = nextCycleId;
    activePets = [];
  }
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalizePets(input) {
  if (!Array.isArray(input)) return [];
  const result = [];
  for (const value of input.slice(0, 20)) {
    const canonical = ALLOWED_PETS.get(normalizeName(value));
    if (canonical && !result.includes(canonical)) result.push(canonical);
  }
  return result;
}

function safeTokenMatch(headerValue) {
  const provided = String(headerValue || "").replace(/^Bearer\s+/i, "");
  const expectedBuffer = Buffer.from(INGEST_TOKEN);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function snapshot(type = "snapshot", addedPets = []) {
  refreshCycle();
  return {
    type,
    cycleId: activeCycleId,
    pets: [...activePets],
    addedPets,
    sentAt: new Date().toISOString()
  };
}

function broadcast(payload) {
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    if (!res.write(frame)) {
      // Node administra el backpressure; el próximo heartbeat/evento reintentará.
    }
  }
}

function handleStream(req, res) {
  refreshCycle();
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff"
  });
  res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);

  const heartbeat = setInterval(() => {
    if (res.destroyed) return;
    refreshCycle();
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    refreshCycle();
    return sendJson(res, 200, {
      ok: true,
      service: "SAE LIVE RADAR",
      connectedClients: clients.size,
      cycleId: activeCycleId
    });
  }

  if (req.method === "GET" && url.pathname === "/api/events/stream") {
    return handleStream(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/events") {
    if (!safeTokenMatch(req.headers.authorization)) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    try {
      const body = await readJsonBody(req);
      refreshCycle();
      const pets = canonicalizePets(body.pets || (body.name ? [body.name] : []));
      if (!pets.length) {
        return sendJson(res, 400, { error: "No se recibieron nombres de mascotas válidos." });
      }

      const addedPets = pets.filter(name => !activePets.includes(name));
      if (addedPets.length) {
        activePets = [...activePets, ...addedPets];
        broadcast(snapshot("spawn", addedPets));
      }

      return sendJson(res, 202, {
        accepted: true,
        duplicate: addedPets.length === 0,
        addedPets,
        pets: [...activePets],
        cycleId: activeCycleId
      });
    } catch (error) {
      if (error.message === "BODY_TOO_LARGE") {
        return sendJson(res, 413, { error: "Request too large" });
      }
      if (error.message === "INVALID_JSON") {
        return sendJson(res, 400, { error: "JSON inválido" });
      }
      console.error("Error procesando evento:", error.message);
      return sendJson(res, 500, { error: "Internal server error" });
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SAE LIVE RADAR relay escuchando en el puerto ${PORT}`);
});

function shutdown() {
  for (const res of clients) res.end();
  clients.clear();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
