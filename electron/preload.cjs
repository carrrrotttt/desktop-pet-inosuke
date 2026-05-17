const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  getState: () => ipcRenderer.invoke("state:get"),
  saveState: (partialState) => ipcRenderer.invoke("state:save", partialState),
  setPetSettings: (settings) => ipcRenderer.invoke("pet:set-settings", settings),
  setPetMode: (mode) => ipcRenderer.invoke("pet:set-mode", mode),
  restorePetMode: (mode) => ipcRenderer.invoke("pet:restore-mode", mode),
  startPetDrag: () => ipcRenderer.invoke("pet:drag-start"),
  endPetDrag: () => ipcRenderer.invoke("pet:drag-end"),
  windowAction: (action) => ipcRenderer.invoke("window:action", action),
  openPanel: (options) => ipcRenderer.invoke("panel:open", options),
  togglePanel: () => ipcRenderer.invoke("panel:toggle"),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  streamChat: (payload) => ipcRenderer.invoke("llm:chat-stream", payload),
  testLlmSettings: (settings) => ipcRenderer.invoke("llm:test", settings),
});

contextBridge.exposeInMainWorld("desktopPetEvents", {
  onViewStateChange: (callback) => {
    const listener = (_event, viewState) => callback(viewState);
    ipcRenderer.on("pet-view-state", listener);
    return () => ipcRenderer.removeListener("pet-view-state", listener);
  },
  onChatStream: (callback) => {
    const listener = (_event, streamEvent) => callback(streamEvent);
    ipcRenderer.on("llm:chat-event", listener);
    return () => ipcRenderer.removeListener("llm:chat-event", listener);
  },
  onOpenChat: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("panel-open-chat", listener);
    return () => ipcRenderer.removeListener("panel-open-chat", listener);
  },
});
