# 推敲 Trace

> 鸟宿池边树，僧推月下门

推敲（trace），一款**很奇怪**的写作编辑器，支持浏览器（PWA）和桌面（Windows / macOS）。相较于传统的编辑软件，在这个软件里删除的文字不会直接消失，而是会以 ~~删除线~~ 的方式留存下来。

人们在使用媒介的同时，媒介也在不断的重塑人们的思维。高中时语文老师总是批评我爱涂改，最后搞得卷面一团糟，我当时就犟嘴说**涂改也是内容的一部分**，后来在读了秦兰珺老师的《编码日常：大众软件批判》发觉真有一定道理，纸笔写下的文字和电脑写下的文字注定不一样。

诚然，传统电脑写作有很多便捷之处，可无情的退格键却也导致无数精彩的文字被纷纷斩杀。因此我想要通过这样一种软删除的形式来一定程度的模拟手写的效果，为严肃写作提供一个工具。

即使在当下的大背景下，我始终坚信有些文字还是不能用AI生成。

最后，此项目是vibe-coding的作品，注定有许多不足与漏洞，欢迎各位大佬批评指正，我们是真诚的。

## 下载安装

前往 [GitHub Releases](https://github.com/cybersun55/trace/releases) 下载最新版本：

| 平台 | 文件 | 说明 |
|------|------|------|
| **macOS** | `推敲Trace_*.dmg` | Apple Silicon（M 系列芯片） |
| **Windows** | `推敲Trace_*_x64-setup.exe` | 64 位 Windows 10+ |

**浏览器版**（PWA）：访问 [cybersun55.github.io/trace](https://cybersun55.github.io/trace)，支持 Chrome / Edge 安装为桌面应用。

> 浏览器版使用 OPFS 存储数据（隐私/无痕模式不可用），桌面版使用系统本地文件系统存储。

### 从源码构建

```bash
git clone https://github.com/cybersun55/trace.git
cd trace
npm install
npm run dev          # 浏览器开发
npm run build        # 浏览器生产构建

# 桌面应用需额外安装 Rust 和 Tauri CLI
cargo install tauri-cli
cargo tauri build    # macOS
cargo tauri build --target x86_64-pc-windows-gnu  # Windows 交叉编译
```

### 运行测试

```bash
npm run test
```

## ✨ 特性

### 核心理念：改动留痕

在推敲 Trace 中，你删除的文本**不会消失**，而是以 ~~删除线~~ 显示。这让每一次修改都有据可查，回过头来看自己的思考演变过程。

- 正常输入文本实时显示
- 退格删除时文本变为删除线状态，而非移除
- 可一键切换"显示/隐藏已删除内容"
- 导出时可选择"留痕版"或"纯净版"

### 两种作品类型

| | 单篇文章 | 多章节书 |
|---|---|---|
| 适用场景 | 随笔、日记、短文 | 长篇小说、系列文章 |
| 章节管理 | 无 | 侧边栏章节列表，可增删切换 |
| 导出 | 单文件 | 按章节分别导出，或合并导出 |
| 字数统计 | 单篇 | 全书汇总 + 各章节独立统计 |

### 导出格式

| 格式 | 留痕版 | 纯净版 | 用途 |
|------|--------|--------|------|
| .doc (Word) | 删除线 + 灰色标记 | 仅最终文本 | 办公软件打开编辑 |
| .png (图片) | 删除线 + 灰色标记 | 仅最终文本 | 分享到社交平台 |
| .txt (纯文本) | — | 自动过滤已删除内容 | 无格式迁移 |
| .tracebook | 包含完整修改历史 | — | 项目备份/迁移 |
| Markdown | 删除线 ~~标记~~ | — | 技术文档 |

### 界面定制

**四种主题**

- 暖黄 — 默认主题，类纸张底色，适合长时间写作
- 浅色 — 高对比度白底，适合亮光环境
- 暗色 — 深色背景，适合夜间写作
- 护眼 — 低饱和绿色底，减轻视觉疲劳

所有主题通过 CSS 变量实现，切换即时生效。

**字体**

- 内置 8 款免费商用中文字体：霞鹜文楷、思源宋体、思源黑体、站酷仓耳、方正书宋、更纱黑体、衬线/无衬线系统默认
- 支持导入本地字体文件（.ttf / .otf / .woff2），存储在浏览器文件系统中，清缓存不丢失

**页宽与行距**

- 页宽：窄（600px）/ 中（760px）/ 宽（900px）/ 自定义 px 值
- 行距：1.6 / 1.8 / 2.0 / 2.2 / 自定义数值

### 快捷键

内置快捷键系统，所有快捷键**允许用户自定义修改**：

| 功能 | 默认快捷键 |
|------|-----------|
| 切换已删除内容显示 | Ctrl+H |
| 加粗 | Ctrl+B |
| 斜体 | Ctrl+I |
| 行距选择 | —（仅工具栏按钮） |

可添加快捷键提示栏（编辑器底部），也可选择隐藏。

### PWA 支持

- 可安装为独立桌面应用（浏览器地址栏会出现安装按钮）
- Service Worker 缓存机制，**已打开的文档断网也能继续写作**
- 无后台同步上传，始终本地优先

### 数据安全

- 浏览器端使用 OPFS（Origin Private File System）存储，桌面端使用系统本地文件系统
- 数据完全在本地，无任何后端服务、无遥测、无数据收集
- 支持 .tracebook 格式导入导出，方便备份迁移
- 编辑时自动保存到 localStorage 作为崩溃恢复安全网

## 🛠 技术架构

### 技术栈

| 层 | 选型 | 说明 |
|---|------|------|
| 框架 | React 19 + TypeScript + Tauri 2 | 严格类型，无 `any` 逃逸，跨平台桌面应用 |
| 状态管理 | Zustand | 轻量，分 editorStore + projectStore |
| 构建 | Vite | 秒级 HMR，生产构建 ~370KB gzip ~114KB |
| 存储 | OPFS / Tauri FS | 浏览器用 OPFS，桌面端用本地文件系统 |
| 编辑器 | contentEditable + beforeinput 拦截 | 无第三方编辑器依赖 |
| PWA | Service Worker + Manifest | 离线缓存，可安装 |
| 测试 | Vitest | 57 个测试，覆盖核心逻辑 |
| 导出 | html-to-image | 仅 PNG 导出依赖 |
| CSS | 纯 CSS 变量 + 主题切换 | 零运行时 UI 库 |

### 目录结构

```
src/
├── App.tsx                # 顶层视图路由（仪表盘 / 编辑器）
├── App.css                # 全局样式 + 4 套主题变量
├── main.tsx               # 入口
├── types.ts               # 所有 TypeScript 类型定义
│
├── storage/               # 持久化层
│   ├── opfs.ts            # OPFS 底层操作（读写删查）
│   ├── projects.ts        # 项目 CRUD + 章节读写
│   ├── settings.ts        # 用户设置（主题/字体/快捷键）
│   ├── crashSave.ts       # 崩溃恢复快照（localStorage）
│   ├── io.ts              # .tracebook 导入导出
│   └── index.ts           # 统一导出
│
├── store/                 # 状态管理
│   ├── editorStore.ts     # 编辑器状态（文档内容、光标、格式化）
│   ├── projectStore.ts    # 项目管理状态（列表、打开、切换章节）
│   └── index.ts           # 统一导出
│
├── engine.ts              # 编辑器核心：文本操作、光标恢复、段落管理
├── Editor.tsx             # 编辑器主体（contentEditable 容器 + 事件处理）
├── EditorLayout.tsx       # 编辑器整体布局（顶栏 + 侧边栏 + 编辑区）
├── EditorHeader.tsx       # 编辑器顶部栏（标题、导出菜单）
├── ChapterSidebar.tsx     # 章节侧边栏（书类型项目）
├── ParagraphBlock.tsx     # 段落渲染组件
├── Toolbar.tsx            # 格式工具栏（加粗/斜体/行距/隐藏切换）
├── CopyModal.tsx          # 复制弹窗
│
├── Dashboard.tsx          # 项目仪表盘（项目列表）
├── ProjectCard.tsx        # 项目卡片
├── NewProjectDialog.tsx   # 新建项目弹窗
├── SettingsDialog.tsx     # 设置面板（5 个标签页）
│
├── export.ts              # 导出引擎（纯文本/Markdown/HTML/Word/PNG/书籍合并）
├── i18n.ts                # 国际化（中/英，零依赖 useSyncExternalStore）
│
└── __tests__/             # 测试文件
    ├── engine.test.ts     # 编辑器核心测试
    ├── export.test.ts     # 导出功能测试
    └── storage/
        └── opfs.test.ts   # OPFS 存储层测试

├── src-tauri/             # Tauri 桌面应用（Rust 端）
│   ├── src/main.rs        # Rust 入口
│   ├── tauri.conf.json    # Tauri 配置
│   └── icons/             # 应用图标
│
└── public/                # 静态资源（PWA manifest、图标等）
```

### OPFS 存储结构

```
trace_projects/               ← navigator.storage.getDirectory()
  projects/
    {uuid-1}/                 ← 单篇文章
      meta.json               ← { id, title, type, createdAt, updatedAt, wordCount }
      content.json            ← Document（段落/内联节点/样式）
    {uuid-2}/                 ← 多章节书
      meta.json               ← ProjectMeta
      toc.json                ← { chapters: [{ id, title }] }
      chapters/
        ch_001.json           ← Document
        ch_002.json           ← Document
  fonts/                      ← 用户导入的字体文件
    {font-name}.ttf
```

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|---------|------|
| Chrome | 86+ | 完全支持 |
| Edge | 86+ | 完全支持 |
| Opera | 72+ | 完全支持 |
| Firefox | — | OPFS 支持不完整，应用会提示兼容信息 |
| Safari | — | 不支持 OPFS，应用会提示兼容信息 |

> 隐私/无痕模式下 OPFS 不可用，请使用常规浏览器窗口。

## 📄 License

MIT

---

<p align="center">
  <i>吟安一个字，拈断数茎须。</i>
</p>
