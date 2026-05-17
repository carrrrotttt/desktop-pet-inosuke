import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bold, CheckSquare, MessageCircle, Pause, Pin, Play, RotateCcw, Settings, X } from "lucide-react";
import "./styles.css";

const llmPresets: Record<LlmProvider, Pick<LlmSettings, "baseUrl" | "modelId" | "apiFormat">> = {
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
  hunyuan: {
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    modelId: "hunyuan-turbos-latest",
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

const defaultState: AppState = {
  dailyMitByDate: {},
  noteText: "",
  noteHtml: "",
  chatMessages: [],
  windowSettings: {
    panelWidth: 480,
    panelHeight: 570,
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
    ...llmPresets.openai,
  },
};

const previewApi: DesktopPetApi = {
  getState: async () => {
    const saved = window.localStorage.getItem("desktop-pet-preview-state");
    return saved ? mergeState(JSON.parse(saved)) : defaultState;
  },
  saveState: async (partialState) => {
    const current = await previewApi.getState();
    const next = mergeState({ ...current, ...partialState });
    window.localStorage.setItem("desktop-pet-preview-state", JSON.stringify(next));
    return next;
  },
  setPetSettings: async (settings) => previewApi.saveState({ petSettings: settings }),
  setPetMode: async () => undefined,
  restorePetMode: async () => undefined,
  startPetDrag: async () => undefined,
  endPetDrag: async () => undefined,
  windowAction: async () => undefined,
  openPanel: async () => undefined,
  togglePanel: async () => undefined,
  openSettings: async () => undefined,
  streamChat: async () => ({ ok: false, error: "预览模式暂不调用模型" }),
  testLlmSettings: async () => ({ ok: false, message: "预览模式暂不测试连接" }),
};

const desktopPetApi = window.desktopPet ?? previewApi;
const desktopPetEvents = window.desktopPetEvents ?? {
  onViewStateChange: () => () => undefined,
  onChatStream: () => () => undefined,
  onOpenChat: () => () => undefined,
};

function makeFrames(folder: string, count: number) {
  return Array.from({ length: count }, (_, index) => assetPath(`pet/${folder}/${index + 1}.png`));
}

function assetPath(path: string) {
  return new URL(`./${path}`, window.location.href).toString();
}

const petFrames: Partial<Record<PetMode, string[]>> = {
  walking: makeFrames("running", 16),
  running: makeFrames("running", 16),
  eating: makeFrames("eating", 24),
  sleep: makeFrames("sleeping", 24),
  setting: makeFrames("set", 21),
  thinking: makeFrames("thinking", 24),
  squatting: makeFrames("squatting", 24),
  upsideDown: makeFrames("upside-down", 27),
};

const frameDelayByMode: Partial<Record<PetMode, number>> = {
  walking: 62,
  running: 45,
  eating: 160,
  sleep: 220,
  setting: 170,
  thinking: 170,
  squatting: 165,
  upsideDown: 105,
};

const petPersonaPrompt = [
  "你是嘴平伊之助风格的桌面宠物猪猪：山里长大、戴野猪头套、野性直觉强、好胜、急性子、说话直来直去。",
  "你有伊之助式的战斗脑回路：把难题当成猎物，把推进任务当成冲上山路；常用短促、有冲劲的表达。",
  "你也有角色后期的成长感：不是只会吵闹，会在关键时刻保护同伴、承认事实、学着配合。",
  "闲聊、鼓励、任务陪伴时，可以体现猪突猛进、不服输、容易兴奋、偶尔叫错词但很认真。",
  "回答具体问题、专业问题、事实问题时，优先按照大模型能力给出准确、专业、可执行的答案，不要为了人设胡扯。",
  "不确定时直接说不确定，并给出可验证的下一步。",
  "回复使用简体中文，短句优先，每次 1 到 4 句。",
  "可以自称伊之助或猪猪，但不要编造剧情、台词或事实。",
].join("\n");

function mergeState(value: Partial<AppState>): AppState {
  return {
    ...defaultState,
    ...value,
    timerSettings: {
      ...defaultState.timerSettings,
      ...(value.timerSettings ?? {}),
    },
    petSettings: {
      ...defaultState.petSettings,
      ...(value.petSettings ?? {}),
    },
    llmSettings: {
      ...defaultState.llmSettings,
      ...(value.llmSettings ?? {}),
    },
    chatMessages: value.chatMessages ?? defaultState.chatMessages,
    timerRuntime: {
      ...defaultState.timerRuntime,
      ...(value.timerRuntime ?? {}),
    },
    windowSettings: {
      ...defaultState.windowSettings,
      ...(value.windowSettings ?? {}),
    },
  };
}

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function createId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function getRuntimeSeconds(runtime: TimerRuntime | null, durationSeconds: number) {
  if (!runtime) {
    return durationSeconds;
  }
  if (!runtime.startedAt) {
    return Math.max(0, runtime.remainingSeconds);
  }
  const elapsed = Math.floor((Date.now() - runtime.startedAt) / 1000);
  return Math.max(0, runtime.remainingSeconds - elapsed);
}

function useCountdown(
  key: TimerKey,
  minutes: number,
  timerRuntime: AppState["timerRuntime"],
  updateState: (partial: Partial<AppState>) => void,
) {
  const runtime = timerRuntime[key];
  const durationSeconds = minutes * 60;
  const [seconds, setSeconds] = useState(() => getRuntimeSeconds(runtime, durationSeconds));
  const running = Boolean(runtime?.startedAt);

  function commitTimerRuntime(nextTimerRuntime: AppState["timerRuntime"]) {
    updateState({ timerRuntime: nextTimerRuntime });
    desktopPetApi.saveState({ timerRuntime: nextTimerRuntime });
  }

  useEffect(() => {
    const nextSeconds = getRuntimeSeconds(runtime, durationSeconds);
    setSeconds(nextSeconds);
    if (runtime?.startedAt && nextSeconds <= 0) {
      updateState({
        timerRuntime: {
          ...timerRuntime,
          [key]: null,
        },
      });
      desktopPetApi.setPetMode("stand");
    }
  }, [durationSeconds, key, runtime, updateState]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextSeconds = getRuntimeSeconds(runtime, durationSeconds);
      setSeconds(nextSeconds);
      if (nextSeconds <= 0) {
        updateState({
          timerRuntime: {
            ...timerRuntime,
            [key]: null,
          },
        });
        desktopPetApi.setPetMode("stand");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [durationSeconds, key, running, runtime, updateState]);

  function updateRuntime(nextRuntime: TimerRuntime | null) {
    commitTimerRuntime({
      ...timerRuntime,
      [key]: nextRuntime,
    });
  }

  function start() {
    const otherKey: TimerKey = key === "focus" ? "break" : "focus";
    const otherRuntime = timerRuntime[otherKey];
    const nextRuntime = { remainingSeconds: seconds || durationSeconds, startedAt: Date.now() };
    const pausedOtherRuntime = otherRuntime?.startedAt
      ? {
          remainingSeconds: getRuntimeSeconds(otherRuntime, 1),
          startedAt: null,
        }
      : otherRuntime;

    commitTimerRuntime({
      ...timerRuntime,
      [key]: nextRuntime,
      [otherKey]: pausedOtherRuntime,
    });
  }

  return {
    seconds,
    running,
    start,
    pause: () => updateRuntime({ remainingSeconds: seconds, startedAt: null }),
    reset: () => {
      setSeconds(durationSeconds);
      updateRuntime(null);
    },
  };
}

function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function MacControls({
  showPin = false,
  pinned = false,
  onPinnedChange,
}: {
  showPin?: boolean;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
}) {
  async function togglePin() {
    const result = await desktopPetApi.windowAction("toggle-pin");
    if (result && "pinned" in result) {
      onPinnedChange?.(Boolean(result.pinned));
    }
  }

  return (
    <div className="mac-controls">
      <button className="traffic traffic-close" title="关闭" aria-label="关闭" onClick={() => desktopPetApi.windowAction("close")}>
        <X size={14} />
      </button>
      {showPin && (
        <button
          className={`traffic traffic-pin ${pinned ? "pinned" : ""}`}
          title={pinned ? "取消固定在最前" : "固定在最前"}
          aria-label={pinned ? "取消固定在最前" : "固定在最前"}
          onClick={togglePin}
        >
          <Pin size={10} />
        </button>
      )}
    </div>
  );
}

function PetView() {
  const [frame, setFrame] = useState(0);
  const [viewState, setViewState] = useState<PetViewState>({
    direction: 1,
    mode: "walking",
    moving: true,
  });
  const dragStart = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const didDrag = useRef(false);

  useEffect(() => {
    setFrame(0);
    const frameDelay = frameDelayByMode[viewState.mode] ?? 220;
    const frameTimer = window.setInterval(() => {
      setFrame((value) => (value + 1) % 120);
    }, frameDelay);

    return () => window.clearInterval(frameTimer);
  }, [viewState.mode]);

  useEffect(() => {
    return desktopPetEvents.onViewStateChange((nextViewState) => {
      setViewState(nextViewState);
    });
  }, []);

  function getPetImage() {
    const frames = petFrames[viewState.mode];
    if (frames) {
      return frames[frame % frames.length];
    }
    if (viewState.mode === "focus") {
      const fallbackFrames = petFrames.squatting;
      return fallbackFrames ? fallbackFrames[frame % fallbackFrames.length] : assetPath("pet/bow.png");
    }
    if (viewState.mode === "break") {
      const fallbackFrames = petFrames.running;
      return fallbackFrames ? fallbackFrames[frame % fallbackFrames.length] : assetPath("pet/run1.png");
    }
    if (viewState.mode === "stand") {
      return assetPath("pet/stand.png");
    }
    return frame === 0 ? assetPath("pet/stand.png") : assetPath("pet/run1.png");
  }

  function handleRightClick() {
    desktopPetApi.togglePanel();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button === 2) {
      event.preventDefault();
      return;
    }

    if (event.button !== 0) {
      return;
    }

    dragStart.current = { x: event.screenX, y: event.screenY };
    dragging.current = true;
    didDrag.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    desktopPetApi.startPetDrag();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) {
      return;
    }
    const moved = Math.abs(event.screenX - dragStart.current.x) + Math.abs(event.screenY - dragStart.current.y);
    if (moved > 5) {
      didDrag.current = true;
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }
    dragging.current = false;
    desktopPetApi.endPetDrag();
  }

  function handleClick() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    desktopPetApi.setPetMode("stand");
  }

  return (
    <button
      className="pet-shell"
      onClick={handleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        handleRightClick();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => desktopPetApi.endPetDrag()}
    >
      <img
        className="pet-image"
        style={{ transform: viewState.direction === 1 ? "scaleX(-1)" : "scaleX(1)" }}
        src={getPetImage()}
        alt=""
        draggable={false}
      />
    </button>
  );
}

