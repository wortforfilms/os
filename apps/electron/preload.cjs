const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("maataaDesktop", {
  runtimeInfo: () => ipcRenderer.invoke("maataa:runtime-info"),
  authLogin: (payload) => ipcRenderer.invoke("maataa:auth-login", payload),
  authSignup: (payload) => ipcRenderer.invoke("maataa:auth-signup", payload),
  authCurrentSession: (sessionId) => ipcRenderer.invoke("maataa:auth-current", sessionId),
  authLogout: (sessionId) => ipcRenderer.invoke("maataa:auth-logout", sessionId),
  adminSummary: (sessionId) => ipcRenderer.invoke("maataa:admin-summary", sessionId),
  runtimeEventsSince: (cursor) => ipcRenderer.invoke("maataa:runtime-events-since", cursor),
});
