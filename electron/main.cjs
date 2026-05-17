const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const isDev = !app.isPackaged;
const devUrl = "http://127.0.0.1:5173";
const petBaseSize = { width: 190, height: 190 };
const panelSize = { width: 480, height: 570 };
const settingsSize = { width: 430, height: 620 };

const defaultState = {
  dailyMitByDate: {},
  noteText: "",
  noteHtml: "",
  chatMessages: [],
  windowSettings: {
    panelWidth: panelSize.width,
    panelHeight: panelSize.height,
  },
  timerRuntime: {
    focus: null,
    break: null,
  },
  timerSettings: {
    focusMinutes: 25,
    breakMinutes: 5,
  },
  petSettings: {
    scale: 1,
    speed: 3,
  },
  llmSettings: {
    provider: "openai",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    apiFormat: "openai-chat",
  },
};

const llmPresets = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    apiFormat: "openai-chat",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    modelId: "deepseek-chat",
    apiFormat: "openai-chat",
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen-plus",
    apiFormat: "openai-chat",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    modelId: "openai/gpt-4o-mini",
    apiFormat: "openai-chat",
  },
  custom: {
    baseUrl: "",
    modelId: "",
    apiFormat: "openai-chat",
  },
};

let petWindow = null;
let panelWindow = null;
let settingsWindow = null;
let tray = null;
let panelPinned = false;
let panelBlurClosedAt = 0;
let isQuitting = false;
let moveTimer = null;
let dragTimer = null;
let fallTimer = null;
let dragWasMoving = false;
let petX = 80;
let petY = null;
let direction = 1;
let moving = true;
let petMode = "walking";
let basePetMode = "walking";
let behaviorMode = "walking";
let behaviorTimer = null;
let draggingPet = false;
const interactionModes = {
  setting: false,
  sleep: false,
  thinking: false,
};
let dragOffset = { x: 0, y: 0 };
let statePath = "";

function readState() {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    return mergeState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

function mergeState(value) {
  return {
    ...defaultState,
    ...value,
    timerSettings: {
      ...defaultState.timerSettings,
      ...(value && value.timerSettings),
    },
    petSettings: {
      ...defaultState.petSettings,
      ...(value && value.petSettings),
    },
    llmSettings: normalizeLlmSettings(value && value.llmSettings),
    timerRuntime: {
      ...defaultState.timerRuntime,
      ...(value && value.timerRuntime),
    },
    windowSettings: {
      ...defaultState.windowSettings,
      ...(value && value.windowSettings),
    },
  };
}

function normalizeLlmSettings(settings = {}) {
  const provider = settings.provider || "openai";
  const preset = llmPresets[provider] || llmPresets.openai;
  return {
    provider,
    apiKey: settings.apiKey || "",
    baseUrl: settings.baseUrl || preset.baseUrl,
    modelId: settings.modelId || preset.modelId,
    apiFormat: settings.apiFormat || preset.apiFormat,
  };
}

function getChatUrl(settings) {
  return `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function readStreamChunk(payload) {
  const choice = payload && payload.choices && payload.choices[0];
  if (!choice) {
    return "";
  }
  return (choice.delta && choice.delta.content) || choice.message?.content || "";
}

async function requestChatCompletion(settings, messages, onChunk) {
  const config = normalizeLlmSettings(settings);
  if (!config.apiKey.trim()) {
    throw new Error("请先填写 API Key");
  }
  if (!config.baseUrl.trim() || !config.modelId.trim()) {
    throw new Error("请补全 Base URL 和 Model ID");
  }

  const response = await fetch(getChatUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `模型请求失败：${response.status}`);
  }
  if (!response.body) {
    throw new Error("模型服务没有返回可读取的数据流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      const payload = JSON.parse(data);
      const chunk = readStreamChunk(payload);
      if (chunk) {
        onChunk(chunk);
      }
    }
  }
}

async function testChatCompletion(settings) {
  const config = normalizeLlmSettings(settings);
  if (!config.apiKey.trim()) {
    throw new Error("请先填写 API Key");
  }

  const response = await fetch(getChatUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: [{ role: "user", content: "ping" }],
      stream: false,
      max_tokens: 8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `测试失败：${response.status}`);
  }
}

function writeState(nextState) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2), "utf8");
}

function getRendererUrl(kind, params = {}) {
  const search = new URLSearchParams({ window: kind, ...params }).toString();
  if (isDev) {
    return `${devUrl}/?${search}`;
  }
  return `file://${path.join(__dirname, "../dist/index.html")}?${search}`;
}

function getIconPath(name) {
  return isDev ? path.join(__dirname, "../public/icons", name) : path.join(__dirname, "../dist/icons", name);
}

function getPetSize() {
  const state = readState();
  const scale = Math.max(0.6, Math.min(1.6, Number(state.petSettings.scale) || 1));
  return {
    width: Math.round(petBaseSize.width * scale),
    height: Math.round(petBaseSize.height * scale),
  };
}

function clampPetPosition(size) {
  const area = screen.getPrimaryDisplay().workArea;
  petX = Math.max(area.x, Math.min(petX, area.x + area.width - size.width));
  if (petY === null) {
    petY = area.y + area.height - size.height;
  }
  petY = Math.max(area.y, Math.min(petY, area.y + area.height - size.height));
}

function petBounds() {
  const size = getPetSize();
  clampPetPosition(size);
  return {
    x: Math.round(petX),
    y: Math.round(petY),
    ...size,
  };
}

function getInteractionMode() {
  if (interactionModes.setting) {
    return "setting";
  }
  if (interactionModes.sleep) {
    return "sleep";
  }
  if (interactionModes.thinking) {
    return "thinking";
  }
  return null;
}

function shouldMoveForMode(mode) {
  return mode === "walking" || mode === "running";
}

function sendPetViewState() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet-view-state", {
      direction,
      mode: petMode,
      moving,
    });
  }
}

