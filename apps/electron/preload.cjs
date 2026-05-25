const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("maataaDesktop", {
  runtimeInfo: () => ipcRenderer.invoke("maataa:runtime-info"),
});
