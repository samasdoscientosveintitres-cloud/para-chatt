const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const http = require("node:http");

let mainWindow;
let apiServer;

const ROBLOX_GAME_URL =
  "roblox://experiences/start?placeId=107778070777162";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#090d18",
    title: "SAE Live Radar",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// Abre directamente la experiencia en el cliente de Roblox.
ipcMain.handle("sae:open-roblox", async () => {
  try {
    await shell.openExternal(ROBLOX_GAME_URL);
    return { success: true };
  } catch (error) {
    console.error("Error abriendo Roblox:", error);
    return { success: false };
  }
});

function startLocalApi() {
  apiServer = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sae-key");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    if (req.method !== "POST" || req.url !== "/api/detection") {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: "Not found" }));
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 100_000) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const event = JSON.parse(body || "{}");

        if (!event.name || typeof event.name !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Se requiere un nombre válido" }));
        }

        mainWindow?.webContents.send("sae:detection", event);

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "JSON inválido" }));
      }
    });
  });

  // Solo escucha en localhost; no expone el equipo a Internet.
  apiServer.listen(4317, "127.0.0.1");
}

app.whenReady().then(() => {
  createWindow();
  startLocalApi();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => apiServer?.close());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});