function applyPetState() {
  const nextMode = getInteractionMode() || behaviorMode || basePetMode;
  petMode = nextMode;
  moving = !draggingPet && shouldMoveForMode(nextMode);
  sendPetViewState();
}

function clearBehaviorTimer() {
  if (behaviorTimer) {
    clearTimeout(behaviorTimer);
    behaviorTimer = null;
  }
}

function scheduleBehaviorSwitch(delay = 0) {
  clearBehaviorTimer();
  behaviorTimer = setTimeout(() => {
    if (draggingPet || getInteractionMode()) {
      scheduleBehaviorSwitch(900);
      return;
    }

    if (basePetMode === "break") {
      behaviorMode = Math.random() < 0.68 ? "running" : "eating";
      applyPetState();
      scheduleBehaviorSwitch(behaviorMode === "eating" ? 5600 : 4600);
      return;
    }

    if (basePetMode === "focus") {
      behaviorMode = Math.random() < 0.5 ? "squatting" : "upsideDown";
      applyPetState();
      scheduleBehaviorSwitch(5200);
      return;
    }

    behaviorMode = basePetMode;
    applyPetState();
  }, delay);
}

function setBasePetMode(nextMode) {
  basePetMode = nextMode;
  if (nextMode === "break") {
    behaviorMode = "running";
    scheduleBehaviorSwitch(4600);
  } else if (nextMode === "focus") {
    behaviorMode = Math.random() < 0.5 ? "squatting" : "upsideDown";
    scheduleBehaviorSwitch(5200);
  } else {
    clearBehaviorTimer();
    behaviorMode = nextMode;
  }
  applyPetState();
}

function setInteractionMode(mode) {
  if (mode in interactionModes) {
    interactionModes[mode] = true;
    applyPetState();
  }
}

function clearInteractionMode(mode) {
  const hadActiveInteraction = Object.values(interactionModes).some(Boolean);
  if (mode && mode in interactionModes) {
    interactionModes[mode] = false;
  } else {
    Object.keys(interactionModes).forEach((key) => {
      interactionModes[key] = false;
    });
  }
  if (hadActiveInteraction) {
    scheduleBehaviorSwitch(0);
  }
  applyPetState();
}

function stopPet(mode = "stand") {
  setBasePetMode(mode);
}

function movePetOnce() {
  if (!petWindow || petWindow.isDestroyed() || !moving) {
    return;
  }

  const state = readState();
  const bounds = petBounds();
  const area = screen.getPrimaryDisplay().workArea;
  const speed = Math.max(1, Math.min(12, Number(state.petSettings.speed) || 3));

  petX += direction * speed;

  if (petX <= area.x) {
    petX = area.x;
    direction = 1;
  }

  if (petX + bounds.width >= area.x + area.width) {
    petX = area.x + area.width - bounds.width;
    direction = -1;
  }

  const nextBounds = petBounds();
  petWindow.setBounds(nextBounds, false);
  sendPetViewState();
}

function restartPetMovement() {
  if (moveTimer) {
    clearInterval(moveTimer);
  }
  moveTimer = setInterval(movePetOnce, 33);
}

function getPopupBounds(size) {
  const area = screen.getPrimaryDisplay().workArea;
  const pet = petWindow && !petWindow.isDestroyed() ? petWindow.getBounds() : petBounds();
  const gap = 12;
  const rightX = pet.x + pet.width + gap;
  const leftX = pet.x - size.width - gap;
  const x = rightX + size.width <= area.x + area.width ? rightX : Math.max(area.x, leftX);
  const centerY = pet.y + pet.height / 2 - size.height / 2;
  const y = Math.max(area.y, Math.min(centerY, area.y + area.height - size.height));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: size.width,
    height: size.height,
  };
}

