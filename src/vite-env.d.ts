/// <reference types="vite/client" />

type WindowAction = "fullscreen" | "minimize" | "close" | "toggle-pin";
type PetMode =
  | "walking"
  | "stand"
  | "focus"
  | "break"
  | "running"
  | "eating"
  | "sleep"
  | "setting"
  | "thinking"
  | "squatting"
  | "upsideDown";
type LlmProvider = "openai" | "deepseek" | "qwen" | "hunyuan" | "openrouter" | "custom";
type LlmApiFormat = "openai-chat";

type PetViewState = {
  direction: 1 | -1;
  mode: PetMode;
  moving: boolean;
};

type LlmSettings = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  apiFormat: LlmApiFormat;
};

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatStreamEvent =
  | { requestId: string; type: "chunk"; content: string }
  | { requestId: string; type: "done" }
  | { requestId: string; type: "error"; message: string };

type TimerKey = "focus" | "break";

type TimerRuntime = {
  remainingSeconds: number;
  startedAt: number | null;
};

type AppState = {
  dailyMitByDate: Record<string, string>;
  noteText: string;
  noteHtml: string;
  chatMessages: ChatMessage[];
  timerRuntime: Record<TimerKey, TimerRuntime | null>;
  windowSettings: {
    panelWidth: number;
    panelHeight: number;
  };
  timerSettings: {
    focusMinutes: number;
    breakMinutes: number;
  };
  petSettings: {
    scale: number;
    speed: number;
  };
  llmSettings: LlmSettings;
};

type DesktopPetApi = {
  getState: () => Promise<AppState>;
  saveState: (partialState: Partial<AppState>) => Promise<AppState>;
  setPetSettings: (settings: AppState["petSettings"]) => Promise<AppState>;
  setPetMode: (mode: PetMode) => Promise<void>;
  restorePetMode: (mode?: PetMode) => Promise<void>;
  startPetDrag: () => Promise<void>;
  endPetDrag: () => Promise<void>;
  windowAction: (action: WindowAction) => Promise<{ pinned?: boolean } | void>;
  openPanel: (options?: { chat?: boolean }) => Promise<void>;
  togglePanel: () => Promise<void>;
  openSettings: () => Promise<void>;
  streamChat: (payload: {
    requestId: string;
    messages: ChatMessage[];
    settings: LlmSettings;
  }) => Promise<{ ok: boolean; error?: string }>;
  testLlmSettings: (settings: LlmSettings) => Promise<{ ok: boolean; message: string }>;
};

interface Window {
  desktopPet: DesktopPetApi;
  desktopPetEvents: {
    onViewStateChange: (callback: (viewState: PetViewState) => void) => () => void;
    onChatStream: (callback: (event: ChatStreamEvent) => void) => () => void;
    onOpenChat: (callback: () => void) => () => void;
  };
}
