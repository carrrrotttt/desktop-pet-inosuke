import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Coffee,
  Github,
  MessageCircle,
  Pause,
  Pin,
  Play,
  Sparkles,
  Target,
  TimerReset,
  X,
} from "lucide-react";
import "./portfolio.css";

type PetMode = "stand" | "thinking" | "setting" | "sleep" | "running" | "eating" | "focus" | "upsideDown";
type TimerKey = "focus" | "break";

const modeOptions: Array<{ key: PetMode; label: string; description: string }> = [
  { key: "stand", label: "站立", description: "默认陪伴状态" },
  { key: "thinking", label: "思考", description: "记录和整理时触发" },
  { key: "setting", label: "猪脑过载", description: "设置时触发" },
  { key: "sleep", label: "瞌睡", description: "与猪猪聊天时触发" },
  { key: "running", label: "猪突猛进", description: "休息钟运行时触发，提醒起身活动" },
  { key: "eating", label: "吃东西", description: "休息钟运行时触发" },
  { key: "focus", label: "专注", description: "番茄钟运行时触发" },
  { key: "upsideDown", label: "倒立", description: "番茄钟运行时触发" },
];

const frameConfig: Record<Exclude<PetMode, "stand">, { folder: string; count: number; delay: number }> = {
  thinking: { folder: "thinking", count: 24, delay: 145 },
  setting: { folder: "set", count: 21, delay: 170 },
  sleep: { folder: "sleeping", count: 24, delay: 210 },
  running: { folder: "running", count: 16, delay: 72 },
  eating: { folder: "eating", count: 24, delay: 140 },
  focus: { folder: "squatting", count: 24, delay: 155 },
  upsideDown: { folder: "upside-down", count: 27, delay: 95 },
};

const chatReplies = [
  "先别想整份报告。俺建议先列 3 个一级标题：背景、方案、结果。",
  "第一段先写项目目标，别绕弯。写清楚为什么做、给谁用、解决什么问题。",
  "用 25 分钟先完成大纲，番茄钟结束前不改格式，先把骨架撞出来。",
  "如果卡住，就先写最确定的一页。报告不是一口吞的，先咬下一块。",
];

function assetPath(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function getFrames(mode: PetMode) {
  if (mode === "stand") {
    return [assetPath("pet/stand.png")];
  }
  const config = frameConfig[mode];
  return Array.from({ length: config.count }, (_, index) => assetPath(`pet/${config.folder}/${index + 1}.png`));
}

function formatSeconds(seconds: number) {
  const minute = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function useDemoTimer(duration: number) {
  const [seconds, setSeconds] = useState(duration);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSeconds(duration);
    setRunning(false);
  }, [duration]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          return duration;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [duration, running]);

  return {
    seconds,
    running,
    toggle: () => setRunning((value) => !value),
    reset: () => {
      setRunning(false);
      setSeconds(duration);
    },
  };
}