function getPanelSize() {
  const state = readState();
  return {
    width: Math.max(390, Math.round(Number(state.windowSettings.panelWidth) || panelSize.width)),
    height: Math.max(460, Math.round(Number(state.windowSettings.panelHeight) || panelSize.height)),
  };
}

function rememberPanelSize(bounds) {
  const current = readState();
  const nextState = mergeState({
    ...current,
    windowSettings: {
      ...current.windowSettings,
      panelWidth: bounds.width,
      panelHeight: bounds.height,
    },
  });
  writeState(nextState);
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    ...petBounds(),
    icon: getIconPath("mit.png"),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.loadURL(getRendererUrl("pet"));
  petWindow.webContents.once("did-finish-load", () => setBasePetMode("walking"));
  restartPetMovement();
}

function requestPanelChat() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("panel-open-chat");
  }
}

function createPanelWindow(options = {}) {
  panelPinned = false;
  const savedPanelSize = getPanelSize();
  panelWindow = new BrowserWindow({
    ...getPopupBounds(savedPanelSize),
    icon: getIconPath("mit.png"),
    minWidth: 390,
    minHeight: 460,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: true,
    show: false,
    alwaysOnTop: panelPinned,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  panelWindow.loadURL(getRendererUrl("panel", options.chat ? { chat: "1" } : {}));
  panelWindow.once("ready-to-show", () => {
    panelWindow.show();
    panelWindow.focus();
    if (options.chat) {
      requestPanelChat();
    }
  });
  panelWindow.on("resize", () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      rememberPanelSize(panelWindow.getBounds());
    }
  });
  panelWindow.on("blur", () => {
    if (!panelPinned && panelWindow && !panelWindow.isDestroyed()) {
      panelBlurClosedAt = Date.now();
      panelWindow.close();
    }
  });
  panelWindow.on("closed", () => {
    panelWindow = null;
    panelPinned = false;
    clearInteractionMode();
  });
}

function createSettingsWindow() {
  setInteractionMode("setting");
  settingsWindow = new BrowserWindow({
    ...getPopupBounds(settingsSize),
    icon: getIconPath("mit.png"),
    minWidth: 380,
    minHeight: 520,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadURL(getRendererUrl("settings"));
  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  settingsWindow.on("blur", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
    clearInteractionMode("setting");
  });
}

function openPanel(options = {}) {
  stopPet();
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.setBounds(getPopupBounds(getPanelSize()), false);
    panelWindow.show();
    panelWindow.focus();
    if (options.chat) {
      requestPanelChat();
    }
    return;
  }
  createPanelWindow(options);
}

function togglePanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    return;
  }
  if (Date.now() - panelBlurClosedAt < 350) {
    return;
  }
  openPanel();
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function pauseRunningTimersBeforeQuit() {
  const state = readState();
  const timerRuntime = { ...state.timerRuntime };

  for (const key of ["focus", "break"]) {
    const runtime = timerRuntime[key];
    if (!runtime || !runtime.startedAt) {
      continue;
    }
    const elapsed = Math.floor((Date.now() - runtime.startedAt) / 1000);
    const remainingSeconds = Math.max(0, runtime.remainingSeconds - elapsed);
    timerRuntime[key] = remainingSeconds > 0 ? { remainingSeconds, startedAt: null } : null;
  }

  writeState(mergeState({ ...state, timerRuntime }));
}

function createTray() {
  if (tray) {
    return;
  }

  const iconPath = getIconPath("nose.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("桌面宠物");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开/关闭浮窗", click: () => togglePanel() },
      { type: "separator" },
      { label: "退出桌面宠物", click: () => quitApp() },
    ]),
  );
  tray.on("click", () => togglePanel());
}

function openSettings() {
  setInteractionMode("setting");
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setBounds(getPopupBounds(settingsSize), false);
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  createSettingsWindow();
}

function startDrag() {
  if (!petWindow || petWindow.isDestroyed()) {
    draggingPet = false;
    return;
  }
  if (fallTimer) {
    clearInterval(fallTimer);
    fallTimer = null;
  }
  draggingPet = true;
  dragWasMoving = moving;
  moving = false;
  const cursor = screen.getCursorScreenPoint();
  const bounds = petWindow.getBounds();
  dragOffset = {
    x: cursor.x - bounds.x,
    y: cursor.y - bounds.y,
  };

  if (dragTimer) {
    clearInterval(dragTimer);
  }

  dragTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      return;
    }
    const point = screen.getCursorScreenPoint();
    const size = getPetSize();
    petX = point.x - dragOffset.x;
    petY = point.y - dragOffset.y;
    clampPetPosition(size);
    petWindow.setBounds(petBounds(), false);
  }, 16);
}

