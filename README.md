# desktop-pet-inosuke

一个 Windows 桌面宠物。它会浮在桌面上，在屏幕底部活动；右键打开工作浮窗，可以记录今日 MIT、写便签、使用计时器，也可以接入大模型聊天。

## 下载和启动

从 GitHub Release 下载最新版：

https://github.com/carrrrotttt/desktop-pet-inosuke/releases

下载 `desktop-pet-inosuke-0.1.0-win-x64.zip` 后解压，双击：

```text
desktop-pet-inosuke.exe
```

注意：不要只单独拷贝 exe。请保持 exe 和同目录下的 `resources`、dll 等文件在同一个文件夹里。

## 基本操作

- 左键按住宠物：拖动位置，松手后会平滑落回屏幕底部。
- 左键单击宠物：宠物站住。
- 右键单击宠物：打开或关闭浮窗。
- 托盘图标：Windows 右下角托盘中可以打开/关闭浮窗，也可以退出程序。
- 浮窗固定键：固定后浮窗会保持在最前，且不会被 `Esc` 关闭。
- `Esc`：未固定浮窗时关闭浮窗；聊天窗打开时优先关闭聊天窗。

## 浮窗功能

- 顶部输入框：填写今天最重要的一件事。
- 中部便签：随手记录内容；选中文本后会出现简单格式栏，可加粗、设置待办、调整字号。
- 猪突猛进：专注计时器。
- 休息一下：休息计时器。
- 聊天按钮：打开与桌面宠物的聊天窗口。
- 左下角设置：调整宠物大小、奔跑速度、计时器时长和模型调用配置。

两个计时器不会同时运行：启动一个时，另一个会暂停，不会被重置。

## 聊天模型配置

进入设置后填写模型调用信息：

- 服务商：OpenAI、DeepSeek、千问、OpenRouter 或自定义。
- API Key：需要你自己填写。
- Base URL 和 Model ID：选择常见服务商时会自动填入默认值，也可以手动修改。
- 测试连接：用于确认配置是否可用。

如果不配置 API Key，桌面宠物仍可以正常使用 MIT、便签、计时器和动画功能，只是不能调用大模型聊天。

## 隐私说明

本程序不会把你的聊天记录或 API Key 打包进 exe，也不会上传到仓库。

运行后的本地数据保存在当前 Windows 用户的数据目录中，包含：

- 今日 MIT
- 便签内容
- 聊天记录
- 计时器设置
- 模型配置

如果要清除聊天记录，可以在设置里点击“清除当前聊天记录”。

## 开发运行

安装依赖：

```powershell
npm install
```

开发模式启动：

```powershell
npm run dev
```

构建检查：

```powershell
npm run build
```

打包 Windows 目录版：

```powershell
npm run dist
```

打包结果会输出到：

```text
release/win-unpacked
```

## 技术栈

- Electron
- React
- TypeScript
- Vite