function PetStage({
  mode,
  scale,
  speed,
  setMode,
}: {
  mode: PetMode;
  scale: number;
  speed: number;
  setMode: (mode: PetMode) => void;
}) {
  const [frame, setFrame] = useState(0);
  const [readyFrames, setReadyFrames] = useState<{ mode: PetMode; count: number }>({ mode: "stand", count: 1 });
  const frames = useMemo(() => getFrames(mode), [mode]);
  const readyFrameCount = readyFrames.mode === mode ? readyFrames.count : 1;
  const playableFrames = frames.slice(0, Math.max(1, readyFrameCount));
  const delay = mode === "stand" ? 220 : Math.max(38, frameConfig[mode].delay - speed * 5);

  useEffect(() => {
    setFrame(0);
    setReadyFrames({ mode, count: mode === "stand" ? 1 : 0 });
    const loadedIndexes = new Set<number>();
    let cancelled = false;

    frames.forEach((src, index) => {
      const image = new Image();
      image.onload = () => {
        if (cancelled) {
          return;
        }
        loadedIndexes.add(index);
        let nextReadyCount = 0;
        while (loadedIndexes.has(nextReadyCount)) {
          nextReadyCount += 1;
        }
        setReadyFrames({ mode, count: Math.max(1, nextReadyCount) });
      };
      image.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [frames, mode]);

  useEffect(() => {
    const timer = window.setInterval(() => setFrame((value) => value + 1), delay);
    return () => window.clearInterval(timer);
  }, [delay, mode, playableFrames.length]);

  return (
    <div className="pet-stage" aria-label="桌面宠物动态原型">
      <div className="pet-mode-strip" aria-label="宠物行为动态切换">
        {modeOptions.map((item) => (
          <button
            key={item.key}
            className={mode === item.key ? "active" : ""}
            type="button"
            title={item.description}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <img
        className={`portfolio-pet ${mode === "running" ? "pet-moving" : ""}`}
        src={playableFrames[frame % playableFrames.length]}
        alt="伊之助桌面宠物动画"
        style={{ width: `${Math.round(160 * scale)}px` }}
        draggable={false}
      />
      <div className="stage-note">
        <strong>{modeOptions.find((item) => item.key === mode)?.label}</strong>
        <span>{modeOptions.find((item) => item.key === mode)?.description}</span>
      </div>
    </div>
  );
}

function TimerTile({
  title,
  icon,
  timer,
  onActivate,
}: {
  title: string;
  icon: React.ReactNode;
  timer: ReturnType<typeof useDemoTimer>;
  onActivate: () => void;
}) {
  function toggle() {
    timer.toggle();
    onActivate();
  }

  return (
    <section className="timer-tile">
      <div className="tile-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="timer-number">{formatSeconds(timer.seconds)}</div>
      <div className="timer-controls">
        <button className="icon-action primary" type="button" aria-label={timer.running ? "暂停" : "开始"} onClick={toggle}>
          {timer.running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="icon-action" type="button" aria-label="重置" onClick={timer.reset}>
          <TimerReset size={18} />
        </button>
      </div>
    </section>
  );
}

function PrototypePanel({
  setMode,
  scale,
  setScale,
  speed,
  setSpeed,
}: {
  setMode: (mode: PetMode) => void;
  scale: number;
  setScale: (value: number) => void;
  speed: number;
  setSpeed: (value: number) => void;
}) {
  const [mit, setMit] = useState("完成XX项目报告");
  const [note, setNote] = useState("报告先写清楚目标、用户问题、方案和结果，不要一开始就陷入排版。");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatIndex, setChatIndex] = useState(0);
  const focusTimer = useDemoTimer(25 * 60);
  const breakTimer = useDemoTimer(5 * 60);
  const currentReply = chatReplies[chatIndex % chatReplies.length];

  function nextReply() {
    setChatOpen(true);
    setChatIndex((value) => value + 1);
    setMode("sleep");
  }

  function openChat() {
    setChatOpen((value) => {
      const nextValue = !value;
      if (nextValue) {
        setMode("sleep");
      }
      return nextValue;
    });
  }

  function triggerSetting() {
    setMode("setting");
  }

  return (
    <section className="prototype-area" id="prototype">
      <div className="section-heading">
        <span className="eyebrow">Interactive Prototype</span>
        <h2>可交互预览（部分功能）</h2>
        <p>这个原型保留真实应用的核心路径：先确定今天最重要的事，再用便签、计时器和角色化 AI 陪伴把行动推起来。</p>
      </div>

      <div className="prototype-grid">
        <div className="demo-window app-panel-preview">
          <header className="window-bar">
            <div className="demo-mac-controls">
              <button className="traffic traffic-close" type="button" aria-label="关闭预览">
                <X size={14} />
              </button>
              <button className="traffic traffic-pin" type="button" aria-label="固定预览">
                <Pin size={10} />
              </button>
            </div>
            <div className="window-title">
              <span className="spark" />
              伊之助思考...
              <span className="spark blue" />
            </div>
            <button className={`chat-entry ${chatOpen ? "active" : ""}`} type="button" aria-label="打开聊天" onClick={openChat}>
              <MessageCircle size={18} />
            </button>
          </header>

          <label className="mit-field">
            <img className="mit-icon" src={assetPath("icons/mit.png")} alt="" />
            <input value={mit} onChange={(event) => setMit(event.target.value)} aria-label="今日 MIT" />
            <button
              className="mit-chat-button"
              type="button"
              aria-label="聊天"
              onClick={() => {
                setChatOpen(true);
                setMode("sleep");
              }}
            >
              <img src={assetPath("icons/chat.png")} alt="" />
            </button>
          </label>

          <div className="note-panel">
            {chatOpen ? (
                <div className="chat-panel">
                  <div className="chat-bubble pet">俺在！今天的猎物是「{mit || "最重要的一件事"}」。</div>
                <div className="chat-bubble user">帮我把项目报告拆成第一步。</div>
                <div className="chat-bubble pet">{currentReply}</div>
                <button type="button" onClick={nextReply}>
                  <Sparkles size={16} />
                  生成下一条模拟建议
                </button>
              </div>
            ) : (
              <>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="便签内容" />
                <img className="note-pet" src={assetPath("icons/notes.png")} alt="" />
              </>
            )}
          </div>

          <div className="timer-row">
            <TimerTile
              title="番茄钟"
              icon={<Clock3 size={20} />}
              timer={focusTimer}
              onActivate={() => setMode("focus")}
            />
            <TimerTile
              title="休息钟"
              icon={<Coffee size={20} />}
              timer={breakTimer}
              onActivate={() => setMode("running")}
            />
          </div>
        </div>

        <aside className="control-panel settings-preview">
          <h3>设置</h3>
          <section className="settings-group">
            <strong>基础设置</strong>
            <div className="settings-box">
              <label>
                <span>猪猪大小</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={scale}
                  onChange={(event) => {
                    setScale(Number(event.target.value));
                    triggerSetting();
                  }}
                />
              </label>
              <label>
                <span>奔跑速度</span>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={speed}
                  onChange={(event) => {
                    setSpeed(Number(event.target.value));
                    triggerSetting();
                  }}
                />
              </label>
              <div className="setting-grid">
                <label>
                  <span>番茄钟</span>
                  <input type="number" min="1" max="180" defaultValue="25" onFocus={triggerSetting} />
                </label>
                <label>
                  <span>休息钟</span>
                  <input type="number" min="1" max="60" defaultValue="5" onFocus={triggerSetting} />
                </label>
              </div>
            </div>
          </section>

          <section className="settings-group">
            <strong>模型调用</strong>
            <div className="settings-box">
              <label>
                <span>服务商</span>
                <select defaultValue="openai" onFocus={triggerSetting}>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问</option>
                  <option value="hunyuan">混元</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label>
                <span>API Key（预览不接入）</span>
                <input type="text" value="预览不接入、不保存、不调用" disabled readOnly />
              </label>
              <label>
                <span>Base URL</span>
                <input defaultValue="https://api.openai.com/v1" onFocus={triggerSetting} />
              </label>
              <label>
                <span>Model ID</span>
                <input defaultValue="gpt-4o-mini" onFocus={triggerSetting} />
              </label>
              <label>
                <span>接口格式</span>
                <select defaultValue="openai-chat" onFocus={triggerSetting}>
                  <option value="openai-chat">OpenAI Chat Completions</option>
                </select>
              </label>
              <div className="setting-test-row">
                <button type="button" disabled>测试连接</button>
                <span>此处仅展示设置项，不接入真实 API Key。</span>
              </div>
            </div>
          </section>

          <section className="settings-group">
            <strong>聊天记录</strong>
            <div className="setting-action-row">
              <button className="setting-danger-button" type="button" onClick={triggerSetting}>
                清除当前聊天记录
              </button>
              <span>只清除对话，不影响模型配置。</span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function App() {
  const [mode, setMode] = useState<PetMode>("stand");
  const [scale, setScale] = useState(1);
  const [speed, setSpeed] = useState(3);

  const productCards = [
    {
      icon: <Target size={22} />,
      title: "屏幕工作时的陪伴",
      text: "宠物始终在桌面边缘活动，降低独自工作的空白感，用轻微存在感陪用户进入状态。",
    },
    {
      icon: <CheckCircle2 size={22} />,
      title: "轻量化的任务工具",
      text: "MIT、便签、专注钟和休息钟集中在一个浮窗里，减少切换工具带来的启动成本。",
    },
    {
      icon: <Bot size={22} />,
      title: "与喜爱角色的互动娱乐",
      text: "角色化语气、动作反馈和聊天窗口让任务工具多一层情绪连接，而不是冷冰冰的效率面板。",
    },
  ];

  return (
    <main className="portfolio-page">
      <section className="hero-section">
        <nav className="portfolio-nav" aria-label="作品集导航">
          <a href="#product">核心场景</a>
          <a href="#prototype">交互预览</a>
          <a href="#value">产品思考</a>
        </nav>

        <div className="hero-content">
          <div className="hero-copy">
            <span className="eyebrow">DESKTOP PET INOSUKE</span>
            <h1>伊之助桌面宠物</h1>
            <p className="hero-lead">
              一个 Windows 桌面宠物，也是一个轻量 AI 任务陪伴入口：用角色化互动、MIT、便签和专注计时，帮助用户更低压力地开始行动。
            </p>
            <div className="hero-actions">
              <a className="text-button primary-link" href="#prototype">
                体验交互预览
              </a>
              <a className="text-button" href="#product">
                查看核心场景
              </a>
              <a
                className="text-button"
                href="https://github.com/carrrrotttt/desktop-pet-inosuke.git"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={16} />
                GitHub 仓库
              </a>
            </div>
            <div className="metric-strip" aria-label="项目能力摘要">
              <span>Electron 桌面端</span>
              <span>React 原型</span>
              <span>多模型配置</span>
            </div>
          </div>

          <PetStage mode={mode} scale={scale} speed={speed} setMode={setMode} />
        </div>
      </section>

      <section className="product-section" id="product">
        <div className="section-heading">
          <span className="eyebrow">Core Scenarios</span>
          <h2>核心场景</h2>
          <p>这个项目围绕桌面工作时的真实需求展开：陪伴、轻量任务推进，以及和熟悉角色之间的低压力互动。</p>
        </div>
        <div className="product-card-grid">
          {productCards.map((item) => (
            <article className="product-card" key={item.title}>
              <div className="card-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <PrototypePanel setMode={setMode} scale={scale} setScale={setScale} speed={speed} setSpeed={setSpeed} />

      <section className="value-section" id="value">
        <div className="section-heading">
          <span className="eyebrow">Product Thinking</span>
          <h2>产品思考</h2>
        </div>
        <div className="value-grid">
          <article>
            <strong>1. 用户不是永远需要“效率最大化”</strong>
            <p>很多时候用户需要的是低压力陪伴：先愿意靠近任务，再逐步进入行动，而不是被更强的效率压力追着跑。</p>
          </article>
          <article>
            <strong>2. AI 助手可以被具象化</strong>
            <p>当 AI 以熟悉角色的形象和性格存在，用户更容易理解它的边界，也更愿意把它当作桌面上的陪伴对象。</p>
          </article>
          <article>
            <strong>3. 情绪投射是产品需求的一部分</strong>
            <p>角色个性、动作反馈和即时回应会影响用户是否愿意持续互动，这类情绪体验本身就是 AI 产品设计变量。</p>
          </article>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
