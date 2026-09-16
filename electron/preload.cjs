const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("phrase", {
  load: () => ipcRenderer.invoke("phrase:load"),
  save: (json) => ipcRenderer.invoke("phrase:save", json),
});
