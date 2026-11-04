const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("saeRadar", {
  onDetection: (callback) => {
    const handler = (_event, data) => callback(data);

    ipcRenderer.on("sae:detection", handler);

    return () => {
      ipcRenderer.removeListener("sae:detection", handler);
    };
  },

  openGame: () => ipcRenderer.invoke("sae:open-roblox")
});