function stopDrag() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (!petWindow || petWindow.isDestroyed()) {
    draggingPet = false;
    return;
  }

  const area = screen.getPrimaryDisplay().workArea;
  const size = getPetSize();
  const targetY = area.y + area.height - size.height;

  if (fallTimer) {
    clearInterval(fallTimer);
  }

  fallTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      clearInterval(fallTimer);
      fallTimer = null;
      draggingPet = false;
      return;
    }

    const delta = targetY - petY;
    if (Math.abs(delta) <= 1) {
      petY = targetY;
      clampPetPosition(size);
      petWindow.setBounds(petBounds(), false);
      clearInterval(fallTimer);
      fallTimer = null;
      moving = dragWasMoving;
      draggingPet = false;
      applyPetState();
      return;
    }

    petY += Math.max(1, Math.abs(delta) * 0.16) * Math.sign(delta);
    clampPetPosition(size);
    petWindow.setBounds(petBounds(), false);
  }, 16);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.carrott.desktop-pet");
  statePath = path.join(app.getPath("userData"), "state.json");
  if (!fs.existsSync(statePath)) {
    writeState(defaultState);
  }

  createPetWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on("window-all-closed", (event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  pauseRunningTimersBeforeQuit();
  if (moveTimer) {
    clearInterval(moveTimer);
  }
  stopDrag();
  if (fallTimer) {
    clearInterval(fallTimer);
  }
  clearBehaviorTimer();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("will-quit", () => {
  pauseRunningTimersBeforeQuit();
});

ipcMain.handle("state:get", () => readState());

ipcMain.handle("state:save", (_event, partialState) => {
  const nextState = mergeState({
    ...readState(),
    ...partialState,
  });
  writeState(nextState);
  return nextState;
});

ipcMain.handle("pet:set-settings", (_event, settings) => {
  const current = readState();
  const nextState = mergeState({
    ...current,
    petSettings: {
      ...current.petSettings,
      ...settings,
    },
  });
  writeState(nextState);
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setBounds(petBounds(), false);
  }
  return nextState;
});

ipcMain.handle("pet:set-mode", (_event, mode) => {
  if (mode === "setting" || mode === "sleep" || mode === "thinking") {
    setInteractionMode(mode);
    return;
  }
  setBasePetMode(mode);
});

ipcMain.handle("pet:restore-mode", (_event, mode) => {
  clearInteractionMode(mode);
});

ipcMain.handle("pet:drag-start", () => startDrag());
ipcMain.handle("pet:drag-end", () => stopDrag());
ipcMain.handle("panel:open", (_event, options) => openPanel(options));
ipcMain.handle("panel:toggle", () => togglePanel());
ipcMain.handle("settings:open", () => openSettings());

ipcMain.handle("llm:test", async (_event, settings) => {
  try {
    await testChatCompletion(settings);
    return { ok: true, message: "连接成功" };
  } catch (error) {
    return { ok: false, message: error.message || "连接失败" };
  }
});

ipcMain.handle("llm:chat-stream", async (event, payload) => {
  const sender = event.sender;
  const requestId = payload && payload.requestId;
  const messages = (payload && payload.messages) || [];
  const settings = payload && payload.settings;

  if (!requestId) {
    return { ok: false, error: "缺少请求 ID" };
  }

  requestChatCompletion(settings, messages, (content) => {
    if (!sender.isDestroyed()) {
      sender.send("llm:chat-event", { requestId, type: "chunk", content });
    }
  })
    .then(() => {
      if (!sender.isDestroyed()) {
        sender.send("llm:chat-event", { requestId, type: "done" });
      }
    })
    .catch((error) => {
      if (!sender.isDestroyed()) {
        sender.send("llm:chat-event", {
          requestId,
          type: "error",
          message: error.message || "模型调用失败",
        });
      }
    });

  return { ok: true };
});

ipcMain.handle("window:action", (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return;
  }

  if (action === "fullscreen") {
    win.setFullScreen(!win.isFullScreen());
  }

  if (action === "minimize") {
    win.minimize();
  }

  if (action === "close") {
    win.close();
  }

  if (action === "toggle-pin") {
    if (win === panelWindow) {
      panelPinned = !panelPinned;
      win.setAlwaysOnTop(panelPinned, "floating");
      return { pinned: panelPinned };
    }
    const nextPinned = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(nextPinned, "floating");
    return { pinned: nextPinned };
  }
});