function TimerCard({
  title,
  icon,
  timer,
  mode,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  timer: ReturnType<typeof useCountdown>;
  mode: PetMode;
  tone: "blue" | "pink";
}) {
  function toggle() {
    if (timer.running) {
      timer.pause();
      desktopPetApi.setPetMode("stand");
      return;
    }
    timer.start();
    desktopPetApi.setPetMode(mode);
  }

  function reset() {
    timer.reset();
    desktopPetApi.setPetMode("stand");
  }

  return (
    <section className={`timer-card ${tone}`}>
      <div className="timer-title">
        <span className="timer-icon">{icon}</span>
        {title}
      </div>
      <div className="timer-value">{formatSeconds(timer.seconds)}</div>
      <div className="timer-actions">
        <IconButton label={timer.running ? "暂停" : "开始"} onClick={toggle} className="primary-timer-action">
          {timer.running ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>
        <IconButton label="重置" onClick={reset}>
          <RotateCcw size={18} />
        </IconButton>
      </div>
    </section>
  );
}

function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const stateRef = useRef(defaultState);
  const readyRef = useRef(false);

  useEffect(() => {
    desktopPetApi.getState().then((nextState) => {
      setState(mergeState(nextState));
      setReady(true);
      readyRef.current = true;
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    function flushState() {
      if (readyRef.current) {
        desktopPetApi.saveState(stateRef.current);
      }
    }

    window.addEventListener("beforeunload", flushState);
    return () => {
      window.removeEventListener("beforeunload", flushState);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      if (readyRef.current) {
        desktopPetApi.saveState(stateRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      desktopPetApi.saveState(state);
    }, 250);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [ready, state]);

  function updateState(partial: Partial<AppState>) {
    setState((current) => mergeState({ ...current, ...partial }));
  }

  function updatePetSettings(settings: AppState["petSettings"]) {
    updateState({ petSettings: settings });
    desktopPetApi.setPetSettings(settings);
  }

  return { state, updateState, updatePetSettings };
}

function SettingsPopover({
  state,
  updateState,
  updatePetSettings,
  onClose,
}: {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
  updatePetSettings: (settings: AppState["petSettings"]) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    window.setTimeout(() => document.addEventListener("pointerdown", handlePointerDown), 0);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  function updateTimerSettings(partial: Partial<AppState["timerSettings"]>) {
    updateState({
      timerSettings: {
        ...state.timerSettings,
        ...partial,
      },
    });
  }

  function updateLlmSettings(partial: Partial<LlmSettings>) {
    updateState({
      llmSettings: {
        ...state.llmSettings,
        ...partial,
      },
    });
  }

  function changeProvider(provider: LlmProvider) {
    updateState({
      llmSettings: {
        ...state.llmSettings,
        provider,
        ...llmPresets[provider],
      },
    });
  }

  async function testConnection() {
    setTestStatus("测试中...");
    const result = await desktopPetApi.testLlmSettings(state.llmSettings);
    setTestStatus(result.message);
  }

  function clearChatMessages() {
    updateState({ chatMessages: [] });
  }

  return (
    <div className="settings-popover" ref={popoverRef}>
      <label>
        <span>猪猪大小</span>
        <input
          type="range"
          min="0.6"
          max="1.6"
          step="0.1"
          value={state.petSettings.scale}
          onChange={(event) =>
            updatePetSettings({
              ...state.petSettings,
              scale: Number(event.target.value),
            })
          }
        />
      </label>
      <label>
        <span>奔跑速度</span>
        <input
          type="range"
          min="1"
          max="12"
          step="1"
          value={state.petSettings.speed}
          onChange={(event) =>
            updatePetSettings({
              ...state.petSettings,
              speed: Number(event.target.value),
            })
          }
        />
      </label>
      <div className="setting-grid">
        <label>
          <span>番茄钟</span>
          <input
            type="number"
            min="1"
            max="180"
            value={state.timerSettings.focusMinutes}
            onChange={(event) => updateTimerSettings({ focusMinutes: Number(event.target.value) || 1 })}
          />
        </label>
        <label>
          <span>休息钟</span>
          <input
            type="number"
            min="1"
            max="60"
            value={state.timerSettings.breakMinutes}
            onChange={(event) => updateTimerSettings({ breakMinutes: Number(event.target.value) || 1 })}
          />
        </label>
      </div>

      <section className="settings-group">
        <strong>模型调用</strong>
        <label>
          <span>服务商</span>
          <select value={state.llmSettings.provider} onChange={(event) => changeProvider(event.target.value as LlmProvider)}>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">千问</option>
            <option value="hunyuan">混元</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label>
          <span>API Key</span>
          <input
            type="password"
            value={state.llmSettings.apiKey}
            placeholder="必填"
            onChange={(event) => updateLlmSettings({ apiKey: event.target.value })}
          />
        </label>
        <label>
          <span>Base URL</span>
          <input value={state.llmSettings.baseUrl} onChange={(event) => updateLlmSettings({ baseUrl: event.target.value })} />
        </label>
        <label>
          <span>Model ID</span>
          <input value={state.llmSettings.modelId} onChange={(event) => updateLlmSettings({ modelId: event.target.value })} />
        </label>
        <label>
          <span>接口格式</span>
          <select value={state.llmSettings.apiFormat} onChange={(event) => updateLlmSettings({ apiFormat: event.target.value as LlmApiFormat })}>
            <option value="openai-chat">OpenAI Chat Completions</option>
          </select>
        </label>
        <div className="setting-test-row">
          <button onClick={testConnection}>测试连接</button>
          <span>{testStatus}</span>
        </div>
      </section>

      <section className="settings-group">
        <strong>聊天记录</strong>
        <div className="setting-action-row">
          <button className="setting-danger-button" onClick={clearChatMessages}>
            清除当前聊天记录
          </button>
          <span>只清除对话，不影响模型配置。</span>
        </div>
      </section>
    </div>
  );
}

function chatGreeting(mitText: string) {
  const target = mitText.trim() || "MIT";
  return `俺在！今天的猎物是「${target}」，先盯住它，别被杂事撞飞。`;
}

function withMessageIds(messages: ChatMessage[]) {
  return messages.map((item) => ({ ...item, id: createId() }));
}

function stripMessageIds(messages: Array<ChatMessage & { id: string }>): ChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

function ChatView({
  settings,
  mitText,
  storedMessages,
  onMessagesChange,
}: {
  settings: LlmSettings;
  mitText: string;
  storedMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(() =>
    storedMessages.length ? withMessageIds(storedMessages) : [{ id: "hello", role: "assistant", content: chatGreeting(mitText) }],
  );
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeRequest = useRef("");
  const activeAssistantId = useRef("");

  function commitMessages(updater: (current: Array<ChatMessage & { id: string }>) => Array<ChatMessage & { id: string }>) {
    setMessages((current) => {
      const next = updater(current);
      onMessagesChange(stripMessageIds(next));
      return next;
    });
  }

  useEffect(() => {
    setMessages((current) => {
      if (!current.length || current[0].role !== "assistant") {
        return current;
      }
      const greeting = chatGreeting(mitText);
      if (current[0].content === greeting) {
        return current;
      }
      const next = [{ ...current[0], content: greeting }, ...current.slice(1)];
      onMessagesChange(stripMessageIds(next));
      return next;
    });
  }, [mitText]);

  useEffect(() => {
    return desktopPetEvents.onChatStream((event) => {
      if (event.requestId !== activeRequest.current) {
        return;
      }
      if (event.type === "chunk") {
        commitMessages((current) =>
          current.map((item) =>
            item.id === activeAssistantId.current ? { ...item, content: `${item.content}${event.content}` } : item,
          ),
        );
      }
      if (event.type === "done") {
        setSending(false);
      }
      if (event.type === "error") {
        setSending(false);
        commitMessages((current) =>
          current.map((item) =>
            item.id === activeAssistantId.current ? { ...item, content: event.message } : item,
          ),
        );
      }
    });
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const maxHeight = 78;
    input.style.height = "34px";
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  useEffect(() => {
    const list = messagesRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage() {
    const content = message.trim();
    if (!content || sending) {
      return;
    }
    if (!settings.apiKey.trim()) {
      commitMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: "先把 API Key 填上！不然俺只能原地嗷嗷，冲不出去。" },
      ]);
      return;
    }

    const requestId = createId();
    const assistantId = createId();
    const userMessage = { id: createId(), role: "user" as const, content };
    const assistantMessage = { id: assistantId, role: "assistant" as const, content: "" };
    const nextMessages = [...messages, userMessage];

    activeRequest.current = requestId;
    activeAssistantId.current = assistantId;
    setMessage("");
    setSending(true);
    commitMessages(() => [...nextMessages, assistantMessage]);

    const result = await desktopPetApi.streamChat({
      requestId,
      settings,
      messages: [
        { role: "system", content: petPersonaPrompt },
        ...nextMessages.map(({ role, content }) => ({ role, content })),
      ],
    });

    if (!result.ok) {
      setSending(false);
      commitMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: result.error || "发送失败" } : item)),
      );
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="chat-view">
      <div className="chat-messages" ref={messagesRef}>
        {messages.map((item) => (
          <div key={item.id} className={`chat-bubble ${item.role === "user" ? "user-message" : "pet-message"}`}>
            {item.content || (sending && item.id === activeAssistantId.current ? "..." : "")}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          value={message}
          rows={1}
          placeholder="把要冲的事告诉俺"
          onKeyDown={handleKeyDown}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button disabled={sending} onClick={sendMessage}>
          {sending ? "..." : "发送"}
        </button>
      </div>
    </section>
  );
}

function NoteEditor({
  state,
  updateState,
  onThink,
}: {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
  onThink: () => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectedRange = useRef<Range | null>(null);
  const [toolbar, setToolbar] = useState<{ left: number; top: number } | null>(null);
  const initialHtml = state.noteHtml || textToHtml(state.noteText);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) {
      return;
    }
    if (editor.innerHTML !== initialHtml) {
      editor.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  function saveEditor() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onThink();
    updateState({
      noteHtml: editor.innerHTML,
      noteText: editor.innerText,
    });
  }

  function refreshToolbar() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      selectedRange.current = null;
      setToolbar(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    if (!editor.contains(node.nodeType === Node.TEXT_NODE ? node.parentElement : node)) {
      selectedRange.current = null;
      setToolbar(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const parentRect = editor.parentElement?.getBoundingClientRect();
    if (!parentRect) {
      return;
    }
    selectedRange.current = range.cloneRange();
    setToolbar({
      left: Math.max(10, Math.min(rect.left - parentRect.left, parentRect.width - 210)),
      top: Math.max(8, rect.top - parentRect.top - 42),
    });
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const range = selectedRange.current;
    const selection = window.getSelection();
    if (!editor || !range || !selection) {
      return false;
    }
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function runCommand(command: string, value?: string) {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    saveEditor();
    refreshToolbar();
  }

  function topLevelEditorNode(editor: HTMLDivElement, node: Node): ChildNode | null {
    let current: Node | null = node;
    while (current && current.parentNode !== editor) {
      current = current.parentNode;
    }
    return current && current.parentNode === editor ? (current as ChildNode) : null;
  }

  function insertTodo() {
    const editor = editorRef.current;
    if (!editor || !restoreSelection()) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const label = document.createElement("label");
    label.className = "note-todo";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    label.append(checkbox, " ");

    const startElement = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as Element);
    const block = startElement?.closest("p,div,li");

    if (block && block !== editor && editor.contains(block)) {
      if (block.classList.contains("note-todo")) {
        return;
      }
      while (block.firstChild) {
        label.appendChild(block.firstChild);
      }
      block.appendChild(label);
      saveEditor();
      refreshToolbar();
      return;
    }

    let first = topLevelEditorNode(editor, range.startContainer);
    let last = topLevelEditorNode(editor, range.endContainer);
    if (!first || !last) {
      return;
    }
    while (first.previousSibling && first.previousSibling.nodeName !== "BR") {
      first = first.previousSibling;
    }
    while (last.nextSibling && last.nextSibling.nodeName !== "BR") {
      last = last.nextSibling;
    }
    editor.insertBefore(label, first);
    let current: ChildNode | null = first;
    while (current) {
      const next: ChildNode | null = current.nextSibling;
      label.appendChild(current);
      if (current === last) {
        break;
      }
      current = next;
    }
    saveEditor();
    refreshToolbar();

  }

  return (
    <>
      {toolbar && (
        <div className="note-toolbar" style={{ left: toolbar.left, top: toolbar.top }}>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
            <Bold size={14} />
          </button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={insertTodo}>
            <CheckSquare size={14} />
          </button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("fontSize", "2")}>
            小
          </button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("fontSize", "3")}>
            中
          </button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("fontSize", "5")}>
            大
          </button>
        </div>
      )}
      <div
        ref={editorRef}
        className="note-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="把脑袋里的杂草丢这儿，俺帮你盯着。"
        onInput={saveEditor}
        onKeyUp={refreshToolbar}
        onMouseUp={refreshToolbar}
        onBlur={() => window.setTimeout(() => setToolbar(null), 120)}
      />
    </>
  );
}

function PanelView() {
  const { state, updateState, updatePetSettings } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => new URLSearchParams(window.location.search).get("chat") === "1");
  const [panelPinned, setPanelPinned] = useState(false);
  const dateKey = useMemo(() => todayKey(), []);
  const focusTimer = useCountdown("focus", state.timerSettings.focusMinutes, state.timerRuntime, updateState);
  const breakTimer = useCountdown("break", state.timerSettings.breakMinutes, state.timerRuntime, updateState);
  const chatOpened = useRef(false);
  const settingsOpened = useRef(false);
  const chatOpenRef = useRef(chatOpen);
  const settingsOpenRef = useRef(settingsOpen);
  const thinkingTimer = useRef<number | null>(null);

  useEffect(() => {
    return desktopPetEvents.onOpenChat(() => {
      setChatOpen(true);
    });
  }, []);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      chatOpened.current = true;
      desktopPetApi.setPetMode("sleep");
      return;
    }
    if (chatOpened.current) {
      desktopPetApi.restorePetMode("sleep");
    }
  }, [chatOpen]);

  useEffect(() => {
    if (state.timerRuntime.focus?.startedAt) {
      desktopPetApi.setPetMode("focus");
      return;
    }
    if (state.timerRuntime.break?.startedAt) {
      desktopPetApi.setPetMode("break");
      return;
    }
    if (!chatOpenRef.current && !settingsOpenRef.current) {
      desktopPetApi.setPetMode("stand");
    }
  }, [state.timerRuntime.focus?.startedAt, state.timerRuntime.break?.startedAt]);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
    if (settingsOpen) {
      settingsOpened.current = true;
      desktopPetApi.setPetMode("setting");
      return;
    }
    if (settingsOpened.current) {
      desktopPetApi.restorePetMode("setting");
    }
  }, [settingsOpen]);

  useEffect(() => {
    return () => {
      if (thinkingTimer.current) {
        window.clearTimeout(thinkingTimer.current);
      }
      if (chatOpened.current) {
        desktopPetApi.restorePetMode("sleep");
      }
      if (settingsOpened.current) {
        desktopPetApi.restorePetMode("setting");
      }
      desktopPetApi.restorePetMode("thinking");
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (chatOpen) {
        setChatOpen(false);
        return;
      }
      if (panelPinned) {
        return;
      }
      desktopPetApi.windowAction("close");
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, panelPinned]);

  function updateMit(value: string) {
    triggerThinking();
    updateState({
      dailyMitByDate: {
        ...state.dailyMitByDate,
        [dateKey]: value,
      },
    });
  }

  function triggerThinking() {
    if (chatOpenRef.current || settingsOpenRef.current) {
      return;
    }
    desktopPetApi.setPetMode("thinking");
    if (thinkingTimer.current) {
      window.clearTimeout(thinkingTimer.current);
    }
    thinkingTimer.current = window.setTimeout(() => {
      if (!chatOpenRef.current && !settingsOpenRef.current) {
        desktopPetApi.restorePetMode("thinking");
      }
    }, 4200);
  }

  return (
    <main className="panel mac-window">
      <header className="titlebar">
        <MacControls showPin pinned={panelPinned} onPinnedChange={setPanelPinned} />
        <div className="titlebar-text">
          <span className="spark" />
          伊之助思考...
          <span className="spark blue" />
        </div>
        <button
          className={`chat-entry ${chatOpen ? "active" : ""}`}
          title={chatOpen ? "关闭聊天" : "聊天"}
          aria-label={chatOpen ? "关闭聊天" : "聊天"}
          onClick={() => setChatOpen((value) => !value)}
        >
          <MessageCircle size={14} />
        </button>
      </header>

      <section className="mit-strip">
        <img className="mit-icon" src={assetPath("icons/mit.png")} alt="" />
        <input
          value={state.dailyMitByDate[dateKey] ?? ""}
          onChange={(event) => updateMit(event.target.value)}
          placeholder="今天最重要的猎物"
        />
        <button className="mit-chat-button" title="聊天" aria-label="聊天" onClick={() => setChatOpen(true)}>
          <img src={assetPath("icons/chat.png")} alt="" />
        </button>
      </section>

      <section className="note-zone">
        {chatOpen ? (
          <ChatView
            settings={state.llmSettings}
            mitText={state.dailyMitByDate[dateKey] ?? ""}
            storedMessages={state.chatMessages}
            onMessagesChange={(chatMessages) => updateState({ chatMessages })}
          />
        ) : (
          <>
            <NoteEditor state={state} updateState={updateState} onThink={triggerThinking} />
            <img className="note-pet" src={assetPath("icons/notes.png")} alt="" />
          </>
        )}
      </section>

      <section className="bottom-row">
        <TimerCard title="猪突猛进" icon={<img className="timer-art-icon" src={assetPath("icons/tomato.png")} alt="" />} timer={focusTimer} mode="focus" tone="blue" />
        <TimerCard title="休息一下" icon={<img className="timer-art-icon" src={assetPath("icons/nose.png")} alt="" />} timer={breakTimer} mode="break" tone="pink" />
      </section>

      <footer className="panel-footer">
        <IconButton label="设置" onClick={() => setSettingsOpen((value) => !value)} className="footer-settings">
          <Settings size={20} />
        </IconButton>
        {settingsOpen && (
          <SettingsPopover
            state={state}
            updateState={updateState}
            updatePetSettings={updatePetSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </footer>
    </main>
  );
}

function SettingsView() {
  const { state, updateState, updatePetSettings } = useAppState();

  return (
    <main className="settings-window mac-window">
      <header className="titlebar">
        <MacControls />
        <div className="titlebar-text">设置</div>
      </header>

      <section className="settings-content">
        <SettingsPopover
          state={state}
          updateState={updateState}
          updatePetSettings={updatePetSettings}
          onClose={() => desktopPetApi.windowAction("close")}
        />
      </section>
    </main>
  );
}

const params = new URLSearchParams(window.location.search);
const windowKind = params.get("window");

const view =
  windowKind === "pet" ? <PetView /> : windowKind === "settings" ? <SettingsView /> : <PanelView />;

createRoot(document.getElementById("root")!).render(view);

